// revenuecat-webhook: RevenueCat calls this on every purchase event. It records each user's "pro" status in the
// subscriptions table, which the database uses to enforce the free limit. The app never writes that table.
// Secrets (Edge Functions > Secrets): REVENUECAT_WEBHOOK_AUTH = the exact Authorization header value set in RevenueCat.
// Optional: REVENUECAT_SECRET_API_KEY (RevenueCat secret key, v1). If set, the function asks RevenueCat for each user's
// current entitlement instead of trusting the single event, which is the most robust (handles any event order).
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
import { rowFor, userIds, type RcEvent } from './status.ts';

const ENTITLEMENT = 'pro';

async function fromRevenueCat(userId: string, key: string) {
  const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`RevenueCat ${r.status}`);
  const ent = (await r.json())?.subscriber?.entitlements?.[ENTITLEMENT];
  const exp = ent?.expires_date ?? null;
  return { user_id: userId, entitlement: ENTITLEMENT, active: !!ent && (exp === null || Date.parse(exp) > Date.now()), expires_at: exp,
    product_id: ent?.product_identifier ?? null, store: null, environment: null, last_event_type: 'REFRESH', last_event_at: new Date().toISOString() };
}

Deno.serve(async req => {
  const auth = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!auth || req.headers.get('authorization') !== auth) return new Response('unauthorized', { status: 401 });
  let e: RcEvent;
  try { e = (await req.json()).event; if (!e?.type) throw 0; } catch { return new Response('bad request', { status: 400 }); }
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const rcKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');

  // A transfer moves the purchase from one app user to another: re-evaluate both sides.
  const ids = e.type === 'TRANSFER' ? [...(e.transferred_from ?? []), ...(e.transferred_to ?? [])].filter(x => /^[0-9a-f-]{36}$/i.test(x)) : userIds(e);
  const written: string[] = [];
  for (const id of ids) {
    const { data: user } = await db.auth.admin.getUserById(id);
    if (!user?.user) continue; // not one of our users (e.g. an anonymous RevenueCat id)
    let row: Record<string, unknown> | null = null;
    if (rcKey) row = await fromRevenueCat(id, rcKey);
    else if (e.type === 'TRANSFER') row = { user_id: id, entitlement: ENTITLEMENT, active: (e.transferred_to ?? []).includes(id), expires_at: null,
      product_id: null, store: null, environment: e.environment ?? null, last_event_type: 'TRANSFER', last_event_at: new Date(e.event_timestamp_ms ?? Date.now()).toISOString() };
    else {
      const { data: cur } = await db.from('subscriptions').select('last_event_at').eq('user_id', id).maybeSingle();
      row = rowFor(e, id, cur);
    }
    if (!row) continue;
    const { error } = await db.from('subscriptions').upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) return Response.json({ error: error.message }, { status: 500 }); // RevenueCat retries on failure
    written.push(id);
  }
  return Response.json({ ok: true, type: e.type, updated: written.length });
});
