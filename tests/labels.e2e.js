// QR labels on the web (app/labels.tsx): pick animals and a size, print; the printed page has one label per animal
// with the right QR code. Same setup as tests/ui.e2e.js. Run: node tests/labels.e2e.js <screenshot-dir>
const { chromium } = require('playwright');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const pg = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-AU' })).newPage();
  const logs = []; pg.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  pg.on('dialog', d => { logs.push('DIALOG: ' + d.message().replace(/\n+/g, ' | ')); d.accept(); });
  const live = pg.locator(':not([inert] *)');
  const T = (t, o) => pg.getByText(t, o).and(live).filter({ visible: true }).first(); const L = t => pg.getByLabel(t, { exact: true }).and(live).filter({ visible: true }).first();
  const B = t => pg.getByRole('button', { name: t, exact: true }).and(live).filter({ visible: true }).first();
  const tab = n => pg.getByRole('tab', { name: n }).click(); // Web shows Back, or Home when there's no screen to go back to.
  const home = () => pg.getByLabel(/back$|^Home$/i).filter({ visible: true }).first().click();
  let fails = 0, n = 0;
  const step = async (name, fn) => { try { await fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + e.message.split('\n').slice(0, 3).join(' / ')); await pg.screenshot({ path: `${SP}/lb-${++n}-FAIL.png`, fullPage: true }).catch(() => {}); } };
  const add = async (name, species) => { await tab('Animals'); await T('+ Add').click(); await L('Name / ID').fill(name);
    if (species) { await L('Species').click(); await L('Search species').fill(species); await B(species).click(); }
    await T('Save', { exact: true }).click(); await T(name, { exact: true }).waitFor(); };
  // Printing happens in a hidden frame (headless Chromium's print() does nothing); read what would be printed.
  const printed = async () => { for (let i = 0; i < 20; i++) { for (const f of pg.frames()) { const c = await f.locator('.l').count().catch(() => 0); if (c && f !== pg.mainFrame()) return f; } await pg.waitForTimeout(250); } throw new Error('nothing printed'); };

  await pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await step('sign up and add animals', async () => {
    await L('Email').fill(`clutchly.lb.${Date.now()}@gmail.com`); await L('Password').fill('Lb-test-pass-1'); await T('Create account', { exact: true }).click();
    await B('Skip for now').click(); await T('No animals yet. Add some on the Animals tab.').waitFor({ timeout: 10000 });
    await add('LB1', 'Carpet'); await add('LB2'); await add('LB3', 'Bredli');
  });
  await step('no Scan button on the web; Labels opens with nothing ticked', async () => {
    if (await B('Scan').count()) throw new Error('Scan shown on web');
    await B('Labels').click(); await B('Tick animals to print').waitFor(); await T('Animals (0 ticked)').waitFor();
  });
  await step('tick a species, preview, print an A4 sheet skipping 2 used labels', async () => {
    await B('Carpet').click(); await B('Tick all shown').click(); await T('Animals (2 ticked)').waitFor();
    await pg.getByLabel(/^Label preview for LB/).first().waitFor();
    await L('Labels already used on the first sheet (skip them)').fill('2');
    await pg.screenshot({ path: `${SP}/lb-a-screen.png`, fullPage: true });
    await B('Print 2 labels (1 sheet)').click(); const f = await printed();
    const slots = await f.locator('.l').count(), names = await f.locator('.n').allTextContents();
    if (slots !== 4 || names.join() !== 'LB1,LB2') throw new Error(`slots ${slots} names ${names}`);
    const page = await f.evaluate(() => [...document.styleSheets[0].cssRules].map(r => r.cssText).join(' '));
    if (!/size: 210mm 297mm/.test(page)) throw new Error('not an A4 page: ' + page.slice(0, 120));
    if (await f.locator('.q svg').count() !== 2) throw new Error('QR codes missing');
  });
  await step('label printer size: one per page, size remembered', async () => {
    await B('All species').click(); await pg.getByRole('radio', { name: /^Label printer, 62 × 29 mm/ }).first().click();
    if (await L('Labels already used on the first sheet (skip them)').count()) throw new Error('skip shown for a label printer');
    await B('Print 2 labels').click();
    await home(); await tab('Animals'); await B('Labels').click();
    if (await pg.getByRole('radio', { name: /^Label printer, 62 × 29 mm/ }).first().getAttribute('aria-checked') !== 'true') throw new Error('size not remembered');
    await home(); await tab('Animals');
  });
  await step('Print label on an animal ticks just that animal', async () => {
    await T('LB3', { exact: true }).click(); await B('Print label').click(); await T('Animals (1 ticked)').waitFor();
    if (await pg.getByRole('checkbox', { name: /^LB3 · / }).first().getAttribute('aria-checked') !== 'true') throw new Error('LB3 not ticked');
  });
  await step('scan page explains phones on the web', async () => {
    await pg.goto('http://localhost:8099/scan', { waitUntil: 'networkidle' }); await T(/^Scan labels with your phone/).waitFor({ timeout: 10000 });
  });
  await step('cleanup: delete account', async () => {
    await pg.goto('http://localhost:8099/account', { waitUntil: 'networkidle' }); await T('Delete account', { exact: true }).click(); await T('Create account').waitFor({ timeout: 10000 });
  });
  console.log(logs.filter(l => !/^DIALOG: Delete/.test(l)).join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
