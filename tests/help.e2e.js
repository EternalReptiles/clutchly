// Help and Contact support (app/help.tsx, app/contact.tsx, supabase/functions/support-message), signed out from the
// sign-in screen. Same setup as tests/ui.e2e.js. Run: SUPABASE_SECRET_KEY=... node --env-file=.env tests/help.e2e.js <dir>
// (the secret key is used only to check the saved message and delete it afterwards).
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const pg = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-AU' })).newPage();
  const logs = []; pg.on('pageerror', e => logs.push('PAGEERROR: ' + e.message)); pg.on('dialog', d => { logs.push('DIALOG: ' + d.message().replace(/\n+/g, ' | ')); d.accept(); });
  const live = pg.locator(':not([inert] *)');
  const T = (t, o) => pg.getByText(t, o).and(live).filter({ visible: true }).first(); const L = t => pg.getByLabel(t, { exact: true }).and(live).filter({ visible: true }).first();
  const B = t => pg.getByRole('button', { name: t, exact: true }).and(live).filter({ visible: true }).first();
  let fails = 0, n = 0;
  const step = async (name, fn) => { try { await fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + e.message.split('\n').slice(0, 4).join(' / ')); await pg.screenshot({ path: `${SP}/hp-${++n}-FAIL.png`, fullPage: true }).catch(() => {}); } };
  const admin = process.env.SUPABASE_SECRET_KEY && createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  const marker = `help-e2e-${Date.now()}`;

  await pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await step('sign-in screen links to Help; questions open and close', async () => {
    await pg.getByRole('link', { name: 'Help', exact: true }).first().click(); await T('Getting started').waitFor({ timeout: 10000 });
    const qa = pg.getByRole('button', { name: /^How do I add my animals\?/ }).first();
    await qa.click(); await T(/^On the Animals tab tap \+ Add/).waitFor();
    if (await qa.getAttribute('aria-expanded') !== 'true') throw new Error('not marked open for screen readers');
    await qa.click(); if (await T(/^On the Animals tab tap \+ Add/).isVisible()) throw new Error('did not close');
    await pg.screenshot({ path: `${SP}/hp-a-help.png`, fullPage: true });
  });
  await step('search finds answers across sections, and says when nothing matches', async () => {
    await L('Search help').fill('licence handover'); await T('Why do I need to add my wildlife licence?').waitFor();
    if (await T('How do I add my animals?').isVisible()) throw new Error('unrelated question shown');
    await T(/^Buyers and sellers need each other's full name/).waitFor();      // answers show while searching
    await L('Search help').fill('zzqqxx'); await T('No answers for "zzqqxx"').waitFor();
  });
  await step('contact form: checks the email, sends, thanks', async () => {
    await B('Contact support').click(); await L('Message').waitFor({ timeout: 10000 });
    await B('Problem or bug').click(); await L('Message').fill(`Test message ${marker}`); await L('Your email (for our reply)').fill('not-an-email');
    await B('Send message').click(); if (!logs.some(l => l.startsWith('DIALOG: Check your email address'))) throw new Error('bad email accepted');
    await L('Your email (for our reply)').fill('clutchly.help.test@gmail.com'); await T(/^Sent with your message, to help us help you: app version /).waitFor();
    await B('Send message').click(); await T('Thanks, your message is on its way').waitFor({ timeout: 15000 });
    await T('We\'ll reply to clutchly.help.test@gmail.com, usually within a couple of days. Check your junk folder if you don\'t see it.').waitFor();
  });
  if (admin) await step('saved with the topic and the app details, no account', async () => {
    const r = await admin.from('support_messages').select('*').like('message', `%${marker}%`);
    const m = r.data?.[0]; if (!m) throw new Error('not saved ' + (r.error?.message ?? ''));
    if (m.topic !== 'Problem or bug' || m.email !== 'clutchly.help.test@gmail.com' || m.user_id !== null || !m.meta.app_version || !/^web/.test(m.meta.platform) || m.meta.plan !== 'signed out')
      throw new Error(JSON.stringify(m));
    await admin.from('support_messages').delete().eq('id', m.id);
  });
  console.log(logs.filter(l => !/^DIALOG: Check your email/.test(l)).join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
