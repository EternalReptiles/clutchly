// The seller approves a handover (migration 020). Calls approve_transfer as the signed-in seller (which checks the
// link, the request, both licences and the buyer's plan, and copies the animal, history and genes), then copies the
// animal's photos into the buyer's folder with the service role, which storage needs (files can't be copied in SQL).
// Deploy with JWT verification off (it passes the caller's token to the database, which checks it).
// Body: { code }. Returns { new_animal_id, photos, photos_failed, photos_problem? } or { error } (the database's message).
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'not_signed_in' }, 401);
  const code = (await req.json().catch(() => ({})))?.code;
  if (typeof code !== 'string' || !code) return json({ error: 'transfer_not_found' }, 400);
  const url = Deno.env.get('SUPABASE_URL')!;
  const seller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const r = await seller.rpc('approve_transfer', { p_code: code });
  if (r.error) return json({ error: r.error.message }, 400);
  const { new_animal_id, buyer_id, photos } = r.data as { new_animal_id: string; buyer_id: string; photos: { path: string; is_cover: boolean; created_at: string }[] };

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const bucket = admin.storage.from('animal-photos'); let copied = 0, failed = 0, problem: string | undefined;
  for (const p of photos) {
    const to = `${buyer_id}/${new_animal_id}/${crypto.randomUUID()}.jpg`;
    const c = await bucket.copy(p.path, to);
    if (c.error) { failed++; problem ??= `copy: ${c.error.message}`; continue; }
    const ins = await admin.from('animal_photos').insert({ user_id: buyer_id, animal_id: new_animal_id, path: to, is_cover: p.is_cover, created_at: p.created_at });
    if (ins.error) { failed++; problem ??= `record: ${ins.error.message}`; await bucket.remove([to]); } else copied++;
  }
  return json({ new_animal_id, photos: copied, photos_failed: failed, ...(problem ? { photos_problem: problem } : {}) });
});
