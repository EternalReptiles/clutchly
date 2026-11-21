// Weight chart, stats and history screen. Same setup as tests/ui.e2e.js. Run: node tests/history.e2e.js <screenshot-dir>
const { chromium } = require('playwright');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const pg = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-AU' })).newPage();
  const logs = []; pg.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  pg.on('console', m => { if (m.text().startsWith('[sync]')) logs.push('SYNC: ' + m.text()); });
  pg.on('dialog', d => { logs.push('DIALOG: ' + d.message().replace(/\n+/g, ' | ')); d.accept(); });
  const live = pg.locator(':not([inert] *)');
  const T = (t, o) => pg.getByText(t, o).and(live).first(); const L = t => pg.getByLabel(t, { exact: true }).and(live).first();
  const tab = n => pg.getByRole('tab', { name: n }).click(); const back = () => pg.getByLabel(/back$/i).and(live).first().click();
  let fails = 0, n = 0;
  const step = async (name, fn) => { try { await fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); await pg.screenshot({ path: `${SP}/hi-${++n}-FAIL.png`, fullPage: true }); } };
  const today = new Date(); const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const daysAgo = k => { const d = new Date(today); d.setDate(d.getDate() - k); return iso(d); };
  const log = async (date, button, extra) => { await L('Date').fill(date); if (extra) await extra(); await pg.getByRole('button', { name: button, exact: true }).and(live).first().click(); await pg.waitForTimeout(150); };

  await pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await step('sign up and add an animal', async () => {
    await L('Email').fill(`clutchly.hi.${Date.now()}@gmail.com`); await L('Password').fill('Hi-test-pass-1'); await T('Create account', { exact: true }).click(); await pg.getByRole('button', { name: 'Skip for now', exact: true }).click({ timeout: 15000 });
    await T('No animals yet. Add some on the Animals tab.').waitFor({ timeout: 10000 });
    await tab('Animals'); await T('+ Add').click(); await L('Name / ID').fill('GR1');
    await L('Species').click(); await L('Search species').fill('carpet'); await pg.getByRole('button', { name: 'Carpet', exact: true }).and(live).first().click();
    await T('Save', { exact: true }).click(); await T('GR1', { exact: true }).click(); await T('Log a weight to start the growth chart.', { exact: true }).waitFor();
  });
  await step('log weights, sheds, feeds and refusals on different dates', async () => {
    for (const [k, g] of [[200, '150'], [140, '260'], [80, '390'], [20, '450']]) await log(daysAgo(k), 'Weight', () => L('Weight (g)').fill(g));
    for (const k of [130, 90, 50]) await log(daysAgo(k), 'Shed');
    for (const [k, b2] of [[100, 'Refused'], [60, 'Fed'], [40, 'Refused'], [30, 'Fed'], [10, 'Fed']]) await log(daysAgo(k), b2);
  });
  await step('growth chart summary and stats', async () => {
    await T(/^150 g → 450 g \(\+300 g\) since /).waitFor({ timeout: 5000 });
    await pg.getByRole('img', { name: /^Weight chart: 4 weights from 150 grams/ }).and(live).first().waitFor();
    await T('40 avg', { exact: true }).waitFor();             // sheds 130, 90, 50 days ago
    await T('3 sheds logged', { exact: true }).waitFor();
    await T('25%', { exact: true }).waitFor();                // last 90 days: 60 fed, 40 refused, 30 fed, 10 fed (100 days ago is outside)
    await T('1 of 4 feeds', { exact: true }).waitFor();
    await pg.screenshot({ path: `${SP}/hi-a-animal.png`, fullPage: true });
  });
  await step('tap the chart to read a point', async () => {
    const chart = pg.getByRole('img', { name: /^Weight chart/ }).and(live).first(); const box = await chart.boundingBox();
    await pg.mouse.move(box.x + 50, box.y + box.height / 2); await pg.mouse.down();
    await T(/^\d+ \w+ 2026 · 150 g$/).waitFor({ timeout: 3000 }); await pg.mouse.up();
  });
  await step('full history: filters by type and date range', async () => {
    await pg.getByRole('button', { name: 'Full history (12)' }).and(live).first().click();
    await T('12 of 12 entries · tap one to edit or delete it').waitFor({ timeout: 5000 });
    await T('Weights', { exact: true }).click(); await T('4 of 12 entries · tap one to edit or delete it').waitFor();
    await T('Feeds', { exact: true }).click(); await T('5 of 12 entries · tap one to edit or delete it').waitFor();
    await L('From').fill(daysAgo(65)); await L('To').fill(daysAgo(25)); await T('3 of 12 entries · tap one to edit or delete it').waitFor();
    await pg.screenshot({ path: `${SP}/hi-b-history.png` });
    await T('All', { exact: true }).click(); await T('4 of 12 entries · tap one to edit or delete it').waitFor(); // 65..25 days ago: fed 60, shed 50, refused 40, fed 30
  });
  await step('edit a weight; chart follows', async () => {
    await pg.getByRole('button', { name: 'Clear' }).and(live).first().click(); await pg.getByRole('button', { name: 'Clear' }).and(live).first().click();
    await T('Weights', { exact: true }).click(); await T('450 g', { exact: false }).click();
    await L('Weight (g)').fill('470'); await L('Note').fill('after big meal'); await T('Save', { exact: true }).click();
    await T('after big meal', { exact: true }).waitFor({ timeout: 5000 }); await T(/· 470 g$/).waitFor();
    await back(); await T(/^150 g → 470 g \(\+320 g\) since /).waitFor({ timeout: 5000 });
  });
  await step('edit a refusal into a feed; refusal rate follows', async () => {
    await pg.getByRole('button', { name: /^Full history/ }).and(live).first().click(); await T('Feeds', { exact: true }).click();
    await T(/· Refused$/).click(); // newest refusal (40 days ago)
    await pg.getByRole('button', { name: 'Fed', exact: true }).and(live).last().click(); await T('Save', { exact: true }).click(); await back();
    await T('0%', { exact: true }).waitFor({ timeout: 5000 }); await T('0 of 4 feeds', { exact: true }).waitFor();
  });
  await step('delete an entry from the history screen', async () => {
    await pg.getByRole('button', { name: /^Full history \(12\)/ }).and(live).first().click(); await T('Sheds', { exact: true }).click();
    await T(/· Shed$/).click(); await pg.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await T('2 of 11 entries · tap one to edit or delete it').waitFor({ timeout: 5000 });
  });
  await step('cleanup: delete account', async () => {
    await back(); await back(); await pg.getByRole('button', { name: 'Account', exact: true }).and(live).first().click();
    await T('Delete account', { exact: true }).click(); await T('Create account').waitFor({ timeout: 10000 });
  });
  console.log(logs.filter(l => !l.startsWith('DIALOG: Delete')).join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
