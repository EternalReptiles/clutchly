// Create hatchlings from a pairing. Same setup as tests/ui.e2e.js, plus .env:
//   node --env-file=.env tests/hatchlings.e2e.js <screenshot-dir>
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const pg = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-AU' })).newPage();
  const logs = []; pg.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  pg.on('console', m => { if (m.text().startsWith('[sync]')) logs.push('SYNC: ' + m.text()); });
  pg.on('dialog', d => { logs.push('DIALOG: ' + d.message().replace(/\n+/g, ' | ')); d.accept(); });
  const live = pg.locator(':not([inert] *)');
  const T = (t, o) => pg.getByText(t, o).and(live).first(); const L = t => pg.getByLabel(t, { exact: true }).and(live).first();
  const B = t => pg.getByRole('button', { name: t, exact: true }).and(live).first();
  const tab = n => pg.getByRole('tab', { name: n }).click(); const back = () => pg.getByLabel(/back$/i).and(live).first().click();
  let fails = 0, n = 0;
  const step = async (name, fn) => { try { await fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); await pg.screenshot({ path: `${SP}/hl-${++n}-FAIL.png`, fullPage: true }); } };
  const until = async (fn, ms, msg) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await new Promise(r => setTimeout(r, 500)); } throw new Error(msg); };
  const email = `clutchly.hl.${Date.now()}@gmail.com`, pw = 'Hl-test-pass-1';
  const api = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const addAnimal = async (name, sex) => { await tab('Animals'); await T('+ Add').click(); await L('Name / ID').fill(name); await B(sex).click();
    await L('Species').click(); await L('Search species').fill('diamond'); await pg.getByRole('button', { name: 'Diamond', exact: true }).and(live).first().click();
    await B('Save').click(); await T(name, { exact: true }).waitFor({ timeout: 8000 }); };

  await pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await step('sign up, add a female and a male, pair them', async () => {
    await L('Email').fill(email); await L('Password').fill(pw); await B('Create account').click();
    await T('No animals yet. Add some on the Animals tab.').waitFor({ timeout: 10000 });
    await addAnimal('DM-F1', 'Female'); await addAnimal('DM-M1', 'Male');
    await tab('Pairings'); await T('+ New pairing').click(); await B('DM-F1').click(); await B('DM-M1').click(); await B('Create').click();
    await T('DM-F1 × DM-M1').waitFor({ timeout: 8000 });
  });
  await step('no Create button until there is a hatch date', async () => {
    await T('DM-F1 × DM-M1').click(); await L('Eggs laid').waitFor();
    if (await B('Create hatchlings').count()) throw new Error('shown too early');
    await L('Eggs laid').fill('2026-08-20'); await L('Hatched').fill('2026-10-15'); await B('Create hatchlings').waitFor();
  });
  await step('create 5 hatchlings from 7 eggs (5 fertile) with pattern ER-{YYYY}-{###}', async () => {
    await B('Create hatchlings').click(); await L('Clutch size (eggs laid)').fill('7'); await pg.getByLabel('Fertile eggs', { exact: true }).last().fill('5'); // the dialog's field (the pairing screen behind it has one too)
    if (await L('How many hatchlings to add').inputValue() !== '5') throw new Error('count should follow fertile');
    await L('ID pattern').fill('ER-{YYYY}-{###}');
    await T('ER-2026-001, ER-2026-002, ER-2026-003, ER-2026-004, ER-2026-005', { exact: true }).waitFor();
    await pg.screenshot({ path: `${SP}/hl-a-dialog.png` });
    await B('Create 5').click(); await T('Hatchlings (5)').waitFor({ timeout: 5000 }); await T('ER-2026-003', { exact: true }).waitFor();
    await pg.screenshot({ path: `${SP}/hl-b-pairing.png`, fullPage: true });
  });
  let ids = {};
  await step('server: hatchlings with species, Unknown sex, hatch date, both parents; pairing clutch 7 / fertile 5', async () => {
    await api.auth.signInWithPassword({ email, password: pw });
    await until(async () => ((await api.from('animals').select('id').like('name', 'ER-%')).data ?? []).length === 5, 15000, 'hatchlings not synced');
    const a = (await api.from('animals').select('*')).data; ids = Object.fromEntries(a.map(x => [x.name, x]));
    for (const h of a.filter(x => x.name.startsWith('ER-'))) {
      if (h.species !== 'Diamond' || h.sex !== 'Unknown' || h.dob !== '2026-10-15' || h.mother_id !== ids['DM-F1'].id || h.father_id !== ids['DM-M1'].id || !h.pairing_id) throw new Error(JSON.stringify(h));
    }
    await until(async () => { const p = (await api.from('pairings').select('clutch,fertile,hatched').single()).data; return p.clutch === 7 && p.fertile === 5 && p.hatched === '2026-10-15'; }, 15000, 'pairing not updated');
  });
  await step('animal screens: hatchling shows parents, mother shows offspring', async () => {
    await T('ER-2026-003', { exact: true }).click(); await T('Family', { exact: true }).waitFor({ timeout: 5000 });
    await T('DM-F1', { exact: true }).waitFor(); await T('DM-M1', { exact: true }).waitFor();
    if (await B('Unknown').getAttribute('aria-selected') !== 'true') throw new Error('sex not Unknown');
    await T('DM-F1', { exact: true }).click(); await T('Offspring (5)').waitFor({ timeout: 5000 });
    await pg.screenshot({ path: `${SP}/hl-c-mother.png`, fullPage: true }); await back(); await back();
  });
  await step('create 2 more: warning about existing, numbering continues, pattern remembered', async () => {
    await B('Create hatchlings').click(); await T('5 hatchlings have already been created from this pairing.').waitFor();
    if (await L('ID pattern').inputValue() !== 'ER-{YYYY}-{###}') throw new Error('pattern not remembered');
    if (await L('How many hatchlings to add').inputValue() !== '0') throw new Error('count should be fertile minus existing');
    await L('How many hatchlings to add').fill('2'); await T('ER-2026-006, ER-2026-007', { exact: true }).waitFor();
    await B('Create 2').click(); await T('Hatchlings (7)').waitFor({ timeout: 5000 });
  });
  await step('Unknown-sex hatchlings are not offered as pairing partners', async () => {
    await back(); await T('+ New pairing').click(); await B('DM-F1').waitFor();
    if (await B('ER-2026-001').count()) throw new Error('hatchling offered'); await back();
  });
  await step('delete the mother: hatchlings stay, their mother link is cleared', async () => {
    await tab('Animals'); await T('DM-F1', { exact: true }).click(); await B('Delete').click();
    await T('ER-2026-001', { exact: true }).waitFor({ timeout: 5000 });
    await until(async () => { const a = (await api.from('animals').select('name,mother_id,father_id').like('name', 'ER-%')).data ?? [];
      return a.length === 7 && a.every(x => x.mother_id === null && x.father_id === ids['DM-M1'].id); }, 15000, 'mother links not cleared');
    await T('ER-2026-001', { exact: true }).click(); await T('Family', { exact: true }).waitFor(); await T(/^Parents: \? × DM-M1$/).waitFor();
  });
  await step('cleanup', async () => { await api.rpc('delete_my_account'); });
  console.log(logs.filter(l => !l.startsWith('DIALOG: Delete') && !/hatchlings? added/.test(l)).join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
