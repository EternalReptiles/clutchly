// Browser test for Forgot password / reset link handling. Same setup as tests/ui.e2e.js, plus .env loaded:
//   node --env-file=.env tests/reset.e2e.js <screenshot-dir>
// No email is sent: the request uses an address with no account, and the reset link is built from a
// throwaway account's tokens in the same #access_token=…&type=recovery format Supabase's email link uses.
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const SP = process.argv[2];
(async () => {
  const sb = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const email = `clutchly.reset.${Date.now()}@gmail.com`, oldPw = 'Old-pass-123', newPw = 'New-pass-456';
  const su = await sb.auth.signUp({ email, password: oldPw }); if (su.error) throw su.error;
  const { access_token, refresh_token } = su.data.session;

  const b = await chromium.launch();
  const ctx = () => b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-AU' });
  let fails = 0, n = 0; const logs = [];
  const run = async (page, name, fn) => { try { await fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); await page.screenshot({ path: `${SP}/rst-${++n}-FAIL.png` }); } };
  const helpers = pg => { const live = pg.locator(':not([inert] *)'); pg.on('console', m => { if (m.text().startsWith('[sync]')) logs.push('SYNC: ' + m.text()); });
  pg.on('dialog', d => { logs.push('DIALOG: ' + d.message().replace(/\n+/g, ' | ')); d.accept(); });
    return { T: (t, o) => pg.getByText(t, o).and(live).first(), L: t => pg.getByLabel(t, { exact: true }).and(live).first() }; };

  let pg = await (await ctx()).newPage(); let { T, L } = helpers(pg);
  await pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await run(pg, 'login -> Forgot password? (email carried over) -> request sent', async () => {
    await L('Email').fill('nobody.clutchly.test@example.com'); await T('Forgot password?').click();
    if (await L('Email').inputValue() !== 'nobody.clutchly.test@example.com') throw new Error('email not prefilled');
    await pg.screenshot({ path: `${SP}/rst-a-forgot.png` });
    await T('Send reset link').click(); await T('Check your email').waitFor({ timeout: 10000 });
    await pg.screenshot({ path: `${SP}/rst-b-sent.png` });
    await T('Back to sign in').click(); await T('Create account').waitFor();
  });

  pg = await (await ctx()).newPage(); ({ T, L } = helpers(pg));
  await run(pg, 'reset link signs in and sets new password', async () => {
    await pg.goto(`http://localhost:8099/reset-password#access_token=${access_token}&expires_at=9999999999&expires_in=3600&refresh_token=${refresh_token}&token_type=bearer&type=recovery`, { waitUntil: 'networkidle' });
    await L('New password').fill(newPw); await L('Confirm new password').fill('different-1');
    await pg.screenshot({ path: `${SP}/rst-c-new.png` });
    await T('Save password').click(); await pg.waitForTimeout(500);
    if (!logs.some(l => l.includes("don't match"))) throw new Error('mismatch not caught');
    await L('Confirm new password').fill(newPw); await T('Save password').click(); await pg.getByRole('button', { name: 'Skip for now', exact: true }).click({ timeout: 15000 });
    await T('No animals yet. Add some on the Animals tab.').waitFor({ timeout: 10000 });
  });
  await run(pg, 'old password rejected, new password works', async () => {
    const c = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    if (!(await c.auth.signInWithPassword({ email, password: oldPw })).error) throw new Error('old password still works');
    const ok = await c.auth.signInWithPassword({ email, password: newPw }); if (ok.error) throw ok.error;
    await c.rpc('delete_my_account');
  });

  pg = await (await ctx()).newPage(); ({ T, L } = helpers(pg));
  await run(pg, 'expired link shows a clear message', async () => {
    await pg.goto('http://localhost:8099/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired', { waitUntil: 'networkidle' });
    await T('This reset link has expired or was already used.').waitFor({ timeout: 8000 }); await pg.screenshot({ path: `${SP}/rst-d-expired.png` });
    await T('Send a new link').click(); await T('Send reset link').waitFor();
  });
  pg = await (await ctx()).newPage(); ({ T, L } = helpers(pg));
  await run(pg, 'opening reset screen without a link', async () => {
    await pg.goto('http://localhost:8099/reset-password', { waitUntil: 'networkidle' });
    await T('Open this screen from the link in your password reset email.').waitFor({ timeout: 8000 });
  });
  console.log(logs.join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
