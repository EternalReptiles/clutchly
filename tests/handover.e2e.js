// Handing an animal over to its buyer (lib/Handover.tsx, app/claim). Two browsers: the seller makes a link; the buyer
// opens it signed out, creates an account, and accepts. Same setup as tests/ui.e2e.js. Run: node tests/handover.e2e.js <screenshot-dir>
const { chromium } = require('playwright');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const logs = [];
  const page = async tag => {
    const pg = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-AU' })).newPage();
    pg.on('pageerror', e => logs.push(`${tag} PAGEERROR: ` + e.message));
    pg.on('dialog', d => { logs.push(`${tag} DIALOG: ` + d.message().replace(/\n+/g, ' | ')); d.accept(); });
    const live = pg.locator(':not([inert] *)');
    return { pg, T: (t, o) => pg.getByText(t, o).and(live).filter({ visible: true }).first(), L: t => pg.getByLabel(t, { exact: true }).and(live).filter({ visible: true }).first(),
      B: t => pg.getByRole('button', { name: t, exact: true }).and(live).filter({ visible: true }).first(), tab: n => pg.getByRole('tab', { name: n }).click() };
  };
  let fails = 0, n = 0; const S = await page('seller'), U = await page('buyer');
  const step = async (name, fn) => { try { await fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]);
    for (const [k, x] of [['s', S], ['b', U]]) await x.pg.screenshot({ path: `${SP}/ho-${++n}-${k}-FAIL.png`, fullPage: true }).catch(() => {}); } };
  const signUp = async (x, tag) => { await x.L('Email').fill(`clutchly.ho${tag}.${Date.now()}@gmail.com`); await x.L('Password').fill('Ho-test-pass-1');
    await x.T('Create account', { exact: true }).click(); await x.B('Skip for now').click(); };
  let code = '';

  await S.pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await step('seller: account, animal with a feed', async () => {
    await signUp(S, 's'); await S.T('No animals yet. Add some on the Animals tab.').waitFor({ timeout: 10000 });
    await S.tab('Animals'); await S.T('+ Add').click(); await S.T('Enter their handover code').waitFor();
    await S.L('Name / ID').fill('HO1'); await S.L('Species').click(); await S.L('Search species').fill('carpet'); await S.B('Carpet').click();
    await S.T('Save', { exact: true }).click(); await S.T('HO1', { exact: true }).click();
    await S.L('Food').fill('small rat'); await S.B('Fed').click(); await S.T(/· Fed \(small rat\)$/).waitFor();
  });
  await step('seller: make a handover link', async () => {
    await S.B('Make a handover link').click(); await S.L('Your name or business (shown to the buyer)').fill('Test Breeder');
    await S.B('Make link').click(); await S.T(/^Waiting for the buyer/).waitFor({ timeout: 10000 });
    const label = await S.pg.getByLabel(/^Handover code /).first().getAttribute('aria-label'); code = label.replace('Handover code ', '');
    if (!/^[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(code)) throw new Error('code ' + code);
    await S.T(`https://clutchly.com.au/app/claim/${code}`).waitFor();
    await S.pg.screenshot({ path: `${SP}/ho-a-seller-link.png`, fullPage: true });
  });
  await step('buyer: wrong code is explained', async () => {
    await U.pg.goto('http://localhost:8099/claim/AAAAA-AAAAA', { waitUntil: 'networkidle' }); await U.T('Link not found').waitFor({ timeout: 10000 });
  });
  await step('buyer: opens the link signed out and sees the animal', async () => {
    await U.pg.goto(`http://localhost:8099/claim/${code.toLowerCase()}`, { waitUntil: 'networkidle' });
    await U.T('Test Breeder is handing this animal over to you:').waitFor({ timeout: 10000 }); await U.T('HO1', { exact: true }).waitFor();
    await U.T('1 feed · 0 sheds · 0 weights').waitFor(); await U.pg.screenshot({ path: `${SP}/ho-b-buyer-preview.png`, fullPage: true });
  });
  await step('buyer: creates an account and comes back to the link', async () => {
    await U.B('Sign in or create account').click(); await signUp(U, 'b');
    await U.B('Add to my collection').waitFor({ timeout: 15000 });
  });
  await step('buyer: accepts and gets the animal with its history', async () => {
    await U.B('Add to my collection').click(); await U.T(/· Fed \(small rat\)$/).waitFor({ timeout: 15000 });
    const notes = await U.L('Notes').inputValue(); if (!/^From Test Breeder on /.test(notes)) throw new Error('notes: ' + notes);
    await U.pg.screenshot({ path: `${SP}/ho-c-buyer-animal.png`, fullPage: true });
  });
  await step('seller: sees it handed over and marked Sold', async () => {
    await S.pg.reload({ waitUntil: 'networkidle' }); await S.T(/^Handed over on /).waitFor({ timeout: 15000 });
    if (await S.pg.getByRole('button', { name: 'Sold', exact: true }).first().getAttribute('aria-selected') !== 'true') throw new Error('not Sold');
  });
  await step('the link can\'t be used again', async () => {
    await U.pg.goto(`http://localhost:8099/claim/${code}`, { waitUntil: 'networkidle' }); await U.T('This animal has already been added to a collection.').waitFor({ timeout: 10000 });
  });
  await step('cleanup: delete both accounts', async () => {
    for (const x of [S, U]) { await x.pg.goto('http://localhost:8099/account', { waitUntil: 'networkidle' }); await x.T('Delete account', { exact: true }).click(); await x.T('Create account').waitFor({ timeout: 10000 }); }
  });
  console.log(logs.filter(l => !/DIALOG: Delete/.test(l)).join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
