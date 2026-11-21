// Genes, morph names, the morph calculator and hatchling genes. Run: node tests/genes.e2e.js <screenshot-dir>
const { chromium } = require('playwright');
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
  const step = async (name, fn) => { try { await fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); await pg.screenshot({ path: `${SP}/gn-${++n}-FAIL.png`, fullPage: true }); } };
  // Set one gene in the open editor: the gene's row is the block containing its name.
  const setGene = async (gene, choice) => {
    const row = pg.locator('div').filter({ has: pg.getByText(new RegExp(`^${gene} ·`)) }).filter({ has: pg.getByRole('button', { name: choice, exact: true }) }).last();
    await row.getByRole('button', { name: choice, exact: true }).click(); await pg.waitForTimeout(150);
  };
  const addAnimal = async (name, sex) => { await tab('Animals'); await T('+ Add').click(); await L('Name / ID').fill(name); await B(sex).click();
    await L('Species').click(); await L('Search species').fill('carpet'); await pg.getByRole('button', { name: 'Carpet', exact: true }).and(live).first().click();
    await B('Save').click(); await T(name, { exact: true }).waitFor({ timeout: 8000 }); };

  await pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await step('sign up, add a female and a male carpet', async () => {
    await L('Email').fill(`clutchly.gn.${Date.now()}@gmail.com`); await L('Password').fill('Gn-test-pass-1'); await B('Create account').click();
    await B('Skip for now').click({ timeout: 15000 }); await addAnimal('JF', 'Female'); await addAnimal('JM', 'Male');
  });
  await step('female: Jaguar visual, het Albino (descriptions shown)', async () => {
    await T('JF', { exact: true }).click(); await T('No genes recorded.').waitFor(); await B('Edit genes').click();
    await T('Genes · Carpet').waitFor({ timeout: 8000 }); await T(/Heavily reduces dark pigment and alters pattern/).waitFor();
    await setGene('Jaguar', 'Visual'); await setGene('Albino', 'Het');
    await pg.screenshot({ path: `${SP}/gn-a-editor.png` }); await B('Done').click();
    await T('Jaguar het Albino', { exact: true }).waitFor({ timeout: 5000 });
    await B('Edit genes').click(); await T('Genes · Carpet').waitFor();
    const sel = async gene => (await pg.locator('div').filter({ has: pg.getByText(new RegExp(`^${gene} ·`)) }).filter({ has: pg.getByRole('button', { name: 'None', exact: true }) }).last().getByRole('button').evaluateAll(bs => bs.filter(x => x.getAttribute('aria-selected') === 'true').map(x => x.textContent)));
    if ((await sel('Jaguar')).join() !== 'Visual' || (await sel('Albino')).join() !== 'Het') throw new Error('editor shows ' + (await sel('Jaguar')) + ' / ' + (await sel('Albino')));
    await pg.screenshot({ path: `${SP}/gn-a2-editor-reopened.png` }); await B('Done').click(); await back();
  });
  await step('male: Zebra visual, het Albino, Tiger (line-bred); morphs show on the list', async () => {
    await T('JM', { exact: true }).click(); await B('Edit genes').click(); await T('Genes · Carpet').waitFor({ timeout: 8000 });
    await setGene('Zebra', 'Visual'); await setGene('Albino', 'Het'); await setGene('Tiger', 'Has trait'); await B('Done').click();
    await T('Zebra Tiger het Albino', { exact: true }).waitFor({ timeout: 5000 }); await back();
    await T('Jaguar het Albino', { exact: true }).waitFor();
  });
  await step('pairing shows the calculator: odds, possible hets, warnings, line-bred note', async () => {
    await tab('Pairings'); await T('+ New pairing').click(); await B('JF').click(); await B('JM').click();
    await T('Morph calculator', { exact: true }).waitFor();
    // jaguar (ID, one parent) 50/50 · albino het x het 25/50/25 · zebra (ID, one parent) 50/50
    await T('Albino Jaguar Zebra', { exact: true }).waitFor();
    const row = async label => (await pg.getByText(label, { exact: true }).and(live).first().locator('xpath=..').innerText()).replace(label, '').trim();
    if (await row('Albino Jaguar Zebra') !== '6.3%') throw new Error('Albino Jaguar Zebra ' + await row('Albino Jaguar Zebra'));
    if (await row('Jaguar Zebra het Albino') !== '12.5%') throw new Error('Jaguar Zebra het Albino ' + await row('Jaguar Zebra het Albino'));
    await T("Babies that don't show the gene: 67% possible het Albino.").waitFor();
    await T(/^Jaguar · 50%: /).waitFor(); await T(/Tiger from the father/).waitFor();
    await pg.screenshot({ path: `${SP}/gn-b-pairing.png`, fullPage: true });
    await B('Create').click(); await T('JF × JM').waitFor({ timeout: 8000 });
  });
  await step('standalone calculator for any two animals', async () => {
    await B('Morph calculator').click(); await B('JF').click(); await B('JM').click();
    await T('Albino Jaguar Zebra', { exact: true }).waitFor({ timeout: 5000 }); await back();
  });
  await step('hatchlings inherit possible hets from the parents', async () => {
    await T('JF × JM').click(); await L('Eggs laid').fill('2026-08-01'); await L('Hatched').fill('2026-10-01');
    await B('Create hatchlings').click(); await L('How many hatchlings to add').fill('2');
    await T(/Each hatchling will be recorded as 67% pos het Albino/).waitFor();
    await B('Create 2').click(); await T('Hatchlings (2)').waitFor({ timeout: 5000 });
    await T('2026-001', { exact: true }).click(); await T('67% pos het Albino', { exact: true }).waitFor({ timeout: 5000 });
  });
  await step('cleanup', async () => {
    await back(); await back(); await pg.getByRole('button', { name: 'Account', exact: true }).and(live).first().click();
    await B('Delete account').click(); await T('Create account').waitFor({ timeout: 10000 });
  });
  console.log(logs.filter(l => !/^DIALOG: (Delete|\d+ hatchling)/.test(l)).join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
