// Feed several animals at once (app/feed.tsx). Same setup as tests/ui.e2e.js. Run: node tests/feed.e2e.js <screenshot-dir>
const { chromium } = require('playwright');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const pg = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-AU' })).newPage();
  const logs = []; pg.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  pg.on('console', m => { if (m.text().startsWith('[sync]')) logs.push('SYNC: ' + m.text()); });
  pg.on('dialog', d => { logs.push('DIALOG: ' + d.message().replace(/\n+/g, ' | ')); d.accept(); });
  const live = pg.locator(':not([inert] *)');
  const T = (t, o) => pg.getByText(t, o).and(live).first(); const L = t => pg.getByLabel(t, { exact: true }).and(live).first();
  const B = t => pg.getByRole('button', { name: t, exact: true }).and(live).filter({ visible: true }).first();
  const tab = n => pg.getByRole('tab', { name: n }).click(); const back = () => pg.getByLabel(/back$/i).and(live).first().click();
  const checked = async name => (await pg.getByRole('checkbox', { name, exact: true }).and(live).first().getAttribute('aria-checked')) === 'true';
  let fails = 0, n = 0;
  const step = async (name, fn) => { try { await fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); await pg.screenshot({ path: `${SP}/fd-${++n}-FAIL.png`, fullPage: true }).catch(() => {}); } };
  const add = async (name, species) => {
    await tab('Animals'); await T('+ Add').click(); await L('Name / ID').fill(name);
    if (species) { await L('Species').click(); await L('Search species').fill(species); await B(species).click(); }
    await T('Save', { exact: true }).click(); await T(name, { exact: true }).waitFor();
  };

  await pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await step('sign up and add three carpets and a bredli', async () => {
    const email = `clutchly.fd.${Date.now()}@gmail.com`, btn = await require('./e2eAccount.cjs')(email, 'Fd-test-pass-1');
    await L('Email').fill(email); await L('Password').fill('Fd-test-pass-1'); await B(btn).click();
    await B('Skip for now').click(); await T('No animals yet. Add some on the Animals tab.').waitFor({ timeout: 10000 });
    await add('FD1', 'Carpet'); await add('FD2'); await add('FD3'); await add('FD4', 'Bredli');
  });
  await step('Animals tab shows the total, by sex, and the free plan count; search shows how many match', async () => {
    await tab('Animals'); await T('4 animals', { exact: true }).waitFor({ timeout: 5000 }); await T(/· 4 female · 4 of 10 on the free plan$/).waitFor();
    await pg.getByPlaceholder('Search').and(live).first().fill('FD4'); await T('Showing 1 of 4', { exact: true }).waitFor();
    await pg.screenshot({ path: `${SP}/fd-0-total.png` }); await pg.getByPlaceholder('Search').and(live).first().fill('');
  });
  await step('Overview offers to feed all 4 due, all marked fed', async () => {
    await tab('Overview'); await B('Feed all 4').click(); await T('Food (for everyone fed)').waitFor();
    for (const a of ['FD1', 'FD2', 'FD3', 'FD4']) if (!await checked(`${a} fed`)) throw new Error(`${a} not marked fed`);
    await B('Save 4 fed').waitFor();
    await pg.screenshot({ path: `${SP}/fd-a-screen.png`, fullPage: true });
  });
  await step('mark one refused, leave one out, set food, save', async () => {
    await L('Food (for everyone fed)').fill('medium rat');
    await pg.getByRole('checkbox', { name: 'FD2 refused', exact: true }).and(live).first().click();
    await pg.getByRole('checkbox', { name: 'FD3 fed', exact: true }).and(live).first().click();     // tap again: left out
    if (await checked('FD2 fed') || !await checked('FD2 refused') || await checked('FD3 fed')) throw new Error('marks wrong');
    await B('Save 2 fed, 1 refused').click(); await T('Feeds due now', { exact: true }).waitFor();
    if (!logs.some(l => /^DIALOG: Saved \| 2 fed, 1 refused on /.test(l))) throw new Error('no saved message: ' + logs.join(' / '));
  });
  await step('Overview: only the left-out animal still due; last 7 days counted', async () => {
    await T('2 fed · 1 refused · 0 sheds · 0 weights', { exact: true }).waitFor({ timeout: 5000 });
    await B('Feed several').waitFor();          // one animal due
    await T('FD3', { exact: true }).waitFor();
  });
  await step('the food and result are on the animal', async () => {
    await tab('Animals'); await T('FD1', { exact: true }).click(); await T('Fed (medium rat)').waitFor(); await back();
    await T('FD2', { exact: true }).click(); await T('Refused (medium rat)').waitFor(); await back();
  });
  await step('from the Animals tab nothing is marked; species filter and Mark all', async () => {
    await B('Feed').click(); await T('Food (for everyone fed)').waitFor(); await B('Mark animals to save').waitFor();
  });
  await step('species filter', async () => { await B('Bredli').click(); if (await T('FD1', { exact: true }).isVisible()) throw new Error('filter did not hide carpets'); });
  await step('mark all shown', async () => { await B('Mark all as fed').click(); await B('Save 1 fed').waitFor(); });
  await step('back to all species and clear', async () => { await B('All species').click(); await B('Clear').click(); await B('Mark animals to save').waitFor(); await B('Save 1 fed').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {}); });
  await step('save from the Animals tab', async () => {
    await pg.screenshot({ path: `${SP}/fd-b-animals-tab.png`, fullPage: true });
    await pg.getByRole('checkbox', { name: 'FD3 fed', exact: true }).and(live).first().click(); await B('Save 1 fed').click();
    await T('+ Add').waitFor(); await tab('Overview'); await T('Nothing due today.', { exact: true }).waitFor();
    await T('3 fed · 1 refused · 0 sheds · 0 weights', { exact: true }).waitFor();
  });
  await step('cleanup: delete account', async () => {
    await pg.getByRole('button', { name: 'Account', exact: true }).and(live).first().click();
    await T('Delete account', { exact: true }).click(); await T('Create account').waitFor({ timeout: 10000 });
  });
  console.log(logs.filter(l => !/^DIALOG: (Delete|Saved)/.test(l)).join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
