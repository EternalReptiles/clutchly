// Creates (or resets) the App Store / Google Play reviewer account and fills it with realistic sample data.
// Run against the project in .env (use your PRODUCTION project's URL and key when preparing the real submission):
//   DEMO_EMAIL=... DEMO_PASSWORD=... node --env-file=.env scripts/seed_demo.mjs
// The account must be Pro so reviewers can see every feature. Grant that once in the Supabase SQL editor
// (the app itself can never do this):
//   insert into subscriptions (user_id, entitlement, active, expires_at, product_id, store, last_event_type, last_event_at)
//   select id, 'pro', true, null, 'review_account', 'PROMOTIONAL', 'MANUAL', now() from auth.users where email = '<DEMO_EMAIL>'
//   on conflict (user_id) do update set active = true, expires_at = null;
// If "Confirm email" is on, confirm the address once (Authentication > Users > the user > Confirm), then run again.
import { createClient } from '@supabase/supabase-js';

const { EXPO_PUBLIC_SUPABASE_URL: URL_, EXPO_PUBLIC_SUPABASE_ANON_KEY: KEY, DEMO_EMAIL: email, DEMO_PASSWORD: password } = process.env;
if (!URL_ || !KEY || !email || !password) { console.error('Set EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, DEMO_EMAIL, DEMO_PASSWORD'); process.exit(1); }
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
const die = (m, e) => { console.error(m, e?.message ?? e ?? ''); process.exit(1); };

let { data, error } = await sb.auth.signInWithPassword({ email, password });
if (error) {
  ({ data, error } = await sb.auth.signUp({ email, password }));
  if (error) die('Sign-up failed:', error);
  if (!data.session) die('Account created; confirm the email address in Supabase (Authentication > Users), then run this again.');
}
const uid = data.user.id;
await sb.auth.updateUser({ data: { onboarded: true, hemisphere: 'south', date_format: 'au', hatchling_pattern: 'DEMO-{YYYY}-{##}' } });

// Start clean (deleting animals also removes their history, pairings and photos).
for (const t of ['animals', 'season_settings']) { const r = await sb.from(t).delete().eq('user_id', uid); if (r.error) die(`Clearing ${t}:`, r.error); }

const day = 864e5, iso = d => new Date(d).toISOString().slice(0, 10), ago = n => iso(Date.now() - n * day);
const animals = [
  ['Ruby', 'Carpet', 'Female', '2021-01-12'], ['Jag', 'Carpet', 'Male', '2020-12-03'], ['Opal', 'Carpet', 'Female', '2022-02-20'],
  ['Banjo', 'Bredli', 'Male', '2021-03-08'], ['Saffron', 'Bredli', 'Female', '2020-11-30'],
  ['Shadow', 'Diamond', 'Male', '2019-12-15'], ['Pearl', 'Diamond', 'Female', '2021-01-25'], ['Pip', "Children's python", 'Female', '2023-01-04'],
].map(([name, species, sex, dob]) => ({ name, species, sex, dob, status: 'Active' }));
const ins = await sb.from('animals').insert(animals).select('id,name,sex');
if (ins.error) die('Adding animals (is the account Pro? see the comment at the top):', ins.error);
const id = Object.fromEntries(ins.data.map(a => [a.name, a]));

// About six months of history per animal: feeds (a few refusals), sheds every ~7-8 weeks, monthly weights that grow.
const events = [];
for (const [i, a] of ins.data.entries()) {
  const every = a.sex === 'Male' ? 21 : 7, base = 300 + i * 180;
  for (let d = 180; d >= 2; d -= every) events.push({ animal_id: a.id, kind: 'feed', on_date: ago(d - (i % 3)), ok: (d + i) % 9 !== 0, food: a.sex === 'Male' ? 'large rat' : 'medium rat' });
  for (let d = 170 - i * 4; d > 0; d -= 52) events.push({ animal_id: a.id, kind: 'shed', on_date: ago(d) });
  for (let m = 6; m >= 0; m--) events.push({ animal_id: a.id, kind: 'weight', on_date: ago(m * 30 + 3), grams: Math.round(base + (6 - m) * (12 + i * 3)) });
}
let r = await sb.from('events').insert(events); if (r.error) die('Adding history:', r.error);

// Routines from the shared templates (southern hemisphere).
const { data: tpl } = await sb.from('species_templates').select('*');
r = await sb.from('season_settings').insert((tpl ?? []).map(({ notes, updated_at, ...t }) => t)); if (r.error) die('Adding routines:', r.error);

// One pairing in progress (locks, ovulation, pre-lay shed) and one that has hatched, with hatchlings.
const p1 = await sb.from('pairings').insert({ female_id: id.Ruby.id, male_id: id.Jag.id, intro: ago(80), removed: ago(40),
  locks: [ago(74), ago(68), ago(61), ago(55)], ovulation: ago(30), prelay_shed: ago(12), notes: 'Strong locks this year.' }).select('id').single();
if (p1.error) die('Adding pairing:', p1.error);
const hatched = ago(20), laid = ago(75);
const p2 = await sb.from('pairings').insert({ female_id: id.Pearl.id, male_id: id.Shadow.id, intro: ago(200), removed: ago(160),
  locks: [ago(195), ago(188), ago(180)], ovulation: ago(124), prelay_shed: ago(100), laid, hatched, clutch: 14, fertile: 12 }).select('id').single();
if (p2.error) die('Adding hatched pairing:', p2.error);
const kids = Array.from({ length: 4 }, (_, k) => ({ name: `DEMO-${hatched.slice(0, 4)}-${String(k + 1).padStart(2, '0')}`, species: 'Diamond', sex: 'Unknown',
  status: 'Active', dob: hatched, mother_id: id.Pearl.id, father_id: id.Shadow.id, pairing_id: p2.data.id }));
const kidRows = await sb.from('animals').insert(kids).select('id'); if (kidRows.error) die('Adding hatchlings:', kidRows.error);
// Hatchlings: first shed, first feeds and a weight, so they look settled in.
r = await sb.from('events').insert(kidRows.data.flatMap((k, j) => [{ animal_id: k.id, kind: 'shed', on_date: ago(10) },
  { animal_id: k.id, kind: 'feed', on_date: ago(8), ok: true, food: 'pinkie mouse' }, { animal_id: k.id, kind: 'feed', on_date: ago(1 + j % 3), ok: j !== 2, food: 'pinkie mouse' },
  { animal_id: k.id, kind: 'weight', on_date: ago(8), grams: 38 + j * 3 }]));
if (r.error) die('Adding hatchling history:', r.error);

console.log(`Demo account ready: ${email} (${ins.data.length + kids.length} animals, ${events.length} history entries, 2 pairings).`);
