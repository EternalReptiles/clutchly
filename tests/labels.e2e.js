// QR labels on the web (app/labels.tsx): pick animals and a size, print; the printed page has one label per animal
// with the right QR code. Same setup as tests/ui.e2e.js. Run: node tests/labels.e2e.js <screenshot-dir>
const { chromium } = require('playwright');
const qrcode = require('qrcode-generator');
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
  const toAnimals = async () => { for (let i = 0; i < 4 && !(await pg.getByRole('tab', { name: 'Animals' }).isVisible().catch(() => false)); i++) { await home(); await pg.waitForTimeout(300); } await tab('Animals'); };
  let fails = 0, n = 0;
  const step = async (name, fn) => { try { await fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + e.message.split('\n').slice(0, 3).join(' / ')); await pg.screenshot({ path: `${SP}/lb-${++n}-FAIL.png`, fullPage: true }).catch(() => {}); } };
  const add = async (name, species) => { await tab('Animals'); await T('+ Add').click(); await L('Name / ID').fill(name);
    if (species) { await L('Species').click(); await L('Search species').fill(species); await B(species).click(); }
    await T('Save', { exact: true }).click(); await T(name, { exact: true }).waitFor(); };
  // A fake camera (the browser's getUserMedia) that films a QR code, for the web Scan button.
  const qrDataUrl = text => { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createDataURL(8, 32); };
  // The film can change mid-scan (window.__qr), so one camera can be shown one label, then another.
  const fakeCamera = src => pg.evaluate(src => {
    window.__qr = src;
    if (window.__fakeCam) return; window.__fakeCam = true;
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement('canvas'); c.width = 640; c.height = 480; const x = c.getContext('2d'); let img = null, shown = null;
      setInterval(() => { if (shown !== window.__qr) { shown = window.__qr; img = new Image(); img.src = shown; }
        x.fillStyle = '#ddd'; x.fillRect(0, 0, 640, 480); if (img?.complete) x.drawImage(img, 170, 90, 300, 300); }, 50);
      return c.captureStream(15);
    };
  }, src);
  const email = `clutchly.lb.${Date.now()}@gmail.com`, pw = 'Lb-test-pass-1'; let lb1 = '';
  // Printing happens in a hidden frame (headless Chromium's print() does nothing); read what would be printed.
  const printed = async () => { for (let i = 0; i < 20; i++) { for (const f of pg.frames()) { const c = await f.locator('.l').count().catch(() => 0); if (c && f !== pg.mainFrame()) return f; } await pg.waitForTimeout(250); } throw new Error('nothing printed'); };

  await pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await step('sign up and add animals', async () => {
    const __e = email, __p = pw; await L('Email').fill(__e); await L('Password').fill(__p); await pg.getByRole('button', { name: await require('./e2eAccount.cjs')(__e, __p), exact: true }).first().click();
    await B('Skip for now').click(); await T('No animals yet. Add some on the Animals tab.').waitFor({ timeout: 10000 });
    await add('LB1', 'Carpet'); await add('LB2'); await add('LB3', 'Bredli');
  });
  await step('Scan button on the web (browser has a camera); Labels opens with nothing ticked', async () => {
    await B('Scan').waitFor(); await T('LB1', { exact: true }).click(); await pg.waitForURL(/animal\/[0-9a-f-]{36}/); lb1 = pg.url().match(/animal\/([0-9a-f-]{36})/)[1]; await home(); await tab('Animals');
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
  await step('home-screen web app: Print opens the site\'s print page, which draws the labels and prints', async () => {
    // Pretend to be the iPhone home-screen app (iOS ignores print there).
    await pg.evaluate(() => { const mm = window.matchMedia.bind(window); window.matchMedia = q => q.includes('standalone') ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q); });
    await B('Labels').click(); await B('Carpet').click(); await B('Tick all shown').click();
    await pg.evaluate(() => { window.open = u => { window.__opened = u; return null; }; });
    await B('Print 2 labels').click(); await pg.waitForFunction(() => window.__opened);
    const url = await pg.evaluate(() => window.__opened);
    if (!/^https:\/\/clutchly\.com\.au\/labels\.html#[A-Za-z0-9_-]+$/.test(url)) throw new Error('opened ' + url);
    // The page as Safari would show it (served from the website; here from the site folder).
    const page = await pg.context().newPage(); await page.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await page.goto('file://' + require('path').resolve(__dirname, '../site/labels.html') + url.slice(url.indexOf('#')));
    await page.locator('.l').first().waitFor({ timeout: 5000 });
    const names = await page.locator('.n').allTextContents(); if (names.join() !== 'LB1,LB2') throw new Error('names ' + names);
    if (await page.locator('.q svg').count() !== 2) throw new Error('QR codes missing');
    if (await page.getByText('Preparing your labels').count()) throw new Error('loading message left on the page');
    await page.getByRole('button', { name: 'Print' }).waitFor(); await page.waitForTimeout(900);
    if (await page.evaluate(() => window.__printed) < 1) throw new Error('print dialog not opened');
    await page.screenshot({ path: `${SP}/lb-c-print-page.png` }); await page.close();
    await pg.reload({ waitUntil: 'networkidle' }); await home(); await tab('Animals');   // back to a normal browser
  });
  await step('Print label on an animal ticks just that animal', async () => {
    await T('LB3', { exact: true }).click(); await B('Print label').click(); await T('Animals (1 ticked)').waitFor();
    if (await pg.getByRole('checkbox', { name: /^LB3 · / }).first().getAttribute('aria-checked') !== 'true') throw new Error('LB3 not ticked');
  });
  await step('web Scan: a label of an animal that isn\'t yours is explained', async () => {
    await toAnimals(); await fakeCamera(qrDataUrl('https://clutchly.com.au/app/animal/00000000-0000-4000-8000-000000000000'));
    await B('Scan').click(); await T("That label is for an animal that isn't in your collection.").waitFor({ timeout: 15000 });
    await pg.getByLabel('Camera').first().screenshot({ path: `${SP}/lb-b-scan.png` }).catch(() => {});
    await toAnimals();
  });
  await step('web Scan: reading a label opens the animal', async () => {
    await fakeCamera(qrDataUrl(`https://clutchly.com.au/app/animal/${lb1}`));
    await B('Scan').click(); await B('Print label').waitFor({ timeout: 15000 });
    if (!pg.url().includes(`/animal/${lb1}`)) throw new Error('opened ' + pg.url());
    if (await L('Name / ID').inputValue() !== 'LB1') throw new Error('wrong animal');
  });
  await step('new pairing: scan both labels to choose the female and the male', async () => {
    await toAnimals(); await T('+ Add').click(); await L('Name / ID').fill('LBM'); await B('Male').click(); await T('Save', { exact: true }).click();
    await T('LBM', { exact: true }).click(); await pg.waitForURL(/animal\/[0-9a-f-]{36}/); const lbm = pg.url().match(/animal\/([0-9a-f-]{36})/)[1]; await toAnimals();
    await tab('Pairings'); await T('+ New pairing').click(); await fakeCamera(qrDataUrl(`https://clutchly.com.au/app/animal/${lb1}`));
    await B('Scan labels').click(); await T('Female: LB1 ✓. Now scan the male.').waitFor({ timeout: 15000 });
    await fakeCamera(qrDataUrl(`https://clutchly.com.au/app/animal/${lbm}`));
    // Choosing the male closes the camera (both are chosen).
    await pg.locator('[aria-checked="true"][aria-label^="LBM,"]').first().waitFor({ timeout: 15000 });
    await pg.locator('video').first().waitFor({ state: 'detached', timeout: 5000 });
    for (const n of ['LB1', 'LBM']) if (await pg.getByRole('radio', { name: new RegExp('^' + n + ',') }).and(live).first().getAttribute('aria-checked') !== 'true') throw new Error(n + ' not chosen');
    await toAnimals();
  });
  await step('label link opened signed out: sign in, then straight to the animal', async () => {
    const p2 = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-AU' })).newPage();
    await p2.goto(`http://localhost:8099/animal/${lb1}`, { waitUntil: 'networkidle' });
    await p2.getByLabel('Email', { exact: true }).fill(email); await p2.getByLabel('Password', { exact: true }).fill(pw);
    await p2.getByRole('button', { name: 'Sign in', exact: true }).click();
    await p2.getByRole('button', { name: 'Print label', exact: true }).first().waitFor({ timeout: 15000 });
    if (await p2.getByLabel('Name / ID', { exact: true }).first().inputValue() !== 'LB1') throw new Error('wrong animal');
    await p2.close();
  });
  await step('cleanup: delete account', async () => {
    await pg.goto('http://localhost:8099/account', { waitUntil: 'networkidle' }); await T('Delete account', { exact: true }).click(); await T('Create account').waitFor({ timeout: 10000 });
  });
  console.log(logs.filter(l => !/^DIALOG: Delete/.test(l)).join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
