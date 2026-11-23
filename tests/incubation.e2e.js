// Incubation log on a pairing (lib/IncubationLog.tsx). Same setup as tests/ui.e2e.js. Run: node --env-file=.env tests/incubation.e2e.js <screenshot-dir>
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const pg = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-AU' })).newPage();
  const logs = []; pg.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  pg.on('dialog', d => { logs.push('DIALOG: ' + d.message().replace(/\n+/g, ' | ')); d.accept(); });
  const live = pg.locator(':not([inert] *)');
  const T = (t, o) => pg.getByText(t, o).and(live).filter({ visible: true }).first(); const L = t => pg.getByLabel(t, { exact: true }).and(live).filter({ visible: true }).first();
  const B = t => pg.getByRole('button', { name: t, exact: true }).and(live).filter({ visible: true }).first();
  // An animal row in a chooser (pairing, calculator): its label starts with the ID.
  const R = n => pg.getByRole('radio', { name: new RegExp('^' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ',') }).and(live).first();
  const tab = n => pg.getByRole('tab', { name: n }).click(); const back = () => pg.getByLabel(/back$/i).and(live).filter({ visible: true }).first().click();
  let fails = 0, n = 0;
  const step = async (name, fn) => { try { await fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); await pg.screenshot({ path: `${SP}/ic-${++n}-FAIL.png`, fullPage: true }).catch(() => {}); } };
  const until = async (fn, ms, msg) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await new Promise(r => setTimeout(r, 500)); } throw new Error(msg); };
  const email = `clutchly.ic.${Date.now()}@gmail.com`, pw = 'Ic-test-pass-1';
  const api = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const iso = k => { const d = new Date(); d.setDate(d.getDate() - k); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const au = k => new Date(iso(k) + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  const addAnimal = async (name, sex) => { await tab('Animals'); await T('+ Add').click(); await L('Name / ID').fill(name); await B(sex).click();
    await L('Species').click(); await L('Search species').fill('carpet'); await B('Carpet').click(); await B('Save').click(); await T(name, { exact: true }).waitFor({ timeout: 8000 }); };
  const reading = async (date, temp, hum, eggs, note) => { await pg.getByLabel('Date', { exact: true }).and(live).filter({ visible: true }).last().fill(date);
    await L('Temp °C').fill(temp); await L('Humidity %').fill(hum); await L('Good eggs').fill(eggs); await L('Note').fill(note); await B('+ Add reading').click(); };

  await pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await step('sign up, pair two carpets', async () => {
    const __e = email, __p = pw; await L('Email').fill(__e); await L('Password').fill(__p); await pg.getByRole('button', { name: await require('./e2eAccount.cjs')(__e, __p), exact: true }).first().click(); await B('Skip for now').click({ timeout: 15000 });
    await T('No animals yet. Add some on the Animals tab.').waitFor({ timeout: 10000 });
    await addAnimal('IC-F', 'Female'); await addAnimal('IC-M', 'Male');
    await tab('Pairings'); await T('+ New pairing').click(); await R('IC-F').click(); await R('IC-M').click(); await B('Create').click();
    await T('IC-F × IC-M').waitFor({ timeout: 8000 });
  });
  await step('no incubation log until eggs are laid', async () => {
    await T('IC-F × IC-M').click(); await L('Eggs laid').waitFor();
    if (await T(/^Incubation/).count()) throw new Error('shown too early');
    await L('Eggs laid').fill(iso(20)); await L('Clutch size').fill('10'); await T('Incubation · day 20').waitFor(); await T('No readings yet', { exact: true }).waitFor();
    await B('Save').click();
  });
  await step('incubator and target saved on leaving the field', async () => {
    await L('Incubator').fill('Top shelf'); await L('Target °C').fill('31.5'); await L('Temp °C').click();
  });
  await step('add readings; summary, ranges and off-target', async () => {
    await reading(iso(15), '31.4', '75', '10', 'set'); await reading(iso(8), '33', '80', '9', 'candled, 1 slug removed'); await reading(iso(2), '31.8', '78', '', '');
    await T(`${au(8)} · 33 °C · 80% · 9 good · candled, 1 slug removed`).waitFor();
    await T('3 readings · 31.4–33 °C · 75–80% · 9 of 10 eggs good · last checked 2 days ago', { exact: true }).waitFor();
    await T('1 reading more than 1 °C from the target').waitFor();
    if (await T(`${au(8)} · 33 °C · 80% · 9 good · candled, 1 slug removed`).evaluate(e => getComputedStyle(e).color) !== 'rgb(179, 38, 30)') throw new Error('off-target reading not red');
    await pg.getByLabel('Incubation', { exact: true }).first().screenshot({ path: `${SP}/ic-a-card.png` });
  });
  await step('a reading with nothing in it is refused', async () => {
    await B('+ Add reading').click(); await until(async () => logs.some(l => l.startsWith('DIALOG: Nothing to add')), 3000, 'no message');
  });
  await step('saved to the server (offline-synced table)', async () => {
    await api.auth.signInWithPassword({ email, password: pw });
    await until(async () => { const r = await api.from('incubation_logs').select('temp,humidity,eggs_good,note'); return r.data?.length === 3 && r.data.some(x => Number(x.temp) === 33 && x.eggs_good === 9); }, 15000, 'not on server');
    await until(async () => { const r = await api.from('pairings').select('incubator,target_temp'); return r.data?.[0]?.incubator === 'Top shelf' && Number(r.data[0].target_temp) === 31.5; }, 15000, 'incubator/target not saved');
  });
  await step('still there after leaving and coming back; delete one', async () => {
    await back(); await T('IC-F × IC-M').click(); await T(/^3 readings/).waitFor({ timeout: 8000 });
    if (await L('Incubator').inputValue() !== 'Top shelf') throw new Error('incubator lost');
    await T(`${au(2)} · 31.8 °C · 78%`, { exact: true }).click(); await T(/^2 readings/).waitFor({ timeout: 5000 });
    await until(async () => (await api.from('incubation_logs').select('id')).data?.length === 2, 15000, 'delete not synced');
  });
  await step('stops counting at hatch', async () => {
    await L('Hatched').fill(iso(1)); await T('Incubation · day 19').waitFor(); await B('Save').click();
  });
  await step('cleanup: delete account', async () => { await api.rpc('delete_my_account'); });
  console.log(logs.filter(l => !/^DIALOG: (Delete|Nothing)/.test(l)).join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
