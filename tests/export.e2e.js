// Legal links and "Download my data". Run: node --env-file=.env tests/export.e2e.js <screenshot-dir>
const { chromium } = require('playwright');
const fs = require('fs');
const SP = process.argv[2];
const brand = require('../brand.json');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-AU', acceptDownloads: true });
  await ctx.route(`${brand.siteUrl}/**`, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>site</h1>' })); // the site isn't hosted yet
  const pg = await ctx.newPage();
  const logs = []; pg.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  pg.on('console', m => { if (m.text().startsWith('[sync]')) logs.push('SYNC: ' + m.text()); });
  pg.on('dialog', d => { logs.push('DIALOG: ' + d.message().replace(/\n+/g, ' | ')); d.accept(); });
  const live = pg.locator(':not([inert] *)');
  const T = (t, o) => pg.getByText(t, o).and(live).first(); const L = t => pg.getByLabel(t, { exact: true }).and(live).first();
  const B = t => pg.getByRole('button', { name: t, exact: true }).and(live).first();
  const tab = n => pg.getByRole('tab', { name: n }).click();
  let fails = 0, n = 0;
  const step = async (name, fn) => { try { await fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); await pg.screenshot({ path: `${SP}/ex-${++n}-FAIL.png`, fullPage: true }); } };
  const opens = async (label, path) => {
    const [p] = await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }), pg.getByRole('link', { name: label, exact: true }).and(live).first().click()]);
    await p.waitForLoadState(); const url = p.url(); await p.close();
    if (url !== new URL(`${brand.siteUrl}/${path}`).href) throw new Error(`${label} opened ${url}`); // URL() lowercases the host like the browser
  };

  await pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await step('login screen links to privacy, terms and support', async () => {
    await T('By creating an account you agree to the terms of use and privacy policy.').waitFor();
    await opens('Privacy policy', 'privacy.html'); await opens('Terms of use', 'terms.html'); await opens('Support', 'index.html');
  });
  await step('sign up and add records', async () => {
    await L('Email').fill(`clutchly.ex.${Date.now()}@gmail.com`); await L('Password').fill('Ex-test-pass-1'); await B('Create account').click();
    await B('Skip for now').click({ timeout: 15000 });
    for (const [nm, sex] of [['EX-F', 'Female'], ['EX-M', 'Male']]) {
      await tab('Animals'); await T('+ Add').click(); await L('Name / ID').fill(nm); await B(sex).click();
      await L('Species').click(); await L('Search species').fill('carpet'); await pg.getByRole('button', { name: 'Carpet', exact: true }).and(live).first().click();
      await B('Save').click(); await T(nm, { exact: true }).waitFor({ timeout: 8000 });
    }
    await T('EX-F', { exact: true }).click(); await L('Weight (g)').fill('512'); await B('Weight').click(); await T(/512 g$/).waitFor(); await B('Fed').click();
    await pg.getByLabel(/back$/i).and(live).first().click();
    await tab('Pairings'); await T('+ New pairing').click(); await B('EX-F').click(); await B('EX-M').click(); await B('Create').click(); await T('EX-F × EX-M').waitFor({ timeout: 8000 });
  });
  let data;
  await step('Account: Download my data saves a JSON file with every record', async () => {
    await pg.getByRole('button', { name: 'Account', exact: true }).and(live).first().click();
    await opens('Privacy policy', 'privacy.html');
    const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 20000 }), B('Download my data').click()]);
    if (!/^clutchly-data-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename())) throw new Error('name ' + dl.suggestedFilename());
    data = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    await pg.screenshot({ path: `${SP}/ex-a-account.png`, fullPage: true });
  });
  await step('export contents', async () => {
    const names = data.animals.map(a => a.name).sort().join();
    if (names !== 'EX-F,EX-M') throw new Error('animals ' + names);
    if (data.events.length !== 2 || !data.events.some(e => e.kind === 'weight' && Number(e.grams) === 512)) throw new Error('events ' + JSON.stringify(data.events));
    if (data.pairings.length !== 1) throw new Error('pairings');
    if (!data.account.email?.startsWith('clutchly.ex.') || data.exported_from !== 'Clutchly') throw new Error('account block');
    if (JSON.stringify(data).includes('"user_id"')) throw new Error('internal ids leaked');
  });
  await step('cleanup: delete account', async () => { await B('Delete account').click(); await T('Create account').waitFor({ timeout: 10000 }); });
  console.log(logs.filter(l => !l.startsWith('DIALOG: Delete')).join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
