// Browser test for the species list: picker search, per-type pairing screens, estimates, Season fields, import names.
// Same setup as tests/ui.e2e.js. Run: node tests/species.e2e.js <screenshot-dir>
const { chromium } = require('playwright');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const pg = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-AU' })).newPage();
  const logs = []; pg.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  pg.on('console', m => { if (m.text().startsWith('[sync]')) logs.push('SYNC: ' + m.text()); });
  pg.on('dialog', d => { logs.push('DIALOG: ' + d.message().replace(/\n+/g, ' | ')); d.accept(); });
  const live = pg.locator(':not([inert] *)');
  const T = (t, o) => pg.getByText(t, o).and(live).first();
  const L = t => pg.getByLabel(t, { exact: true }).and(live).first();
  const count = (t, o) => pg.getByText(t, o).and(live).count();
  const tab = n => pg.getByRole('tab', { name: n }).click();
  const back = () => pg.getByLabel(/back$/i).and(live).first().click();
  let n = 0; const shot = name => pg.screenshot({ path: `${SP}/sp-${String(++n).padStart(2, '0')}-${name}.png` });
  let fails = 0;
  const step = async (name, fn) => { try { await fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); await shot('FAIL'); } };
  const pickSpecies = async (search, name) => {
    await L('Species').click(); await L('Search species').fill(search);
    await pg.getByRole('button', { name, exact: true }).and(live).first().click();
  };
  const addAnimal = async (nm, sex, search, species) => {
    await tab('Animals'); await T('+ Add').click(); await L('Name / ID').fill(nm); await T(sex, { exact: true }).click();
    await pickSpecies(search, species); await T(species, { exact: true }).waitFor();
    await T('Save', { exact: true }).click(); await T(nm, { exact: true }).waitFor({ timeout: 10000 });
  };
  const pair = async (f, m) => {
    await tab('Pairings'); await T('+ New pairing').click(); await T(f, { exact: true }).click(); await T(m, { exact: true }).click();
    await T('Create', { exact: true }).click(); await T(`${f} × ${m}`).waitFor({ timeout: 8000 }); await T(`${f} × ${m}`).click();
  };

  await pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await step('sign up', async () => {
    await L('Email').fill(`clutchly.sp.${Date.now()}@gmail.com`); await L('Password').fill('Sp-test-pass-1');
    await T('Create account', { exact: true }).click(); await T('No animals yet. Add some on the Animals tab.').waitFor({ timeout: 10000 });
  });
  await step('picker: nickname search, Latin names shown', async () => {
    await tab('Animals'); await T('+ Add').click(); await L('Species').click();
    await L('Search species').fill('bluey'); await T('Tiliqua', { exact: true }).waitFor(); await shot('picker-search');
    await L('Search species').fill('monitor');
    if (await count(/monitor$/i) < 5) throw new Error('expected 5 monitors');
    await L('Search species').fill('zzz'); await T('No match. Choose Other for species not listed.').waitFor();
    await T('Cancel', { exact: true }).click(); await back();
  });
  await step('add blue-tongues and bearded dragons; new animal defaults to last species', async () => {
    await addAnimal('BT1', 'Female', 'bluey', 'Blue-tongue skink');
    await tab('Animals'); await T('+ Add').click(); await T('Blue-tongue skink', { exact: true }).waitFor({ timeout: 8000 }); await back();
    await addAnimal('BT2', 'Male', 'blue', 'Blue-tongue skink');
    await addAnimal('BD1', 'Female', 'pogona', 'Bearded dragon');
    await addAnimal('BD2', 'Male', 'bearded', 'Bearded dragon');
  });
  await step('live-bearer pairing: matings, mating -> estimated birth, born, litter', async () => {
    await pair('BT1', 'BT2'); await T('Matings (0)').waitFor();
    await L('Mating date').fill('2026-07-20'); await T('+ Log mating').click(); await T('Matings (1)').waitFor({ timeout: 8000 });
    for (const gone of ['Pre-lay shed', 'Hatched', 'Fertile eggs', 'Eggs laid']) if (await pg.getByLabel(gone, { exact: true }).and(live).count()) throw new Error(gone + ' should be hidden');
    await L('Born').waitFor(); await L('Litter size').waitFor();
    await L('Mating').fill('2026-08-01'); await T('Save', { exact: true }).click();
    await T('Gravid · estimated birth 14 Nov 2026').waitFor({ timeout: 8000 }); await shot('pairing-live');
    await back(); await T('Gravid · 1 mating · birth ~ 14 Nov 2026').waitFor({ timeout: 8000 });
  });
  await step('egg-laying lizard pairing: no pre-lay shed, estimated lay then hatch', async () => {
    await pair('BD1', 'BD2'); await T('Matings (0)').waitFor();
    if (await pg.getByLabel('Pre-lay shed', { exact: true }).and(live).count()) throw new Error('pre-lay shed should be hidden');
    await L('Mating / ovulation').fill('2026-08-01'); await T('Save', { exact: true }).click();
    await T('Gravid · estimated lay 29 Aug 2026').waitFor({ timeout: 8000 });
    await L('Eggs laid').fill('2026-08-30'); await T('Save', { exact: true }).click();
    await T('Eggs laid · estimated hatch 3 Nov 2026').waitFor({ timeout: 8000 }); await shot('pairing-egg');
    await back(); await T('Eggs laid · 0 matings · hatch ~ 3 Nov 2026').waitFor({ timeout: 8000 });
  });
  await step('Season: only kept species, fields per type, typical ranges', async () => {
    await tab('Season'); await T('Tiliqua', { exact: true }).waitFor({ timeout: 8000 });
    if (await count('Carpet', { exact: true })) throw new Error('Carpet shown but not kept');
    if (await L('Days from mating to birth').getAttribute('placeholder') !== '105 (typical 90–120)') throw new Error('birth placeholder');
    if (await L('Days from mating / ovulation to lay').getAttribute('placeholder') !== '28 (typical 21–35)') throw new Error('lay placeholder');
    if (await L('Days from lay to hatch').getAttribute('placeholder') !== '65 (typical 55–75)') throw new Error('hatch placeholder');
    if (await pg.getByLabel('Days from lay to hatch', { exact: true }).and(live).count() !== 1) throw new Error('hatch field should only show for the dragon');
    if (await pg.getByLabel('Days from pre-lay shed to lay', { exact: true }).and(live).count() !== 0) throw new Error('no pythons kept');
    await shot('season-types');
  });
  await step('Season: add a routine for another species; user number overrides suggestion', async () => {
    await L('Choose species').click(); await L('Search species').fill('woma');
    await pg.getByRole('button', { name: 'Woma', exact: true }).and(live).first().click();
    await T('Aspidites ramsayi', { exact: true }).waitFor({ timeout: 5000 });
    const f = pg.getByLabel('Days from mating to birth', { exact: true }).and(live).first(); await f.fill('100'); await f.blur(); await pg.waitForTimeout(1500);
    await tab('Pairings'); await T('Gravid · 1 mating · birth ~ 9 Nov 2026').waitFor({ timeout: 8000 });
  });
  await step('import recognises new species names', async () => {
    await tab('Animals'); await T('Bulk add', { exact: true }).click();
    await L('Paste here').fill('GT1, GTP, F\nSH1, Tiliqua rugosa, M\nLM1, lace monitor, F\nX1, Boa, F');
    await T('3 ready to import · 1 with problems (skipped)').waitFor({ timeout: 5000 });
    await T(/GT1 · Green tree python · Female/).waitFor(); await T(/SH1 · Shingleback · Male/).waitFor();
    await T('Line 4: Unknown species "Boa". Use a name from the species list (or Other)').waitFor(); await shot('import-species');
    await back();
  });
  await step('cleanup: delete account', async () => {
    await pg.getByRole('button', { name: 'Account', exact: true }).and(live).first().click(); await T('Delete account', { exact: true }).click(); await T('Create account').waitFor({ timeout: 10000 });
  });
  console.log(logs.join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
