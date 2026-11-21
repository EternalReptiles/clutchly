// daily-digest: run every hour by pg_cron (see supabase/migrations/004_notification_cron.sql).
// Also removes Storage files of deleted photos (queued in photo_cleanup by migration 006).
// For each user whose chosen notification hour has just started in their timezone, and who hasn't been sent
// today's digest yet, works out what is due and sends it to their devices through Expo's push service.
//
// Secrets: CRON_SECRET (set on the function; pg_cron sends it in the x-cron-secret header).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase. The service role key never leaves the server.
// Query parameters (also need the secret): ?dry=1 works everything out but sends nothing and records nothing;
// ?user=<uuid> limits the run to one user; ?at=<ISO time> pretends it is that time (for testing).
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
import { buildDigest, localNow, type Msg } from './digest.ts';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async req => {
  if (!Deno.env.get('CRON_SECRET') || req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('forbidden', { status: 403 });
  const q = new URL(req.url).searchParams; const dry = q.get('dry') === '1';
  const now = q.get('at') ? new Date(q.get('at')!) : new Date();
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // Remove photo files whose rows were deleted (a photo, its animal, or a whole account). See migration 006.
  let photosRemoved = 0;
  if (!dry) {
    const { data: gone } = await db.from('photo_cleanup').select('path').limit(1000);
    if (gone?.length) {
      const paths = gone.map(g => g.path);
      const { error: rmErr } = await db.storage.from('animal-photos').remove(paths);
      if (!rmErr) { await db.from('photo_cleanup').delete().in('path', paths); photosRemoved = paths.length; }
    }
  }

  let sq = db.from('notification_settings').select('*').or('feed_due.eq.true,lay_soon.eq.true,pairing_soon.eq.true');
  if (q.get('user')) sq = sq.eq('user_id', q.get('user')!);
  const { data: settings, error } = await sq;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const report: { user: string; local: string | null; skipped?: string; messages?: Msg[]; devices?: number; removedTokens?: number }[] = [];
  for (const st of settings ?? []) {
    const local = localNow(now, st.timezone);
    if (!local) { report.push({ user: st.user_id, local: null, skipped: 'bad timezone' }); continue; }
    if (local.hour !== st.notify_hour) continue;
    if (st.last_sent_on === local.date && !dry) { report.push({ user: st.user_id, local: local.date, skipped: 'already sent today' }); continue; }

    const [a, s, p, t] = await Promise.all([
      db.from('animal_status').select('*').eq('user_id', st.user_id),
      db.from('season_settings').select('*').eq('user_id', st.user_id),
      db.from('pairings').select('*').eq('user_id', st.user_id).is('laid', null),
      db.from('device_tokens').select('token').eq('user_id', st.user_id)]);
    const err = a.error || s.error || p.error || t.error;
    if (err) { report.push({ user: st.user_id, local: local.date, skipped: 'load failed: ' + err.message }); continue; }

    const messages = buildDigest(local.date, st, a.data ?? [], s.data ?? [], p.data ?? []);
    const tokens = (t.data ?? []).map(x => x.token);
    let removedTokens = 0;
    if (!dry && messages.length && tokens.length) {
      const batch = tokens.flatMap(to => messages.map(m => ({ to, title: m.title, body: m.body, sound: 'default', data: { kind: m.kind } })));
      for (let i = 0; i < batch.length; i += 100) {
        const chunk = batch.slice(i, i + 100);
        const res = await fetch(EXPO_PUSH, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(chunk) });
        const json = await res.json().catch(() => ({}));
        // Remove tokens Expo says are no longer valid (app uninstalled, notifications revoked).
        const dead = (json.data ?? []).map((r: any, k: number) => r?.details?.error === 'DeviceNotRegistered' ? chunk[k].to : null).filter(Boolean);
        if (dead.length) { await db.from('device_tokens').delete().in('token', dead); removedTokens += new Set(dead).size; }
      }
    }
    if (!dry) await db.from('notification_settings').update({ last_sent_on: local.date }).eq('user_id', st.user_id);
    report.push({ user: st.user_id, local: local.date, messages, devices: tokens.length, removedTokens });
  }
  return Response.json({ at: now.toISOString(), dry, photosRemoved, users: report });
});
