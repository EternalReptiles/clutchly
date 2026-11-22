// Handing an animal over to its buyer (lib/Handover.tsx, app/claim). Two browsers: the seller makes a link; the buyer
// opens it signed out, signs in and asks; the seller approves. Same setup as tests/ui.e2e.js.
// Run: node --env-file=.env tests/handover.e2e.js <screenshot-dir>. With "Confirm email" on, also set SUPABASE_SECRET_KEY
// (accounts are then created already confirmed, and signed in through the app's sign-in screen).
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
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
  const signUp = async (x, tag) => {
    const email = `clutchly.ho${tag}.${Date.now()}@gmail.com`, password = 'Ho-test-pass-1', sk = process.env.SUPABASE_SECRET_KEY;
    if (sk) { const a = await createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, sk, { auth: { persistSession: false } }).auth.admin.createUser({ email, password, email_confirm: true }); if (a.error) throw a.error; }
    await x.L('Email').fill(email); await x.L('Password').fill(password);
    await x.B(sk ? 'Sign in' : 'Create account').click(); await x.B('Skip for now').click(); };
  let code = '';

  await S.pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await step('seller: account, animal with a feed', async () => {
    await signUp(S, 's'); await S.T('No animals yet. Add some on the Animals tab.').waitFor({ timeout: 10000 });
    await S.tab('Animals'); await S.T('+ Add').click(); await S.T('Enter their handover code').waitFor();
    await S.L('Name / ID').fill('HO1'); await S.L('Species').click(); await S.L('Search species').fill('carpet'); await S.B('Carpet').click();
    await S.T('Save', { exact: true }).click(); await S.T('HO1', { exact: true }).click();
    await S.L('Food').fill('small rat'); await S.B('Fed').click(); await S.T(/· Fed \(small rat\)$/).waitFor();
  });
  const licence = async (x, name, no, region, addr) => { await x.L('Full name (as on the licence)').fill(name); await x.L('Licence number').fill(no);
    await x.B(region).click(); await x.L('Address').fill(addr); await x.B('Save').click(); };
  await step('seller: no link until their licence details are saved', async () => {
    await S.B('Make a handover link').click(); await S.T(/^First, add your full name, wildlife licence number and address/).waitFor();
    if (await S.B('Make link').count()) throw new Error('Make link offered without a licence');
    await S.B('Add my licence details').click(); await licence(S, 'Sam Seller', 'WRL-S1', 'QLD', '1 Python St, Sippy Downs QLD 4556');
    await S.B('Make a handover link').waitFor({ timeout: 10000 });
  });
  await step('seller: make a handover link', async () => {
    await S.B('Make a handover link').click(); await S.T(/Yours: Sam Seller, licence WRL-S1\./).waitFor();
    await S.L('Your name or business (shown to the buyer)').fill('Test Breeder');
    await S.B('Make link').click(); await S.T(/^Waiting for the buyer.*When they ask for it, you'll see their name, licence and address here to approve/).waitFor({ timeout: 10000 });
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
    await U.B('Add my licence details').waitFor({ timeout: 15000 }); await U.T(/^Your full name, wildlife licence number and address go to the seller with your request/).waitFor();
    if (await U.B('Ask to add to my collection').count()) throw new Error('ask offered without a licence');
  });
  await step('buyer: adds their licence from the link and comes back', async () => {
    await U.B('Add my licence details').click();
    await licence(U, 'Bea Buyer', 'WRL-B2', 'NSW', '2 Gecko Rd, Sydney NSW 2000'); await U.B('Ask to add to my collection').waitFor({ timeout: 10000 });
    await U.T('Yours: Bea Buyer, licence WRL-B2, 2 Gecko Rd, Sydney NSW 2000').waitFor();
  });
  await step('buyer: asks; nothing is copied until the seller approves', async () => {
    await U.B('Ask to add to my collection').click(); await U.T('Waiting for Test Breeder to approve').waitFor({ timeout: 15000 }); await U.B('Withdraw request').waitFor();
    await U.pg.screenshot({ path: `${SP}/ho-b2-buyer-waiting.png`, fullPage: true });
  });
  await step('seller: Overview and the animal show the request with the buyer\'s details; approve', async () => {
    await S.pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' }); await S.T('Handover waiting for you').waitFor({ timeout: 15000 });
    await S.T(/^Bea Buyer has asked for HO1\./).click(); await S.T('Bea Buyer has asked for HO1').waitFor({ timeout: 15000 });
    await S.T('Licence WRL-B2 · NSW').waitFor(); await S.T('2 Gecko Rd, Sydney NSW 2000').waitFor();
    if (await S.pg.getByRole('button', { name: 'Sold', exact: true }).first().getAttribute('aria-selected') === 'true') throw new Error('Sold before approval');
    await S.pg.getByLabel('Hand over to buyer').first().screenshot({ path: `${SP}/ho-c0-seller-request.png` }).catch(() => {});
    await S.B('Approve').click(); await S.T(/^Handed over on /).waitFor({ timeout: 20000 });
    if (!logs.some(l => /seller DIALOG: Handed over \| HO1 is in Bea Buyer's collection, and it's marked Sold here\./.test(l))) throw new Error('no confirmation: ' + logs.join(' / '));
  });
  await step('buyer: back to the link, opens the animal with its history and the seller\'s details', async () => {
    await U.pg.reload({ waitUntil: 'networkidle' }); await U.T('Test Breeder approved: HO1 is in your collection.').waitFor({ timeout: 15000 });
    await U.B('Open HO1').click(); await U.T(/· Fed \(small rat\)$/).waitFor({ timeout: 15000 });
    const notes = await U.L('Notes').inputValue(); if (!/^From Test Breeder on /.test(notes)) throw new Error('notes: ' + notes);
    await U.T(/^From Sam Seller on /).waitFor(); await U.T('Licence WRL-S1 · QLD').waitFor(); await U.T('1 Python St, Sippy Downs QLD 4556').waitFor();
    await U.pg.screenshot({ path: `${SP}/ho-c-buyer-animal.png`, fullPage: true });
  });
  await step('seller: sees it handed over and marked Sold', async () => {
    await S.T(/^Handed over on /).waitFor({ timeout: 15000 });
    if (await S.pg.getByRole('button', { name: 'Sold', exact: true }).first().getAttribute('aria-selected') !== 'true') throw new Error('not Sold');
    await S.T('Licence WRL-B2 · NSW').waitFor(); await S.T('2 Gecko Rd, Sydney NSW 2000').waitFor();
  });
  await step('seller: sales and purchases record', async () => {
    await S.pg.goto('http://localhost:8099/records', { waitUntil: 'networkidle' }); await S.T('HO1 · Carpet', { exact: true }).waitFor({ timeout: 10000 });
    await S.T(/· Sold$/).waitFor(); await S.T('Bea Buyer', { exact: true }).waitFor(); await S.T('They received your details (licence WRL-S1).').waitFor();
    await S.pg.screenshot({ path: `${SP}/ho-d-records.png`, fullPage: true });
  });
  await step('the link can\'t be used again (seen by someone else)', async () => {
    const o = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await o.goto(`http://localhost:8099/claim/${code}`, { waitUntil: 'networkidle' }); await o.getByText('This animal has already been added to a collection.').first().waitFor({ timeout: 10000 }); await o.close();
  });
  await step('cleanup: delete both accounts', async () => {
    for (const x of [S, U]) { await x.pg.goto('http://localhost:8099/account', { waitUntil: 'networkidle' }); await x.T('Delete account', { exact: true }).click(); await x.T('Create account').waitFor({ timeout: 10000 }); }
  });
  console.log(logs.filter(l => !/DIALOG: Delete/.test(l)).join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
