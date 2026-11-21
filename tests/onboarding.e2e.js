// First-run onboarding and species templates. Run: node --env-file=.env tests/onboarding.e2e.js <screenshot-dir>
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const pg = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-AU', timezoneId: 'Europe/London' })).newPage();
  const logs = []; pg.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  pg.on('console', m => { if (m.text().startsWith('[sync]')) logs.push('SYNC: ' + m.text()); });
  pg.on('dialog', d => { logs.push('DIALOG: ' + d.message().replace(/\n+/g, ' | ')); d.accept(); });
  const live = pg.locator(':not([inert] *)');
  const T = (t, o) => pg.getByText(t, o).and(live).first(); const L = t => pg.getByLabel(t, { exact: true }).and(live).first();
  const B = t => pg.getByRole('button', { name: t, exact: true }).and(live).first();
  let fails = 0, n = 0;
  const step = async (name, fn) => { try { await fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); await pg.screenshot({ path: `${SP}/ob-${++n}-FAIL.png`, fullPage: true }); } };
  const until = async (fn, ms, msg) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await new Promise(r => setTimeout(r, 500)); } throw new Error(msg); };
  const email = `clutchly.ob.${Date.now()}@gmail.com`, pw = 'Ob-test-pass-1';
  const api = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const carpetTemplate = async () => (await api.from('species_templates').select('*').eq('species', 'Carpet').single()).data;

  await pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await step('new user lands on Welcome; hemisphere guessed from timezone (London = Northern)', async () => {
    await L('Email').fill(email); await L('Password').fill(pw); await B('Create account').click();
    await T('Welcome to Clutchly').waitFor({ timeout: 15000 });
    if (await B('Northern').getAttribute('aria-selected') !== 'true') throw new Error('Northern not preselected');
  });
  await step('pick Carpet and Bredli; preview shows northern dates and the starting-points note', async () => {
    await B('Carpet').click(); await B('Bredli').click();
    await T('Pairing from 1 December').waitFor(); await T('Pairing from 1 February').waitFor();
    await T('Feeding pause 1 November – 30 November').waitFor();
    await T(/These are starting points from an experienced breeder's routine/).waitFor();
    await pg.screenshot({ path: `${SP}/ob-a-welcome.png`, fullPage: true });
  });
  await step('Southern shows the original dates', async () => {
    await B('Southern').click(); await T('Pairing from 1 June').waitFor(); await T('Pairing from 1 August').waitFor(); await B('Northern').click();
  });
  await step('apply: Season tab has the northern values; Welcome does not come back', async () => {
    await B('Use these starting values').click(); await pg.getByRole('tab', { name: 'Season' }).waitFor({ timeout: 10000 });
    await pg.getByRole('tab', { name: 'Season' }).click(); await T('Morelia spilota', { exact: true }).waitFor({ timeout: 8000 });
    const pairs = await pg.getByLabel('Pairing starts', { exact: true }).and(live).evaluateAll(els => els.map(e => e.value));
    if (pairs.join() !== '2000-12-01,2000-02-01') throw new Error('pairing dates ' + pairs);
    if (await L('Feed males every (days)').inputValue() !== '21') throw new Error('male interval');
    await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForTimeout(2000);
    if (await T('Welcome to Clutchly').count()) throw new Error('welcome shown again');
  });
  await step("user's edit stays private: the shared template is unchanged", async () => {
    await pg.getByRole('tab', { name: 'Season' }).click(); await T('Morelia spilota', { exact: true }).waitFor({ timeout: 8000 });
    const f = L('Feed males every (days)'); await f.fill('28'); await f.blur(); await pg.waitForTimeout(1500);
    await api.auth.signInWithPassword({ email, password: pw });
    await until(async () => (await api.from('season_settings').select('male_every').eq('species', 'Carpet').single()).data?.male_every === 28, 15000, 'edit not synced');
    if ((await carpetTemplate()).male_every !== 21) throw new Error('template changed');
  });
  await step('"Use starting values" restores the template (after confirming)', async () => {
    await B('Use starting values').click(); await until(async () => await L('Feed males every (days)').inputValue() === '21', 8000, 'not restored');
    if (!logs.some(l => l.includes('Use starting values for Carpet?'))) throw new Error('no confirmation');
    await pg.screenshot({ path: `${SP}/ob-b-season.png`, fullPage: true });
  });
  await step('cleanup', async () => { await api.rpc('delete_my_account'); });
  console.log(logs.filter(l => !/^DIALOG: (Delete|Use starting)/.test(l)).join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
