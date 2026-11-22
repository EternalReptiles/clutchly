import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import { signUp } from './signup.mjs';
// Handing an animal over to its buyer (migrations 015-020): link, request, seller approval, licences, photos (the
// handover-approve Edge Function). Creates throwaway accounts, then deletes them. With "Confirm email" on, pass the
// project's secret key so the accounts can be created already confirmed (it's only used for that, never in the app).
// Run: RC_AUTH='Bearer ...' SUPABASE_SECRET_KEY=sb_secret_... node --env-file=.env tests/transfer.test.mjs
//      (in a proxied environment add NODE_USE_ENV_PROXY=1)
const makePro = createRequire(import.meta.url)('./makePro.cjs');
const U = process.env.EXPO_PUBLIC_SUPABASE_URL, K = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!U || !K || !process.env.RC_AUTH) { console.error('Need .env and RC_AUTH'); process.exit(1); }
const mk = () => createClient(U, K, { auth: { persistSession: false, autoRefreshToken: false } });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const ts = Date.now(), pw = 'Tr-pass-' + ts;
const user = async tag => {
  const c = mk(); const r = await signUp(c, { email: `clutchly.tr${tag}.${ts}@gmail.com`, password: pw });
  if (r.error || !r.data.session) throw r.error ?? new Error('no session: turn off Confirm email or pass SUPABASE_SECRET_KEY');
  return { c, id: r.data.user.id };
};
const S = await user('s'), B = await user('b'), X = await user('x'), F = await user('f'), N = await user('n');
const one = async q => { const r = await q; if (r.error) throw new Error(r.error.message); return r.data; };
// The whole handover: the buyer asks, the seller approves. Returns the buyer's new animal id.
const hand = async (buyer, code, seller = S) => {
  let r = await buyer.c.rpc('accept_transfer', { p_code: code }); if (r.error) throw new Error('request: ' + r.error.message);
  r = await seller.c.rpc('approve_transfer', { p_code: code }); if (r.error) throw new Error('approve: ' + r.error.message);
  return r.data.new_animal_id;
};
try {
  // Handovers always swap licence details, so everyone taking part has them saved (N has none).
  await one(S.c.from('licences').insert({ full_name: 'Sam Seller', licence_no: 'WRL-111', region: 'QLD', licence_class: 'Recreational', address: '1 Python St, Sippy Downs QLD 4556' }));
  await one(B.c.from('licences').insert({ full_name: 'Bea Buyer', licence_no: 'WRL-222', region: 'NSW', address: '2 Gecko Rd, Sydney NSW 2000' }));
  for (const [u, nm] of [[X, 'Xavier'], [F, 'Fay']]) await one(u.c.from('licences').insert({ full_name: nm, licence_no: 'WRL-' + nm, address: '3 Skink St' }));
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
  ok(p?.name === 'ER101' && p.from_name === 'Eternal Reptiles' && p.feeds === 2 && p.sheds === 1 && p.weights === 1 && !p.accepted && !p.requested, 'signed-out preview from the pasted link (any case, dashes)');
  ok(p?.genes?.length === 2 && p.genes.some(g => g.name === 'Zebra-ish') && p.genes.some(g => g.state === 'het'), 'preview names library and private genes');
  ok(!JSON.stringify(p).includes('WRL-111'), 'preview shows no licence details');
  r = await mk().rpc('transfer_preview', { p_code: 'AAAAAAAAAA' }); ok(r.data === null, 'wrong code previews nothing');
  r = await mk().rpc('accept_transfer', { p_code: code }); ok(!!r.error, 'signed out cannot ask');
  r = await S.c.rpc('accept_transfer', { p_code: code }); ok(r.error?.message?.includes('transfer_own_animal'), 'seller cannot ask for their own');
  r = await S.c.rpc('approve_transfer', { p_code: code }); ok(r.error?.message?.includes('transfer_no_request'), 'nothing to approve before anyone asks');

  // The request: nothing is copied yet; the seller sees the buyer's details, the buyer doesn't see the seller's.
  r = await B.c.rpc('accept_transfer', { p_code: link }); ok(!r.error && r.data === null, 'buyer asks ' + (r.error?.message || ''));
  r = await B.c.from('animals').select('id'); ok(r.data?.length === 0, 'nothing copied before approval');
  r = await S.c.from('animals').select('status').eq('id', a.id); ok(r.data?.[0]?.status === 'Active', 'seller\'s animal not Sold yet');
  r = await S.c.from('transfers').select('requested_by,buyer_licence').eq('code', code); ok(r.data?.[0]?.requested_by === B.id && r.data[0].buyer_licence?.licence_no === 'WRL-222', 'seller sees who asked, with their licence');
  r = await B.c.from('transfers').select('seller_licence').eq('code', code); ok(r.data?.length === 1 && !r.data[0].seller_licence, 'buyer sees their request, without the seller\'s licence');
  r = await B.c.rpc('transfer_preview', { p_code: code }); ok(r.data?.requested_by_me === true, 'buyer\'s preview says they asked');
  r = await X.c.rpc('transfer_preview', { p_code: code }); ok(r.data?.requested === true && !r.data.requested_by_me, 'others see it is taken');
  r = await X.c.rpc('accept_transfer', { p_code: code }); ok(r.error?.message?.includes('transfer_requested'), 'only one request at a time');
  r = await B.c.rpc('approve_transfer', { p_code: code }); ok(r.error?.message?.includes('transfer_not_found'), 'the buyer cannot approve');
  r = await X.c.rpc('decline_transfer', { p_code: code }); r = await S.c.from('transfers').select('requested_by').eq('code', code); ok(r.data?.[0]?.requested_by === B.id, 'only the seller can decline');

  r = await S.c.rpc('approve_transfer', { p_code: code }); ok(!r.error && r.data?.buyer_id === B.id, 'seller approves ' + (r.error?.message || ''));
  const nid = r.data?.new_animal_id;
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
  const tb = (await one(B.c.from('transfers').select('*').eq('code', code)))[0];
  ok(tb?.seller_licence?.licence_no === 'WRL-111' && tb.seller_licence.address?.includes('Sippy Downs') && tb.buyer_licence?.licence_no === 'WRL-222', 'after approval the buyer sees both licences');
  r = await B.c.rpc('transfer_preview', { p_code: code }); ok(r.data?.accepted === true && r.data.new_animal_id === nid, 'buyer\'s preview links to their new animal');
  r = await X.c.rpc('transfer_preview', { p_code: code }); ok(r.data?.accepted === true && !r.data.new_animal_id, 'others only see it was used');
  r = await X.c.rpc('accept_transfer', { p_code: code }); ok(r.error?.message?.includes('transfer_used'), 'a link works only once');
  r = await S.c.rpc('approve_transfer', { p_code: code }); ok(r.error?.message?.includes('transfer_used'), 'and is approved only once');
  r = await S.c.rpc('cancel_transfer', { p_code: code }); r = await S.c.from('transfers').select('accepted_at').eq('code', code); ok(r.data?.[0]?.accepted_at, 'a used link cannot be cancelled');

  // Decline and withdraw: the link works again for someone else.
  const a2 = (await one(S.c.from('animals').insert({ name: 'ER102', species: 'Carpet', sex: 'Female', notes: 'Eats well' }).select()))[0];
  const c2 = (await S.c.rpc('create_transfer', { p_animal: a2.id, p_include_notes: true })).data;
  await X.c.rpc('accept_transfer', { p_code: c2 }); r = await S.c.rpc('decline_transfer', { p_code: c2 });
  r = await S.c.from('transfers').select('requested_by,buyer_licence').eq('code', c2); ok(!r.error && !r.data[0].requested_by && !r.data[0].buyer_licence, 'declining clears the request and the buyer\'s details');
  r = await X.c.from('transfers').select('*').eq('code', c2); ok(r.data?.length === 0, 'a declined buyer can no longer read it');
  await X.c.rpc('accept_transfer', { p_code: c2 }); await X.c.rpc('withdraw_request', { p_code: c2 });
  r = await mk().rpc('transfer_preview', { p_code: c2 }); ok(r.data?.requested === false, 'the buyer can withdraw their request');
  r = await S.c.rpc('cancel_transfer', { p_code: c2 }); r = await mk().rpc('transfer_preview', { p_code: c2 }); ok(r.data === null, 'cancelled link no longer works');
  const c3 = (await S.c.rpc('create_transfer', { p_animal: a2.id, p_include_notes: true })).data; ok(c3 && c3 !== c2, 'new link after cancelling');
  const x2id = await hand(X, c3); const x2 = (await one(X.c.from('animals').select('notes').eq('id', x2id)))[0];
  ok(/^From Sam Seller on .*\nEats well$/.test(x2?.notes ?? ''), 'notes included when ticked; no business name: the licence name; no parents line: ' + JSON.stringify(x2?.notes));

  // A full free plan can't take another animal: refused when asking, and again at approval if it filled up since.
  await one(F.c.from('animals').insert(Array.from({ length: 10 }, (_, i) => ({ name: `F${i}`, species: 'Carpet', sex: 'Female' }))));
  const a3 = (await one(S.c.from('animals').insert({ name: 'ER103', species: 'Carpet', sex: 'Female' }).select()))[0];
  const c4 = (await S.c.rpc('create_transfer', { p_animal: a3.id })).data;
  r = await F.c.rpc('accept_transfer', { p_code: c4 }); ok(r.error?.message?.includes('free_limit_reached'), 'buyer on a full free plan is refused when asking');
  r = await mk().rpc('transfer_preview', { p_code: c4 }); ok(r.data?.requested === false, 'and no request is made');
  await one(F.c.from('animals').update({ status: 'Sold' }).eq('name', 'F0'));
  r = await F.c.rpc('accept_transfer', { p_code: c4 }); ok(!r.error, 'with room, they can ask');
  await one(F.c.from('animals').update({ status: 'Active' }).eq('name', 'F0'));
  r = await S.c.rpc('approve_transfer', { p_code: c4 }); ok(r.error?.message?.includes('free_limit_reached'), 'approval refused if their plan filled up since');
  r = await S.c.from('animals').select('status').eq('id', a3.id); ok(r.data?.[0]?.status === 'Active', 'and nothing changes');
  await makePro(F.id); r = await S.c.rpc('approve_transfer', { p_code: c4 }); ok(!r.error, 'after they go Pro, approval works ' + (r.error?.message || ''));

  // Wildlife licences: private to their owner; required from both; kept as they were at the handover.
  r = await B.c.from('licences').select('*'); ok(r.data?.length === 1 && r.data[0].licence_no === 'WRL-222', 'each person reads only their own licence');
  r = await B.c.from('licences').update({ licence_no: 'HACKED' }).eq('user_id', S.id).select(); ok(!r.data?.length, 'nobody can change someone else\'s licence');
  r = await mk().from('licences').select('*'); ok(!r.data?.length, 'signed out reads no licences');
  r = await X.c.from('transfers').select('*').eq('code', code); ok(r.data?.length === 0, 'a third person cannot read someone else\'s handover');
  await one(S.c.from('licences').update({ licence_no: 'WRL-999' }).eq('user_id', S.id));
  r = await B.c.from('transfers').select('seller_licence').eq('code', code); ok(r.data?.[0]?.seller_licence?.licence_no === 'WRL-111', 'the record keeps the licence as it was at the handover');
  const n1 = (await one(N.c.from('animals').insert({ name: 'N1', species: 'Carpet', sex: 'Male' }).select()))[0];
  r = await N.c.rpc('create_transfer', { p_animal: n1.id }); ok(r.error?.message?.includes('licence_required'), 'no link without your name, licence and address');
  await one(N.c.from('licences').insert({ full_name: 'Nora', licence_no: 'WRL-N' })); r = await N.c.rpc('create_transfer', { p_animal: n1.id });
  ok(r.error?.message?.includes('licence_required'), 'an address is required too');
  const a6 = (await one(S.c.from('animals').insert({ name: 'ER106', species: 'Carpet', sex: 'Male' }).select()))[0];
  const c7 = (await S.c.rpc('create_transfer', { p_animal: a6.id, p_share_licence: false })).data;
  r = await N.c.rpc('accept_transfer', { p_code: c7 }); ok(r.error?.message?.includes('licence_required'), 'buyer cannot ask without their details');
  await B.c.rpc('accept_transfer', { p_code: c7 }); await one(B.c.from('licences').update({ address: '' }).eq('user_id', B.id));
  r = await S.c.rpc('approve_transfer', { p_code: c7 }); ok(r.error?.message?.includes('buyer_licence_missing'), 'buyer who removed their address after asking: seller is told');
  await one(B.c.from('licences').update({ address: '2 Gecko Rd, Sydney NSW 2000' }).eq('user_id', B.id));
  await one(S.c.from('licences').update({ address: '' }).eq('user_id', S.id));
  r = await S.c.rpc('approve_transfer', { p_code: c7 }); ok(r.error?.message?.includes('licence_required'), 'seller who removed their address cannot approve');
  await one(S.c.from('licences').update({ address: '1 Python St, Sippy Downs QLD 4556' }).eq('user_id', S.id));
  r = await S.c.rpc('approve_transfer', { p_code: c7 }); ok(!r.error, 'approves once both are complete, even when an old app said not to share');
  r = await S.c.from('transfers').select('seller_licence,buyer_licence').eq('code', c7); ok(r.data?.[0]?.seller_licence?.licence_no === 'WRL-999' && r.data[0].buyer_licence?.licence_no === 'WRL-222', 'both licences swapped');

  // Photos: copied into the buyer's own folder by the Edge Function (seller is Pro, which adding photos needs).
  await makePro(S.id);
  const a8 = (await one(S.c.from('animals').insert({ name: 'ER108', species: 'Carpet', sex: 'Female' }).select()))[0];
  const jpg = Uint8Array.from(atob('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z'), c => c.charCodeAt(0));
  for (const [i, cover] of [[1, true], [2, false]]) {
    const path = `${S.id}/${a8.id}/p${i}.jpg`;
    await one(S.c.storage.from('animal-photos').upload(path, jpg, { contentType: 'image/jpeg' }));
    await one(S.c.from('animal_photos').insert({ animal_id: a8.id, path, is_cover: cover }));
  }
  const c9 = (await S.c.rpc('create_transfer', { p_animal: a8.id })).data;
  r = await mk().rpc('transfer_preview', { p_code: c9 }); ok(r.data?.photos === 2, 'preview counts the photos');
  await one(B.c.rpc('accept_transfer', { p_code: c9 }));
  const fn = await S.c.functions.invoke('handover-approve', { body: { code: c9 } });
  ok(!fn.error && fn.data?.photos === 2 && fn.data.photos_failed === 0, 'approving through the Edge Function copies both photos ' + JSON.stringify(fn.data ?? fn.error?.message));
  const bp = await one(B.c.from('animal_photos').select('*').eq('animal_id', fn.data?.new_animal_id));
  ok(bp.length === 2 && bp.every(x => x.path.startsWith(`${B.id}/${fn.data.new_animal_id}/`)) && bp.filter(x => x.is_cover).length === 1, 'buyer\'s photo rows are in their own folder, cover kept');
  const dl = await B.c.storage.from('animal-photos').download(bp[0].path); ok(!dl.error && dl.data?.size === jpg.length, 'buyer can open the copied photo');
  r = await S.c.from('animal_photos').select('id').eq('animal_id', a8.id); ok(r.data?.length === 2, 'seller keeps their photos');
  r = await B.c.storage.from('animal-photos').download(`${S.id}/${a8.id}/p1.jpg`); ok(!!r.error, 'buyer still cannot open the seller\'s files');
  const fn2 = await B.c.functions.invoke('handover-approve', { body: { code: c9 } }); ok(!!fn2.error, 'the function refuses someone who isn\'t the seller');
  const fn3 = await mk().functions.invoke('handover-approve', { body: { code: c9 } }); ok(!!fn3.error, 'and anyone signed out');

  // Deleting the seller's animal removes its pending link; accepted records stay.
  const a4 = (await one(S.c.from('animals').insert({ name: 'ER104', species: 'Carpet', sex: 'Female' }).select()))[0];
  const c5 = (await S.c.rpc('create_transfer', { p_animal: a4.id })).data; await one(S.c.from('animals').delete().eq('id', a4.id));
  r = await mk().rpc('transfer_preview', { p_code: c5 }); ok(r.data === null, 'deleting the animal removes its link');
  await one(S.c.from('animals').delete().eq('id', a6.id));
  r = await B.c.from('transfers').select('animal_name,seller_licence').eq('code', c7); ok(r.data?.[0]?.animal_name === 'ER106' && r.data[0].seller_licence, 'record kept after the seller deletes the animal');
} catch (e) { ok(false, 'unexpected: ' + e.message); }
await S.c.rpc('delete_my_account');
{ const r2 = await B.c.from('transfers').select('animal_name,seller_licence').eq('animal_name', 'ER106'); ok(r2.data?.length === 1 && !!r2.data[0].seller_licence, 'buyer keeps the record after the seller deletes their account'); }
for (const u of [B, X, F, N]) await u.c.rpc('delete_my_account');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
