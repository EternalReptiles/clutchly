import { createClient } from '@supabase/supabase-js';
// Backend + row-level-security test. Creates throwaway accounts (needs "Confirm email" off), then deletes them.
// Run: node --env-file=.env tests/rls.test.mjs   (in a proxied environment add NODE_USE_ENV_PROXY=1)
const U = process.env.EXPO_PUBLIC_SUPABASE_URL, K = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!U || !K) { console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (node --env-file=.env ...)'); process.exit(1); }
const mk = () => createClient(U, K, { auth: { persistSession: false, autoRefreshToken: false } });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const ts = Date.now(), pw = 'Test-pass-' + ts;
const A = mk(), B = mk();
const anonClient = mk;
const ea = `clutchly.test.a.${ts}@gmail.com`, eb = `clutchly.test.b.${ts}@gmail.com`;
let r = await A.auth.signUp({ email: ea, password: pw }); ok(!r.error && r.data.session, 'A sign up ' + (r.error?.message || ''));
r = await B.auth.signUp({ email: eb, password: pw }); ok(!r.error && r.data.session, 'B sign up ' + (r.error?.message || ''));
await A.auth.signOut({ scope: 'local' });
r = await A.auth.signInWithPassword({ email: ea, password: pw }); ok(!r.error, 'A sign in ' + (r.error?.message || ''));
r = await A.auth.signInWithPassword({ email: ea, password: 'wrong' }); ok(!!r.error, 'wrong password rejected');
r = await A.auth.signInWithPassword({ email: ea, password: pw });

// A: add animals, feed, pairing, lock, season
const f = await A.from('animals').insert({ name: 'ER001', species: 'Carpet', sex: 'Female' }).select().single(); ok(!f.error, 'A add female ' + (f.error?.message || ''));
const m = await A.from('animals').insert({ name: 'ER002', species: 'Carpet', sex: 'Male' }).select().single(); ok(!m.error, 'A add male');
const ev = await A.from('events').insert({ animal_id: f.data.id, kind: 'feed', ok: true, food: 'rat', on_date: '2026-11-20' }).select().single(); ok(!ev.error, 'A log feed ' + (ev.error?.message || ''));
const st = await A.from('animal_status').select('*').eq('id', f.data.id).single(); ok(st.data?.last_feed === '2026-11-20', 'view shows last_feed ' + st.data?.last_feed);
const p = await A.from('pairings').insert({ female_id: f.data.id, male_id: m.data.id, locks: [] }).select().single(); ok(!p.error, 'A create pairing ' + (p.error?.message || ''));
const lk = await A.from('pairings').update({ locks: ['2026-06-10'] }).eq('id', p.data.id).select().single(); ok(lk.data?.locks?.[0] === '2026-06-10', 'A log lock');
const ss = await A.from('season_settings').upsert({ species: 'Carpet', pause_from: '05-01', pause_to: '05-31', pair_start: '06-01', female_every: 7, male_every: 21, prelay_to_lay: 30, ovul_to_lay: 45 }, { onConflict: 'user_id,species' }).select(); ok(!ss.error, 'A save season ' + (ss.error?.message || ''));
const ss2 = await A.from('season_settings').upsert({ species: 'Carpet', pause_from: '04-15', pause_to: '05-31', pair_start: '06-01', female_every: 7, male_every: 21, prelay_to_lay: 30, ovul_to_lay: 45 }, { onConflict: 'user_id,species' }).select(); ok(ss2.data?.length === 1 && ss2.data[0].pause_from === '04-15', 'A update season (upsert, no duplicate)');

// B: must not see or touch A's data
for (const t of ['animals', 'events', 'pairings', 'season_settings', 'animal_status']) {
  const x = await B.from(t).select('*'); ok(!x.error && x.data.length === 0, `B sees 0 rows in ${t} (got ${x.data?.length} ${x.error?.message || ''})`);
}
let x = await B.from('animals').update({ name: 'hacked' }).eq('id', f.data.id).select(); ok(!x.data?.length, 'B cannot update A animal');
x = await B.from('animals').delete().eq('id', f.data.id).select(); ok(!x.data?.length, 'B cannot delete A animal');
x = await B.from('events').insert({ animal_id: f.data.id, kind: 'feed', ok: true }); ok(!!x.error, 'B cannot log event on A animal');
x = await B.from('animals').insert({ name: 'spoof', user_id: r.data.user.id }); ok(!!x.error, 'B cannot insert row owned by A');
const bf = await B.from('animals').insert({ name: 'B1', sex: 'Female' }).select().single();
x = await B.from('pairings').insert({ female_id: bf.data.id, male_id: m.data.id }); ok(!!x.error, "B cannot pair with A's male");
x = await B.from('pairings').update({ locks: ['2026-01-01'] }).eq('id', p.data.id).select(); ok(!x.data?.length, 'B cannot edit A pairing');
x = await A.from('animals').select('*').eq('id', f.data.id).single(); ok(x.data?.name === 'ER001', 'A animal intact');
const anon = mk(); x = await anon.from('animals').select('*'); ok(!!x.error || x.data.length === 0, 'logged-out sees nothing');
x = await anon.rpc('delete_my_account'); ok(!!x.error, 'logged-out cannot call delete_my_account');

// Push notifications: tokens and settings are private, and a token can only belong to one account.
const tok = 'ExponentPushToken[rls-test-' + ts + ']';
x = await A.rpc('register_device_token', { p_token: tok, p_platform: 'ios' }); ok(!x.error, 'A registers a device token ' + (x.error?.message || ''));
x = await A.from('notification_settings').insert({ notify_hour: 6, timezone: 'Australia/Perth' }); ok(!x.error, 'A saves notification settings');
for (const tb of ['device_tokens', 'notification_settings']) { x = await B.from(tb).select('*'); ok(!x.error && x.data.length === 0, `B sees 0 rows in ${tb}`); }
x = await B.from('device_tokens').delete().eq('token', tok).select(); ok(!x.data?.length, "B cannot delete A's token");
x = await B.from('notification_settings').update({ notify_hour: 1 }).eq('user_id', r.data.user.id).select(); ok(!x.data?.length, "B cannot change A's settings");
x = await B.from('device_tokens').insert({ token: 'ExponentPushToken[sneaky]', platform: 'ios' }); ok(!!x.error, 'direct token insert refused (must use the RPC)');
x = await anonClient().rpc('register_device_token', { p_token: 'ExponentPushToken[anon]', p_platform: 'ios' }); ok(!!x.error, 'logged-out cannot register a token');
x = await B.rpc('register_device_token', { p_token: tok, p_platform: 'ios' }); ok(!x.error, 'same phone signs in as B: token moves to B');
x = await A.from('device_tokens').select('*'); ok(x.data?.length === 0, "A no longer gets notifications on B's phone");
x = await B.from('device_tokens').select('token'); ok(x.data?.length === 1 && x.data[0].token === tok, 'B owns the token now');

// Delete accounts
x = await B.rpc('delete_my_account'); ok(!x.error, 'B delete account ' + (x.error?.message || ''));
x = await A.from('animals').select('id'); ok(x.data?.length === 2, 'A data survives B deletion');
x = await A.rpc('delete_my_account'); ok(!x.error, 'A delete account ' + (x.error?.message || ''));
x = await mk().auth.signInWithPassword({ email: ea, password: pw }); ok(!!x.error, 'A cannot sign in after deletion');
const A2 = mk(); await A2.auth.signUp({ email: ea, password: pw }); x = await A2.from('animals').select('*'); ok(x.data?.length === 0, 'A data was deleted with account');
await A2.rpc('delete_my_account');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
