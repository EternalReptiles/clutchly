import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
// Handing an animal over to its buyer (migration 015). Creates throwaway accounts (needs "Confirm email" off), then deletes them.
// Run: RC_AUTH='Bearer ...' node --env-file=.env tests/transfer.test.mjs   (in a proxied environment add NODE_USE_ENV_PROXY=1)
const makePro = createRequire(import.meta.url)('./makePro.cjs');
const U = process.env.EXPO_PUBLIC_SUPABASE_URL, K = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!U || !K || !process.env.RC_AUTH) { console.error('Need .env and RC_AUTH'); process.exit(1); }
const mk = () => createClient(U, K, { auth: { persistSession: false, autoRefreshToken: false } });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const ts = Date.now(), pw = 'Tr-pass-' + ts;
const user = async tag => { const c = mk(); const r = await c.auth.signUp({ email: `clutchly.tr${tag}.${ts}@gmail.com`, password: pw }); if (r.error) throw r.error; return { c, id: r.data.user.id }; };
const S = await user('s'), B = await user('b'), X = await user('x'), F = await user('f');
const one = async q => { const r = await q; if (r.error) throw new Error(r.error.message); return r.data; };
try {
  // Seller: parents, an animal with history, a library gene, a private gene and notes.
  const [mum, dad] = await one(S.c.from('animals').insert([{ name: 'Ruby', species: 'Carpet', sex: 'Female' }, { name: 'Jag', species: 'Carpet', sex: 'Male' }]).select());
  const a = (await one(S.c.from('animals').insert({ name: 'ER101', species: 'Carpet', sex: 'Male', dob: '2026-02-01', feed_every: 10, notes: 'Private: paid cash', mother_id: mum.id, father_id: dad.id }).select()))[0];
  await one(S.c.from('events').insert([{ animal_id: a.id, kind: 'feed', ok: true, food: 'pinky', on_date: '2026-03-01', note: 'seller note' },
    { animal_id: a.id, kind: 'feed', ok: false, on_date: '2026-03-08' }, { animal_id: a.id, kind: 'shed', on_date: '2026-03-05' }, { animal_id: a.id, kind: 'weight', grams: 42, on_date: '2026-03-10' }]));
  const ug = (await one(S.c.from('user_genes').insert({ species: 'Carpet', name: 'Zebra-ish', inheritance: 'recessive' }).select()))[0];
  await one(S.c.from('animal_genes').insert([{ animal_id: a.id, gene_key: 'carpet-albino', state: 'het' }, { animal_id: a.id, gene_key: `u:${ug.id}`, state: 'visual' }]));

  let r = await B.c.rpc('create_transfer', { p_animal: a.id }); ok(r.error?.message?.includes('transfer_not_found'), 'someone else cannot make a link for my animal');
  r = await S.c.rpc('create_transfer', { p_animal: a.id, p_from_name: 'Eternal Reptiles' }); ok(!r.error && /^[A-Z2-9]{10}$/.test(r.data), 'seller gets a 10-character code');
  const code = r.data;
  r = await S.c.rpc('create_transfer', { p_animal: a.id, p_from_name: 'Eternal Reptiles' }); ok(r.data === code, 'asking again gives the same link');
  r = await B.c.from('transfers').select('*'); ok(!r.error && r.data.length === 0, 'buyer cannot list the transfers table');
  r = await S.c.from('transfers').select('*'); ok(r.data?.length === 1 && r.data[0].code === code, 'seller sees their transfer');
  r = await B.c.from('transfers').update({ seller_id: B.id }).eq('code', code).select(); ok(!!r.error || !r.data?.length, 'nobody can edit the table directly');

  const link = `https://clutchly.com.au/app/claim/${code.slice(0, 5).toLowerCase()}-${code.slice(5)}`;
  r = await mk().rpc('transfer_preview', { p_code: link }); const p = r.data;
  ok(p?.name === 'ER101' && p.from_name === 'Eternal Reptiles' && p.feeds === 2 && p.sheds === 1 && p.weights === 1 && !p.accepted, 'signed-out preview from the pasted link (any case, dashes)');
  ok(p?.genes?.length === 2 && p.genes.some(g => g.name === 'Zebra-ish') && p.genes.some(g => g.state === 'het'), 'preview names library and private genes');
  r = await mk().rpc('transfer_preview', { p_code: 'AAAAAAAAAA' }); ok(r.data === null, 'wrong code previews nothing');
  r = await mk().rpc('accept_transfer', { p_code: code }); ok(!!r.error, 'signed out cannot accept');
  r = await S.c.rpc('accept_transfer', { p_code: code }); ok(r.error?.message?.includes('transfer_own_animal'), 'seller cannot accept their own');

  r = await B.c.rpc('accept_transfer', { p_code: link }); ok(!r.error && !!r.data, 'buyer accepts ' + (r.error?.message || ''));
  const nid = r.data;
  const na = (await one(B.c.from('animals').select('*').eq('id', nid)))[0];
  ok(na && na.name === 'ER101' && na.sex === 'Male' && na.dob === '2026-02-01' && na.feed_every === 10 && na.status === 'Active' && !na.mother_id, 'buyer has the animal');
  ok(/^From Eternal Reptiles on \d{1,2} \w{3} \d{4}\.\nParents: Ruby × Jag$/.test(na?.notes ?? ''), 'notes say who from and the parents, not the seller\'s private notes: ' + JSON.stringify(na?.notes));
  const ev = await one(B.c.from('events').select('*').eq('animal_id', nid).order('on_date'));
  ok(ev.length === 4 && ev[0].food === 'pinky' && ev[0].note === null && ev.some(e => e.kind === 'weight' && Number(e.grams) === 42) && ev.some(e => e.ok === false), 'history copied without the seller\'s event notes');
  const ag = await one(B.c.from('animal_genes').select('*').eq('animal_id', nid));
  const bug = await one(B.c.from('user_genes').select('*'));
  ok(ag.length === 2 && ag.some(g => g.gene_key === 'carpet-albino' && g.state === 'het') && bug.length === 1 && bug[0].name === 'Zebra-ish'
    && ag.some(g => g.gene_key === `u:${bug[0].id}` && g.state === 'visual'), 'genes copied; private gene recreated in the buyer\'s list');
  const sa = (await one(S.c.from('animals').select('status').eq('id', a.id)))[0]; ok(sa.status === 'Sold', 'seller\'s animal now Sold');
  r = await S.c.from('events').select('id').eq('animal_id', a.id); ok(r.data?.length === 4, 'seller keeps their own history');
  r = await mk().rpc('transfer_preview', { p_code: code }); ok(r.data?.accepted === true, 'preview shows it was used');
  r = await X.c.rpc('accept_transfer', { p_code: code }); ok(r.error?.message?.includes('transfer_used'), 'a link works only once');
  r = await S.c.rpc('cancel_transfer', { p_code: code }); r = await S.c.from('transfers').select('accepted_at').eq('code', code); ok(r.data?.[0]?.accepted_at, 'a used link cannot be cancelled');

  // Notes included when the seller ticks it; cancelling.
  const a2 = (await one(S.c.from('animals').insert({ name: 'ER102', species: 'Carpet', sex: 'Female', notes: 'Eats well' }).select()))[0];
  const c2 = (await S.c.rpc('create_transfer', { p_animal: a2.id, p_include_notes: true })).data;
  r = await S.c.rpc('cancel_transfer', { p_code: c2 }); r = await mk().rpc('transfer_preview', { p_code: c2 }); ok(r.data === null, 'cancelled link no longer works');
  const c3 = (await S.c.rpc('create_transfer', { p_animal: a2.id, p_include_notes: true })).data; ok(c3 && c3 !== c2, 'new link after cancelling');
  r = await X.c.rpc('accept_transfer', { p_code: c3 }); const x2 = (await one(X.c.from('animals').select('notes').eq('id', r.data)))[0];
  ok(/^From a breeder on .*\nEats well$/.test(x2?.notes ?? ''), 'seller\'s notes included when ticked; no parents line: ' + JSON.stringify(x2?.notes));

  // A full free plan can't take another animal; Pro can.
  await one(F.c.from('animals').insert(Array.from({ length: 10 }, (_, i) => ({ name: `F${i}`, species: 'Carpet', sex: 'Female' }))));
  const a3 = (await one(S.c.from('animals').insert({ name: 'ER103', species: 'Carpet', sex: 'Female' }).select()))[0];
  const c4 = (await S.c.rpc('create_transfer', { p_animal: a3.id })).data;
  r = await F.c.rpc('accept_transfer', { p_code: c4 }); ok(r.error?.message?.includes('free_limit_reached'), 'buyer on a full free plan is refused');
  r = await mk().rpc('transfer_preview', { p_code: c4 }); ok(r.data?.accepted === false, 'refused accept leaves the link usable');
  r = await S.c.from('animals').select('status').eq('id', a3.id); ok(r.data?.[0]?.status === 'Active', 'and the seller\'s animal untouched');
  await makePro(F.id); r = await F.c.rpc('accept_transfer', { p_code: c4 }); ok(!r.error, 'after going Pro the buyer can accept');

  // Deleting the seller's animal removes its pending link.
  const a4 = (await one(S.c.from('animals').insert({ name: 'ER104', species: 'Carpet', sex: 'Female' }).select()))[0];
  const c5 = (await S.c.rpc('create_transfer', { p_animal: a4.id })).data; await one(S.c.from('animals').delete().eq('id', a4.id));
  r = await mk().rpc('transfer_preview', { p_code: c5 }); ok(r.data === null, 'deleting the animal removes its link');
} catch (e) { ok(false, 'unexpected: ' + e.message); }
for (const u of [S, B, X, F]) await u.c.rpc('delete_my_account');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
