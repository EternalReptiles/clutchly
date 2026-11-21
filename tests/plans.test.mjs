// Free vs Pro, enforced by the database, with Pro status written only by the revenuecat-webhook function.
// Run: RC_AUTH='Bearer ...' CRON_SECRET=... node --env-file=.env tests/plans.test.mjs   ("Confirm email" off)
import { createClient } from '@supabase/supabase-js';
const URL_ = process.env.EXPO_PUBLIC_SUPABASE_URL, KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, RC = process.env.RC_AUTH, CRON = process.env.CRON_SECRET;
if (!URL_ || !KEY || !RC || !CRON) { console.error('Need .env, RC_AUTH and CRON_SECRET'); process.exit(1); }
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const mk = () => createClient(URL_, KEY, { auth: { persistSession: false } });
const ts = Date.now();
const hook = (event, auth = RC) => fetch(`${URL_}/functions/v1/revenuecat-webhook`, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ api_version: '1.0', event }) });
const ev = (type, uid, x = {}) => ({ type, id: crypto.randomUUID(), app_user_id: uid, entitlement_ids: ['pro'], product_id: 'pro_yearly', store: 'APP_STORE', environment: 'SANDBOX',
  event_timestamp_ms: Date.now(), expiration_at_ms: Date.now() + 365 * 864e5, ...x });
