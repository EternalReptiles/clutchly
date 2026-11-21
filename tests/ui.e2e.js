// End-to-end UI test of the Clutchly web build against the real Supabase project.
// Needs Playwright (not a project dependency) and "Confirm email" off. Run:
//   npx expo export --platform web --output-dir /tmp/web && npx serve -s /tmp/web -l 8099
//   node tests/ui.e2e.js /tmp/shots
const { chromium } = require('playwright');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const pg = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-AU' })).newPage();
  const logs = []; pg.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') logs.push('console: ' + m.text()); });
  pg.on('dialog', d => { logs.push('DIALOG: ' + d.message().replace(/\n+/g, ' | ')); d.accept(); });
  // Inactive screens are `inert`; only match elements on the active screen.
  const live = pg.locator(':not([inert] *)');
  const T = (t, o) => pg.getByText(t, o).and(live).first();
  const L = t => pg.getByLabel(t, { exact: true }).and(live).first();
  const tab = n => pg.getByRole('tab', { name: n }).click();
  const gone = async (loc, ms = 8000) => { await pg.waitForTimeout(500); await loc.waitFor({ state: 'detached', timeout: ms }); };
  const until = async (fn, want, msg) => { for (let i = 0; i < 16; i++) { if (await fn() === want) return; await pg.waitForTimeout(500); } throw new Error(msg + ' (got ' + await fn() + ')'); };
  let n = 0; const shot = name => pg.screenshot({ path: `${SP}/ui-${String(++n).padStart(2, '0')}-${name}.png` });
  let fails = 0;
  const step = async (name, fn) => { try { await fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); await shot('FAIL'); } };
  const email = `clutchly.ui.${Date.now()}@gmail.com`, pw = 'Ui-test-pass-1';
  const signIn = async () => { await L('Email').fill(email); await L('Password').fill(pw); await T('Sign in', { exact: true }).click(); };

  await pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await step('sign up', async () => {
    await L('Email').fill(email); await L('Password').fill(pw); await T('Create account', { exact: true }).click();
    await T('No animals yet. Add some on the Animals tab.').waitFor({ timeout: 10000 }); await shot('today-empty');
  });
  await step('sign out, then sign in', async () => {
    await tab('Season'); await T('Sign out', { exact: true }).click(); await T('Create account').waitFor({ timeout: 10000 });
    await signIn(); await T('No animals yet. Add some on the Animals tab.').waitFor({ timeout: 10000 });
  });
  for (const [nm, sex] of [['ER001', 'Female'], ['ER002', 'Male']]) await step(`add animal ${nm} with hatch date picker`, async () => {
    await tab('Animals'); await T('+ Add').click(); await L('Name / ID').fill(nm); await T(sex, { exact: true }).click();
    await L('Hatch date').fill('2023-12-01'); if (nm === 'ER001') await shot('new-animal');
    await T('Save', { exact: true }).click(); await T(nm, { exact: true }).waitFor({ timeout: 10000 });
  });
  await step('both due on Today; log feed from Today', async () => {
    await tab('Today'); await T('ER001', { exact: true }).waitFor(); await T('ER002', { exact: true }).waitFor(); await shot('today-due');
    await T('Fed', { exact: true }).click(); await gone(T('ER001', { exact: true }));
  });
  await step('animal screen: log feed on a past date, weight, history', async () => {
    await tab('Animals'); await T(/Female · fed 21 Nov 2026/).waitFor({ timeout: 8000 });
    await T('ER002', { exact: true }).click(); await L('Date').fill('2026-11-10');
    await L('Food').fill('medium rat'); await T('Fed', { exact: true }).click(); await T('10 Nov 2026 · Fed (medium rat)').waitFor({ timeout: 8000 });
    await L('Weight (g)').fill('850'); await T('Weight', { exact: true }).click(); await T('10 Nov 2026 · 850 g').waitFor({ timeout: 8000 });
    await shot('animal-detail');
  });
  await step('delete a history entry', async () => { await T('10 Nov 2026 · 850 g').click(); await gone(T('10 Nov 2026 · 850 g')); });
  await step('back button; list shows last feed', async () => { await pg.getByLabel(/back$/i).and(live).first().click(); await T(/Male · fed 10 Nov 2026/).waitFor({ timeout: 8000 }); await shot('animals'); });
  await step('Today: male fed 10 Nov is not due (21-day default)', async () => {
    await tab('Today'); await T('Nothing due in the next 3 days.').waitFor({ timeout: 8000 });
  });
  await step('create pairing', async () => {
    await tab('Pairings'); await T('+ New pairing').click(); await T('ER001', { exact: true }).click(); await T('ER002', { exact: true }).click();
    await shot('new-pairing'); await T('Create', { exact: true }).click(); await T('ER001 × ER002').waitFor({ timeout: 8000 });
  });
  await step('log two locks, pre-lay shed, estimated lay', async () => {
    await T('ER001 × ER002').click(); await T('Locks (0)').waitFor();
    await L('Lock date').fill('2026-06-12'); await T('+ Log lock').click(); await T('Locks (1)').waitFor({ timeout: 8000 });
    await L('Lock date').fill('2026-06-05'); await T('+ Log lock').click(); await T('Locks (2)').waitFor({ timeout: 8000 });
    await L('Pre-lay shed').fill('2026-09-01'); await T('Save', { exact: true }).click();
    await T(/estimated lay 1 Oct 2026/).waitFor({ timeout: 8000 }); await shot('pairing-detail');
    await pg.getByLabel(/back$/i).and(live).first().click(); await T('Pre-lay shed · 2 locks · lay ~ 1 Oct 2026').waitFor({ timeout: 8000 }); await shot('pairings');
  });
  await step('season settings: change, persists after reload, reset', async () => {
    await tab('Season'); await shot('season-defaults');
    await L('Pairing starts').fill('2000-06-15'); await pg.waitForTimeout(1500);
    await L('Feed females every (days)').fill('10'); await L('Feed females every (days)').blur(); await pg.waitForTimeout(1500);
    await pg.reload({ waitUntil: 'networkidle' }); await tab('Season'); await pg.waitForTimeout(1500);
    await until(() => L('Pairing starts').inputValue(), '2000-06-15', 'pair start not saved');
    await until(() => L('Feed females every (days)').inputValue(), '10', 'interval not saved');
    await T('Reset', { exact: true }).click(); await pg.waitForTimeout(2000);
    await until(() => L('Pairing starts').inputValue(), '2000-06-01', 'reset failed');
  });
  await step('date format: switch to US and back to Australian', async () => {
    await T('US', { exact: true }).click(); await pg.waitForTimeout(1500);
    await tab('Pairings'); await T('Pre-lay shed · 2 locks · lay ~ Oct 1, 2026').waitFor({ timeout: 8000 }); await shot('pairings-us');
    await pg.reload({ waitUntil: 'networkidle' }); await tab('Pairings'); await T('Pre-lay shed · 2 locks · lay ~ Oct 1, 2026').waitFor({ timeout: 8000 });
    await tab('Season'); await T('Australian', { exact: true }).click(); await pg.waitForTimeout(1500); await shot('season-format');
    await tab('Pairings'); await T('Pre-lay shed · 2 locks · lay ~ 1 Oct 2026').waitFor({ timeout: 8000 }); await tab('Season');
  });
  await step('delete account; sign-in then fails', async () => {
    await T('Delete account', { exact: true }).click(); await T('Create account').waitFor({ timeout: 10000 });
    await signIn(); await pg.waitForTimeout(3000);
    if (!logs.some(l => /Invalid login/.test(l))) throw new Error('sign-in after delete did not fail');
  });
  console.log(logs.join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
