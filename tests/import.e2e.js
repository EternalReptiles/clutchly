// Browser test for Bulk add / CSV import. Same setup as tests/ui.e2e.js. Run: node tests/import.e2e.js <screenshot-dir>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
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
  let n = 0; const shot = name => pg.screenshot({ path: `${SP}/imp-${String(++n).padStart(2, '0')}-${name}.png`, fullPage: true });
  let fails = 0;
  const step = async (name, fn) => { try { await fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); await shot('FAIL'); } };
  const email = `clutchly.imp.${Date.now()}@gmail.com`;

  await pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await step('sign up, add ER001 by hand', async () => {
    await L('Email').fill(email); await L('Password').fill('Imp-test-pass-1'); await T('Create account', { exact: true }).click(); await pg.getByRole('button', { name: 'Skip for now', exact: true }).click({ timeout: 15000 });
    await T('No animals yet. Add some on the Animals tab.').waitFor({ timeout: 10000 });
    await pg.getByRole('tab', { name: 'Animals' }).click(); await T('+ Add').click(); await L('Name / ID').fill('ER001');
    await L('Species').click(); await L('Search species').fill('carpet');
    await pg.getByRole('button', { name: 'Carpet', exact: true }).and(live).first().click();
    await T('Save', { exact: true }).click(); await T('ER001', { exact: true }).waitFor({ timeout: 8000 });
  });
  await step('paste lines -> preview shows ready rows and problems', async () => {
    await T('Bulk add', { exact: true }).click(); await L('Paste here').waitFor();
    await L('Paste here').fill(['ER001, Carpet, F', 'ER002, Carpet, M, 1/12/2023', 'ER003, Bredli, F, 03/04/2024, 14/11/2026',
      'ER004, Diamond, Male', 'ER005, Boa, F', 'ER006, Antaresia, X', 'ER004, Carpet, F'].join('\n'));
    await T('3 ready to import · 4 with problems (skipped)').waitFor({ timeout: 5000 });
    await T('Line 1: "ER001" is already in your collection').waitFor();
    await T(/ER003 · Bredli · Female · hatched 3 Apr 2024 · fed 14 Nov 2026/).waitFor();
    await T('Line 7: Duplicate of line 4').waitFor(); await shot('preview');
  });
  await step('import -> report, bad rows left in box', async () => {
    await T('Import 3 animals').click(); await T('Imported 3 animals').waitFor({ timeout: 15000 });
    await T('4 rows not imported:').waitFor(); await shot('result');
    const left = await L('Paste here').inputValue();
    if (left.split('\n').length !== 4 || !left.startsWith('ER001')) throw new Error('box should hold the 4 failed rows, got: ' + JSON.stringify(left));
  });
  await step('animals list has imported rows with last feed', async () => {
    await T('Done').click(); await T(/Bredli · Female · fed 14 Nov 2026/).waitFor({ timeout: 8000 });
    await T('ER004', { exact: true }).waitFor(); await shot('animals');
  });
  await step('CSV file upload with header, quotes, CRLF', async () => {
    const f = path.join(SP, 'collection.csv');
    fs.writeFileSync(f, '﻿Name,Species,Sex,Hatch date,Last feed\r\n"Tiger, big",Carpet,F,2022-01-05,10/11/2026\r\nER010,Diamond,M,,\r\nER002,Carpet,M,,\r\n');
    await T('Bulk add', { exact: true }).click();
    const [fc] = await Promise.all([pg.waitForEvent('filechooser'), T('Choose CSV file').click()]);
    await fc.setFiles(f);
    await T('2 ready to import · 1 with problems (skipped)').waitFor({ timeout: 8000 }); await shot('csv-preview');
    await T('Import 2 animals').click(); await T('Imported 2 animals').waitFor({ timeout: 15000 });
    const left = await L('Paste here').inputValue();
    if (!left.startsWith('Name,Species') || !left.includes('ER002')) throw new Error('header + failed row expected, got: ' + JSON.stringify(left));
    await T('Done').click(); await T('Tiger, big', { exact: true }).waitFor({ timeout: 8000 });
  });
  await step('cleanup: delete account', async () => {
    await pg.getByRole('button', { name: 'Account', exact: true }).and(live).first().click(); await T('Delete account', { exact: true }).click(); await T('Create account').waitFor({ timeout: 10000 });
  });
  console.log(logs.join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
