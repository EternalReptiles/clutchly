// Free plan limits and Pro in the app. Run: RC_AUTH='Bearer ...' node --env-file=.env tests/plans.e2e.js <screenshot-dir>
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const makePro = require('./makePro.cjs');
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
  const step = async (name, fn) => { try { await fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); await pg.screenshot({ path: `${SP}/pl-${++n}-FAIL.png`, fullPage: true }); } };
  const until = async (fn, ms, msg) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await new Promise(r => setTimeout(r, 500)); } throw new Error(msg); };
  const email = `clutchly.pl.${Date.now()}@gmail.com`, pw = 'Pl-test-pass-1';
  const api = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

  await pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await step('sign up (free plan)', async () => {
    await L('Email').fill(email); await L('Password').fill(pw); await B('Create account').click(); await B('Skip for now').click({ timeout: 15000 });
    await api.auth.signInWithPassword({ email, password: pw });
  });
  await step('bulk add 12: the first 10 are imported, 2 stay in the box marked over the limit', async () => {
    await tab('Animals'); await B('Bulk add').click();
    await L('Paste here').fill(Array.from({ length: 12 }, (_, i) => `FR${String(i + 1).padStart(2, '0')}, Carpet, F`).join('\n'));
    await T(/The free plan has room for 10 more animals \(up to 10\)\. The first 10 will be imported; the other 2 stay in the box\./).waitFor({ timeout: 8000 });
    await pg.screenshot({ path: `${SP}/pl-a-import.png`, fullPage: true });
    await B('Import 10 animals').click(); await T('Imported 10 animals').waitFor();
    await T('Line 11: Over the free limit of 10 animals').waitFor();
    await until(async () => ((await api.from('animals').select('id')).data ?? []).length === 10, 20000, 'not synced');
  });
  await step('+ Add at the limit opens the Pro screen with the reason', async () => {
    await B('Done').click(); await T('+ Add').click();
    await L('Name / ID').fill('FR11'); await L('Species').click(); await L('Search species').fill('carpet'); await pg.getByRole('button', { name: 'Carpet', exact: true }).and(live).first().click();
    await B('Save').click();
    await T(/^Free accounts can have up to 10 owned animals \(animals marked Sold don't count\), and you have 10\./).waitFor({ timeout: 5000 });
    await T('Subscriptions are available in the Clutchly app for iPhone and Android.').waitFor();
    await T(/Your data is never deleted\./).waitFor();
    await pg.getByRole('link', { name: 'Terms of use' }).and(live).first().waitFor();
    await pg.screenshot({ path: `${SP}/pl-b-paywall.png`, fullPage: true });
    await B('Not now').click(); await back();
  });
  await step('Account plan card: Free · 10 of 10 animals; photos ask for Pro', async () => {
    await pg.getByRole('button', { name: 'Account', exact: true }).and(live).first().click(); await T('Free · 10 of 10 owned animals').waitFor({ timeout: 5000 }); await back();
    await tab('Animals'); await T('FR01', { exact: true }).click(); await B('Add photo (Pro)').click();
    await T('Photos are part of Pro. Photos you added before stay visible.').waitFor({ timeout: 5000 }); await B('Not now').click(); await back();
  });
  await step('server-side purchase (webhook) unlocks Pro in the app', async () => {
    const uid = (await api.auth.getUser()).data.user.id; await makePro(uid);
    await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForTimeout(2500);
    await pg.getByRole('button', { name: 'Account', exact: true }).and(live).first().click(); await T(/^Clutchly Pro · renews or ends /).waitFor({ timeout: 15000 }); await back();
    await tab('Animals'); await T('+ Add').click(); await L('Name / ID').fill('FR11');
    await L('Species').click(); await L('Search species').fill('carpet'); await pg.getByRole('button', { name: 'Carpet', exact: true }).and(live).first().click();
    await B('Save').click(); await T('FR11', { exact: true }).waitFor({ timeout: 8000 });
    await until(async () => ((await api.from('animals').select('id')).data ?? []).length === 11, 20000, 'eleventh animal not on server');
  });
  await step('cleanup', async () => { await api.rpc('delete_my_account'); });
  console.log(logs.filter(l => !l.startsWith('DIALOG: Delete')).join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