const addN = async (c, n, prefix) => { const out = []; for (let i = 0; i < n; i++) out.push(await c.from('animals').insert({ name: `${prefix}${i}`, sex: 'Female' }).select('id').single()); return out; };
const FREE = mk(), PRO = mk();
const f = await FREE.auth.signUp({ email: `clutchly.free.${ts}@gmail.com`, password: 'Plan-pass-123' }), p = await PRO.auth.signUp({ email: `clutchly.pro.${ts}@gmail.com`, password: 'Plan-pass-123' });
const fid = f.data.user.id, pid = p.data.user.id;
try {
  // Webhook
  ok((await hook(ev('INITIAL_PURCHASE', pid), 'Bearer wrong')).status === 401, 'webhook rejects a wrong secret');
  ok((await fetch(`${URL_}/functions/v1/revenuecat-webhook`, { method: 'POST', body: '{}' })).status === 401, 'webhook rejects no secret');
  let res = await (await hook(ev('INITIAL_PURCHASE', pid))).json(); ok(res.updated === 1, 'purchase event recorded');
  let sub = (await PRO.from('subscriptions').select('*').single()).data; ok(sub?.active && sub.product_id === 'pro_yearly', 'Pro user reads own active subscription');
  ok((await (await hook(ev('EXPIRATION', pid, { event_timestamp_ms: Date.now() - 864e5, expiration_at_ms: Date.now() - 864e5 }))).json()).updated === 0, 'older (out-of-order) event ignored');
  ok((await PRO.from('subscriptions').select('active').single()).data.active, 'still Pro after the stale event');
  ok((await (await hook(ev('INITIAL_PURCHASE', '$RCAnonymousID:x'))).json()).updated === 0, 'anonymous RevenueCat id ignored');
  // Nobody can make themselves Pro
  let x = await FREE.from('subscriptions').insert({ user_id: fid, active: true }); ok(!!x.error, 'free user cannot insert a subscription');
  x = await FREE.from('subscriptions').upsert({ user_id: fid, active: true, expires_at: null }); ok(!!x.error, 'free user cannot upsert a subscription');
  x = await PRO.from('subscriptions').update({ expires_at: null }).eq('user_id', pid).select(); ok(!!x.error || !x.data?.length, 'Pro user cannot extend own subscription');
  x = await FREE.from('subscriptions').select('*'); ok(!x.error && x.data.length === 0, "free user cannot see the Pro user's subscription");
  x = await FREE.rpc('is_pro', { uid: pid }); ok(x.data === false, "is_pro won't say whether another user is Pro");
  x = await FREE.from('app_limits').update({ value: 1000 }).eq('key', 'free_animals').select(); ok(!!x.error || !x.data?.length, 'users cannot change the free limit');
  const lim = (await FREE.from('app_limits').select('value').eq('key', 'free_animals').single()).data.value; ok(lim === 10, 'free limit is 10 (from app_limits)');
  // Free limit, enforced by the database
  let rows = await addN(FREE, 9, 'F'); ok(rows.every(r => !r.error), 'free user adds 9 animals');
  const race = await Promise.all([1, 2, 3].map(i => FREE.from('animals').insert({ name: `race${i}`, sex: 'Male' }).select('id').single()));
  ok(race.filter(r => !r.error).length === 1, 'three simultaneous adds at 9 animals: exactly one gets in (no race past the limit)');
  x = await FREE.from('animals').insert({ name: 'F11', sex: 'Female' }); ok(!!x.error && /free_limit_reached/.test(x.error.message), '11th animal refused for a free user: ' + (x.error?.message || ''));
  x = await FREE.from('animals').select('id'); ok(x.data.length === 10, 'free user has exactly 10');
  // Sold animals don't count, but un-selling can't be used to get past the limit.
  const first = (await FREE.from('animals').select('id').order('name').limit(1).single()).data.id;
  x = await FREE.from('animals').update({ status: 'Sold' }).eq('id', first).select(); ok(x.data?.length === 1, 'free user marks an animal Sold');
  x = await FREE.from('animals').insert({ name: 'F11', sex: 'Female' }).select('id').single(); ok(!x.error, 'a Sold animal frees a place: 11th record allowed (10 owned)');
  x = await FREE.from('animals').update({ status: 'Active' }).eq('id', first).select(); ok(!!x.error && /free_limit_reached/.test(x.error.message), 'un-selling at the limit is refused');
  x = await FREE.from('animals').update({ notes: 'still editable' }).eq('id', first).select(); ok(x.data?.length === 1, 'Sold animal can still be edited');
  x = await FREE.from('animals').insert({ name: 'F12', sex: 'Female' }); ok(!!x.error, 'adding another owned animal is refused (10 owned)');
  // Pro
  rows = await addN(PRO, 12, 'P'); ok(rows.every(r => !r.error), 'Pro user adds 12 animals');
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const fa = (await FREE.from('animals').select('id').limit(1).single()).data.id, pa = rows[0].data.id;
  x = await FREE.storage.from('animal-photos').upload(`${fid}/${fa}/a.jpg`, jpg, { contentType: 'image/jpeg' }); ok(!!x.error, 'free user cannot upload a photo');
  x = await FREE.from('animal_photos').insert({ animal_id: fa, path: `${fid}/${fa}/a.jpg` }); ok(!!x.error, 'free user cannot record a photo');
  x = await PRO.storage.from('animal-photos').upload(`${pid}/${pa}/a.jpg`, jpg, { contentType: 'image/jpeg' }); ok(!x.error, 'Pro user uploads a photo');
  x = await PRO.from('animal_photos').insert({ animal_id: pa, path: `${pid}/${pa}/a.jpg` }).select('id').single(); ok(!x.error, 'Pro user records a photo'); const photoId = x.data?.id;
  // Lapse: nothing is lost or locked except adding
  res = await (await hook(ev('EXPIRATION', pid, { expiration_at_ms: Date.now() - 1000 }))).json(); ok(res.updated === 1, 'expiration recorded');
  ok((await PRO.rpc('is_pro', { uid: pid })).data === false, 'lapsed user is no longer Pro');
  x = await PRO.from('animals').select('id'); ok(x.data.length === 12, 'lapsed user still sees all 12 animals');
  x = await PRO.from('animals').update({ notes: 'still editable' }).eq('id', pa).select(); ok(x.data?.length === 1, 'lapsed user can still edit');
  x = await PRO.from('events').insert({ animal_id: pa, kind: 'feed', ok: true }); ok(!x.error, 'lapsed user can still log feeds');
  x = await PRO.storage.from('animal-photos').download(`${pid}/${pa}/a.jpg`); ok(!x.error, 'lapsed user can still view photos');
  x = await PRO.from('animals').insert({ name: 'P13', sex: 'Male' }); ok(!!x.error && /free_limit_reached/.test(x.error.message), 'lapsed user cannot add a 13th animal');
  x = await PRO.storage.from('animal-photos').upload(`${pid}/${pa}/b.jpg`, jpg, { contentType: 'image/jpeg' }); ok(!!x.error, 'lapsed user cannot add photos');
  x = await PRO.from('animal_photos').delete().eq('id', photoId).select(); ok(x.data?.length === 1, 'lapsed user can still delete photos');
  x = await PRO.from('animals').delete().eq('id', rows[11].data.id).select(); ok(x.data?.length === 1, 'lapsed user can still delete animals');
  // Lifetime code
  res = await (await hook(ev('NON_RENEWING_PURCHASE', pid, { product_id: 'pro_lifetime', expiration_at_ms: null }))).json();
  ok(res.updated === 1 && (await PRO.rpc('is_pro', { uid: pid })).data === true, 'lifetime unlock (code) makes the user Pro with no expiry');
  ok(!(await PRO.from('animals').insert({ name: 'P13', sex: 'Male' })).error, 'and adding works again');
  // Notifications only for Pro
  await FREE.from('notification_settings').insert({ notify_hour: 7, timezone: 'Australia/Brisbane' });
  const d = await (await fetch(`${URL_}/functions/v1/daily-digest?dry=1&user=${fid}&at=2026-11-20T21:10:00Z`, { method: 'POST', headers: { 'x-cron-secret': CRON } })).json();
  ok(d.users?.[0]?.skipped === 'not pro', 'morning notifications skipped for free users');
} finally { await FREE.rpc('delete_my_account'); await PRO.rpc('delete_my_account'); }
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
