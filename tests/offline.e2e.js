// Offline mode test against the web build and the real Supabase project.
// "No signal" = every request to Supabase is blocked (the app's own files still load, like an installed app).
// Run: node --env-file=.env tests/offline.e2e.js <screenshot-dir>   (needs Playwright and "Confirm email" off)
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const SP = process.argv[2];
const SB = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).host;
(async () => {
  const b = await chromium.launch(); const logs = []; let fails = 0, n = 0;
  const email = `clutchly.off.${Date.now()}@gmail.com`, pw = 'Off-test-pass-1';
  const api = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const mkPage = async () => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-AU' }); const pg = await ctx.newPage();
    pg.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
    pg.on('console', m => { if (m.text().startsWith('[sync]')) logs.push('SYNC: ' + m.text()); });
    pg.on('dialog', d => { logs.push('DIALOG: ' + d.message().replace(/\n+/g, ' | ')); d.accept(); });
    const live = pg.locator(':not([inert] *)');
    let offline = false;
    await pg.route(`**://${SB}/**`, r => offline ? r.abort('internetdisconnected') : r.continue());
    return { pg, ctx, live, T: (t, o) => pg.getByText(t, o).and(live).first(), L: t => pg.getByLabel(t, { exact: true }).and(live).first(),
      tab: x => pg.getByRole('tab', { name: x }).click(), back: () => pg.getByLabel(/back$/i).and(live).first().click(),
      setOffline: v => { offline = v; } };
  };
  const step = async (pg, name, fn) => { try { await fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); await pg.screenshot({ path: `${SP}/off-${++n}-FAIL.png` }); } };
  const pill = pg => pg.getByRole('button', { name: /^Offline|^Syncing|^Sync problem/ });
  const until = async (fn, ms, msg) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await new Promise(r => setTimeout(r, 500)); } throw new Error(msg); };
  const server = async () => {
    const [a, e] = await Promise.all([api.from('animals').select('id,name,updated_at'), api.from('events').select('id,animal_id,kind,grams,on_date')]);
    return { animals: a.data ?? [], events: e.data ?? [] };
  };
  const pickCarpet = async d => { await d.L('Species').click(); await d.L('Search species').fill('carpet'); await d.pg.getByRole('button', { name: 'Carpet', exact: true }).and(d.live).first().click(); };

  const d1 = await mkPage(); const { pg, T, L, tab, back } = d1;
  await pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await step(pg, 'online: sign up, add two animals, synced', async () => {
    await L('Email').fill(email); await L('Password').fill(pw); await T('Create account', { exact: true }).click();
    await T('No animals yet. Add some on the Animals tab.').waitFor({ timeout: 10000 });
    for (const nm of ['F1', 'F2']) { await tab('Animals'); await T('+ Add').click(); await L('Name / ID').fill(nm); await pickCarpet(d1); await T('Save', { exact: true }).click(); await T(nm, { exact: true }).waitFor({ timeout: 8000 }); }
    await api.auth.signInWithPassword({ email, password: pw });
    await until(async () => (await server()).animals.length === 2, 15000, 'animals not on server');
  });
  const f2Event = { id: null };
  await step(pg, 'online: log a shed on F2 (to delete offline later)', async () => {
    await T('F2', { exact: true }).click(); await T('Shed', { exact: true }).click(); await T(/· Shed$/).waitFor({ timeout: 5000 }); await back();
    await until(async () => { const e = (await server()).events.find(x => x.kind === 'shed'); f2Event.id = e?.id; return !!e; }, 15000, 'shed not on server');
  });

  d1.setOffline(true);
  await step(pg, 'offline: log feed from Today; pill appears', async () => {
    await tab('Today'); await T('F1', { exact: true }).waitFor();
    await pg.getByRole('button', { name: 'Fed', exact: true }).and(d1.live).first().click();
    await until(async () => /^Offline · \d+ to sync$/.test((await pill(pg).first().textContent().catch(() => '')) || ''), 10000, 'no offline pill');
    await pg.screenshot({ path: `${SP}/off-a-pill.png` });
  });
  await step(pg, 'offline: add animal OFF1 with weight, rename F2, delete its shed', async () => {
    await tab('Animals'); await T('+ Add').click(); await L('Name / ID').fill('OFF1'); await pickCarpet(d1); await T('Save', { exact: true }).click();
    await T('OFF1', { exact: true }).click(); await L('Weight (g)').fill('321'); await T('Weight', { exact: true }).click(); await T(/321 g$/).waitFor({ timeout: 5000 }); await back();
    await T('F2', { exact: true }).click(); await L('Name / ID').fill('F2-renamed'); await T('Save', { exact: true }).click(); await T('F2-renamed', { exact: true }).waitFor({ timeout: 5000 });
    await T('F2-renamed', { exact: true }).click(); await T(/· Shed$/).click(); await pg.getByRole('button', { name: 'Delete', exact: true }).last().click(); await pg.waitForTimeout(300); await back();
    const txt = await pill(pg).first().textContent(); if (!/Offline · [5-9] to sync/.test(txt)) throw new Error('pill: ' + txt);
  });
  await step(pg, 'offline: nothing reached the server yet', async () => {
    const s = await server(); if (s.animals.length !== 2 || s.events.some(e => e.kind === 'feed') || !s.events.some(e => e.kind === 'shed')) throw new Error(JSON.stringify(s));
  });
  await step(pg, 'offline: reopen the app with no signal, data still there', async () => {
    await pg.reload({ waitUntil: 'load' }); await pg.waitForTimeout(2000);
    await tab('Animals'); await T('OFF1', { exact: true }).waitFor({ timeout: 8000 }); await T('F2-renamed', { exact: true }).waitFor();
    await T(/Carpet · Female · fed \d+ Nov 2026/).waitFor();
  });

  // Meanwhile another device (online) renames F1, AFTER this phone went offline... but this phone renames F1 later.
  // Last write wins: this phone's newer rename must survive.
  await step(pg, 'conflict setup: other device renames F1 now; this phone renames F1 a moment later (offline)', async () => {
    const f1 = (await server()).animals.find(a => a.name === 'F1');
    await api.from('animals').update({ name: 'F1-other-device', updated_at: new Date().toISOString() }).eq('id', f1.id);
    await pg.waitForTimeout(1100);
    await T('F1', { exact: true }).click(); await L('Name / ID').fill('F1-this-phone'); await T('Save', { exact: true }).click(); await T('F1-this-phone', { exact: true }).waitFor({ timeout: 5000 });
  });

  d1.setOffline(false);
  await step(pg, 'back online: queue syncs by itself, pill disappears', async () => {
    await until(async () => (await pill(pg).count()) === 0, 30000, 'pill still shown'); await pg.screenshot({ path: `${SP}/off-b-synced.png` });
  });
  await step(pg, 'server has every offline change', async () => {
    const s = await server(); const names = s.animals.map(a => a.name).sort().join();
    if (names !== 'F1-this-phone,F2-renamed,OFF1') throw new Error('animals: ' + names);
    const off1 = s.animals.find(a => a.name === 'OFF1');
    if (!s.events.some(e => e.kind === 'feed')) throw new Error('feed missing');
    if (!s.events.some(e => e.kind === 'weight' && Number(e.grams) === 321 && e.animal_id === off1.id)) throw new Error('weight missing');
    if (s.events.some(e => e.id === f2Event.id)) throw new Error('deleted shed still on server');
  });
  await step(pg, 'last write wins: an older edit synced later does not overwrite a newer one', async () => {
    const f = (await server()).animals.find(a => a.name.startsWith('F1'));
    await api.from('animals').update({ name: 'stale', updated_at: '2020-01-01T00:00:00Z' }).eq('id', f.id);
    if ((await api.from('animals').select('name').eq('id', f.id).single()).data.name !== 'F1-this-phone') throw new Error('stale edit applied');
  });

  // A second device sees everything, and deletions made elsewhere reach this phone.
  const d2 = await mkPage();
  await d2.pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await step(d2.pg, 'second device signs in and sees the synced data', async () => {
    await d2.L('Email').fill(email); await d2.L('Password').fill(pw); await d2.T('Sign in', { exact: true }).click();
    await d2.tab('Animals'); await d2.T('OFF1', { exact: true }).waitFor({ timeout: 10000 }); await d2.T('F1-this-phone', { exact: true }).waitFor();
  });
  await step(pg, 'delete on the second device reaches this phone', async () => {
    await d2.T('OFF1', { exact: true }).click(); await d2.T('Delete', { exact: true }).click(); await d2.T('F2-renamed', { exact: true }).waitFor({ timeout: 8000 });
    await until(async () => (await server()).animals.length === 2, 15000, 'delete not on server');
    await tab('Today'); await tab('Animals');
    await pg.getByRole('tab', { name: 'Animals' }).click(); // pull to refresh is a gesture; app also syncs every 2 min and on reopen
    await pg.reload({ waitUntil: 'networkidle' }); await tab('Animals');
    await until(async () => (await pg.getByText('OFF1', { exact: true }).and(d1.live).count()) === 0, 15000, 'OFF1 still shown');
  });
  await step(pg, 'cleanup', async () => { await api.rpc('delete_my_account'); });
  console.log(logs.filter(l => !l.startsWith('DIALOG: Delete')).join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
