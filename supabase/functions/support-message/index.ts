// Contact support form (app/contact.tsx). Anyone can send, signed in or not (people who can't sign in need help too).
// Checks the message, limits how often one sender can write, saves it in support_messages (migration 021) and emails
// it to SUPPORT_TO through Resend, with Reply-To set to the sender, so support replies from their normal inbox.
// It never emails the sender (an open form that sends email to any address would be used for spam).
// Secrets: RESEND_API_KEY (a Resend API key with sending access; without it messages are only saved),
// SUPPORT_TO (where messages go), optional SUPPORT_FROM. Deploy with JWT verification off.
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
export const TOPICS = ['Question', 'Problem or bug', 'Account or sign-in', 'Pro or payments', 'Handover', 'Idea or feedback'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ error: 'bad_request' }, 400);
  // A hidden field people never see; bots fill it in. Pretend it worked.
  if (body.website) return json({ ok: true, emailed: false });
  const email = String(body.email ?? '').trim().slice(0, 254), message = String(body.message ?? '').trim();
  const topic = TOPICS.includes(body.topic) ? body.topic : 'Question';
  if (!EMAIL.test(email)) return json({ error: 'bad_email' }, 400);
  if (!message || message.length > 5000) return json({ error: 'bad_message' }, 400);
  const meta = typeof body.meta === 'object' && body.meta ? Object.fromEntries(Object.entries(body.meta).slice(0, 20).map(([k, v]) => [k.slice(0, 40), String(v).slice(0, 300)])) : {};

  const url = Deno.env.get('SUPABASE_URL')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, service, { auth: { persistSession: false } });
  // Signed in? The app sends the user's token; otherwise it's the public key, which isn't a user.
  let userId: string | null = null, accountEmail: string | null = null;
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (token) { const u = await admin.auth.getUser(token).catch(() => null); userId = u?.data?.user?.id ?? null; accountEmail = u?.data?.user?.email ?? null; }

  // At most 5 messages an hour from one connection, and 3 in 10 minutes to one reply address.
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(service), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const clientHash = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip))).slice(0, 32);
  const since = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  const [byClient, byEmail] = await Promise.all([
    admin.from('support_messages').select('id', { count: 'exact', head: true }).eq('client_hash', clientHash).gt('created_at', since(60)),
    admin.from('support_messages').select('id', { count: 'exact', head: true }).eq('email', email).gt('created_at', since(10)),
  ]);
  if ((byClient.count ?? 0) >= 5 || (byEmail.count ?? 0) >= 3) return json({ error: 'too_many' }, 429);

  const row = { user_id: userId, email, topic, message, meta: { ...meta, ...(accountEmail && accountEmail !== email ? { account_email: accountEmail } : {}) }, client_hash: clientHash };
  const ins = await admin.from('support_messages').insert(row).select('id').single();
  if (ins.error) return json({ error: 'not_saved' }, 500);

  let emailed = false; const apiKey = Deno.env.get('RESEND_API_KEY'), to = Deno.env.get('SUPPORT_TO');
  if (apiKey && to) {
    const lines = [message, '', '---', `From: ${email}${userId ? ` (signed in${accountEmail && accountEmail !== email ? ` as ${accountEmail}` : ''})` : ' (not signed in)'}`,
      ...Object.entries(row.meta).map(([k, v]) => `${k}: ${v}`), `Reference: ${ins.data.id}`, '', 'Reply to this email to answer them.'];
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: Deno.env.get('SUPPORT_FROM') ?? 'Clutchly Support <no-reply@clutchly.com.au>', to: [to], reply_to: email,
        subject: `[Clutchly] ${topic}: ${message.replace(/\s+/g, ' ').slice(0, 60)}`, text: lines.join('\n') }) }).catch(() => null);
    emailed = !!r?.ok;
    if (emailed) await admin.from('support_messages').update({ emailed: true }).eq('id', ins.data.id);
  }
  return json({ ok: true, emailed });
});
