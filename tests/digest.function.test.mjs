// Integration test for the deployed daily-digest Edge Function. Needs .env, and CRON_SECRET in the environment:
//   CRON_SECRET=... node --env-file=.env tests/digest.function.test.mjs
// Creates a throwaway account (needs "Confirm email" off), then deletes it.
import { createClient } from '@supabase/supabase-js';
const U = process.env.EXPO_PUBLIC_SUPABASE_URL, K = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, SECRET = process.env.CRON_SECRET;
if (!U || !K || !SECRET) { console.error('Need EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY and CRON_SECRET'); process.exit(1); }
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const fn = (qs, secret = SECRET) => fetch(`${U}/functions/v1/daily-digest?${qs}`, { method: 'POST', headers: { 'x-cron-secret': secret } });
const c = createClient(U, K, { auth: { persistSession: false } });
const su = await c.auth.signUp({ email: `clutchly.fn.${Date.now()}@gmail.com`, password: 'Fn-test-pass-1' });
const uid = su.data.user.id;
try {
  ok((await fn('dry=1', 'wrong')).status === 403, 'wrong secret refused');
  ok((await fetch(`${U}/functions/v1/daily-digest`, { method: 'POST' })).status === 403, 'no secret refused');
  // Pretend it is 07:10 on 21 Nov 2026 in Brisbane (UTC+10, no daylight saving) = 21:10 UTC on the 20th.
  const at = '2026-11-20T21:10:00Z', today = '2026-11-21';
  const a = await c.from('animals').insert([{ name: 'F1', species: 'Carpet', sex: 'Female' }, { name: 'M1', species: 'Carpet', sex: 'Male' },
    { name: 'F2', species: 'Carpet', sex: 'Female' }]).select('id,name');
  const id = Object.fromEntries(a.data.map(x => [x.name, x.id]));
  await c.from('events').insert([{ animal_id: id.F1, kind: 'feed', ok: true, on_date: '2026-11-14' }, { animal_id: id.M1, kind: 'feed', ok: true, on_date: '2026-11-15' },
    { animal_id: id.F2, kind: 'feed', ok: true, on_date: '2026-11-20' }]);
  await c.from('pairings').insert({ female_id: id.F1, male_id: id.M1, prelay_shed: '2026-11-03', locks: [] });
  await c.from('season_settings').insert({ species: 'Carpet', pair_start: '11-24' });
  ok(!(await c.from('notification_settings').insert({ notify_hour: 7, timezone: 'Australia/Brisbane' })).error, 'save notification settings');
  ok(!(await c.rpc('register_device_token', { p_token: 'ExponentPushToken[clutchly-test-device]', p_platform: 'android' })).error, 'register device token');
  ok(!!(await c.rpc('register_device_token', { p_token: 'not-a-token', p_platform: 'android' })).error, 'junk token rejected');

  let r = await (await fn(`dry=1&user=${uid}&at=${at}`)).json(); let me = r.users.find(x => x.user === uid);
  ok(me?.local === today && me.devices === 1, 'dry run: user picked at their 7am, one device');
  ok(me?.messages?.some(m => m.kind === 'feed' && m.body === '1 animal due to feed today: F1'), 'dry run: feed count (F1 due; M1 and F2 not yet)');
  ok(me?.messages?.some(m => m.kind === 'lay' && m.body === 'F1 × M1'), 'dry run: lay expected in 7 days');
  ok(me?.messages?.some(m => m.kind === 'pairing' && m.body === 'Carpet pairing starts in 3 days'), 'dry run: pairing in 3 days');
  r = await (await fn(`dry=1&user=${uid}&at=2026-11-20T22:10:00Z`)).json();
  ok(!r.users.some(x => x.user === uid), 'not picked at 8am (wrong hour)');
  await c.from('notification_settings').update({ feed_due: false, lay_soon: false, pairing_soon: false }).eq('user_id', uid);
  r = await (await fn(`dry=1&user=${uid}&at=${at}`)).json(); ok(!r.users.some(x => x.user === uid), 'all alerts off: user skipped');
  await c.from('notification_settings').update({ feed_due: true, lay_soon: true, pairing_soon: true }).eq('user_id', uid);

  r = await (await fn(`user=${uid}&at=${at}`)).json(); me = r.users.find(x => x.user === uid);
  ok(me?.messages?.length === 3, 'real run: 3 messages sent to Expo');
  ok(me?.removedTokens === 1, 'fake token reported dead by Expo and removed');
  ok(((await c.from('device_tokens').select('id')).data ?? []).length === 0, 'token gone from device_tokens');
  ok((await c.from('notification_settings').select('last_sent_on').single()).data?.last_sent_on === today, 'last_sent_on recorded');
  r = await (await fn(`user=${uid}&at=${at}`)).json(); ok(r.users.find(x => x.user === uid)?.skipped === 'already sent today', 'second run same day: not sent again');
} finally { await c.rpc('delete_my_account'); }
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
