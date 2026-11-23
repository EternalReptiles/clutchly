// Photos test against the web build and the real Supabase project.
// Run: RC_AUTH='Bearer ...' CRON_SECRET=... node --env-file=.env tests/photos.e2e.js <dir with big.jpg (2400x1600) and tall.jpg (1000x1500)>
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const DIR = process.argv[2];
const jpegSize = buf => { // width/height from the JPEG's SOF marker
  for (let i = 2; i < buf.length;) { const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }; i += 2 + len; } return null; };
(async () => {
  const b = await chromium.launch(); const pg = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-AU' })).newPage();
  const logs = []; pg.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  pg.on('console', m => { if (m.text().startsWith('[sync]')) logs.push('SYNC: ' + m.text()); });
  pg.on('dialog', d => { logs.push('DIALOG: ' + d.message().replace(/\n+/g, ' | ')); d.accept(); });
  const live = pg.locator(':not([inert] *)');
  const T = (t, o) => pg.getByText(t, o).and(live).first(); const L = t => pg.getByLabel(t, { exact: true }).and(live).first();
  const tab = n => pg.getByRole('tab', { name: n }).click(); const back = () => pg.getByLabel(/back$/i).and(live).first().click();
  let fails = 0, n = 0;
  const step = async (name, fn) => { try { await fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); await pg.screenshot({ path: `${DIR}/ph-${++n}-FAIL.png` }); } };
  const until = async (fn, ms, msg) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await new Promise(r => setTimeout(r, 500)); } throw new Error(msg); };
  const email = `clutchly.ph.${Date.now()}@gmail.com`, pw = 'Ph-test-pass-1';
  const api = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const files = async folder => (await api.storage.from('animal-photos').list(folder)).data?.map(f => f.name) ?? [];
  const addPhoto = async file => { const [fc] = await Promise.all([pg.waitForEvent('filechooser'), T('Add photo', { exact: true }).click()]); await fc.setFiles(path.join(DIR, file)); };
  let uid, animalId;

  await pg.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await step('sign up, add an animal', async () => {
    const __e = email, __p = pw; await L('Email').fill(__e); await L('Password').fill(__p); await pg.getByRole('button', { name: await require('./e2eAccount.cjs')(__e, __p), exact: true }).first().click(); await pg.getByRole('button', { name: 'Skip for now', exact: true }).click({ timeout: 15000 });
    await T('No animals yet. Add some on the Animals tab.').waitFor({ timeout: 10000 });
    await tab('Animals'); await T('+ Add').click(); await L('Name / ID').fill('PH1');
    await L('Species').click(); await L('Search species').fill('carpet'); await pg.getByRole('button', { name: 'Carpet', exact: true }).and(live).first().click();
    await T('Save', { exact: true }).click(); await T('PH1', { exact: true }).waitFor({ timeout: 8000 });
    await api.auth.signInWithPassword({ email, password: pw }); uid = (await api.auth.getUser()).data.user.id;
    await require('./makePro.cjs')(uid); await pg.reload({ waitUntil: 'networkidle' }); await tab('Animals'); // photos are a Pro feature
    await until(async () => { animalId = (await api.from('animals').select('id').eq('name', 'PH1').maybeSingle()).data?.id; return !!animalId; }, 15000, 'animal not synced');
  });
  await step('add a 2400x1600 photo: uploaded resized to 1200 on the long edge, becomes cover', async () => {
    await T('PH1', { exact: true }).click(); await addPhoto('big.jpg');
    await pg.getByLabel('Cover photo', { exact: true }).and(live).first().waitFor({ timeout: 20000 });
    const names = await files(`${uid}/${animalId}`); if (names.length !== 1) throw new Error('files: ' + names);
    const dl = await api.storage.from('animal-photos').download(`${uid}/${animalId}/${names[0]}`);
    const buf = Buffer.from(await dl.data.arrayBuffer()); const sz = jpegSize(buf);
    if (!sz || Math.max(sz.w, sz.h) !== 1200 || sz.w !== 1200 || sz.h !== 800) throw new Error('size ' + JSON.stringify(sz));
    console.log(`  uploaded ${sz.w}x${sz.h}, ${Math.round(buf.length / 1024)} KB`);
  });
  await step('cover thumbnail on the Animals list (signed URL)', async () => {
    await back(); const img = pg.getByLabel('PH1', { exact: true }).and(live).first(); await img.waitFor({ timeout: 10000 });
    const srcOf = () => img.evaluate(e => (e.tagName === 'IMG' ? e.src : e.querySelector('img')?.src) || '');
    await until(async () => /sign/.test(await srcOf()), 10000, 'thumbnail never loaded'); const src = await srcOf();
    if (!/\/object\/sign\/animal-photos\/.+token=/.test(src)) throw new Error('not a signed URL: ' + src.slice(0, 120));
    await pg.screenshot({ path: `${DIR}/ph-a-list.png` });
  });
  await step('second photo (portrait, 1000x1500 -> 800x1200), set as cover', async () => {
    await T('PH1', { exact: true }).click(); await addPhoto('tall.jpg');
    await until(async () => (await pg.getByLabel(/^(Cover photo|Photo)$/).and(live).count()) === 2, 20000, 'second photo not shown');
    const firstCover = (await api.from('animal_photos').select('path').eq('is_cover', true).single()).data.path;
    await pg.getByLabel('Photo', { exact: true }).and(live).first().click();
    await T('Set as cover', { exact: true }).click();
    await until(async () => { const r = (await api.from('animal_photos').select('path,is_cover')).data ?? []; const c = r.filter(x => x.is_cover); return r.length === 2 && c.length === 1 && c[0].path !== firstCover; }, 15000, 'cover change not synced');
    const cover = (await api.from('animal_photos').select('path').eq('is_cover', true).single()).data.path;
    const sz = jpegSize(Buffer.from(await (await api.storage.from('animal-photos').download(cover)).data.arrayBuffer()));
    if (sz.w !== 800 || sz.h !== 1200) throw new Error('portrait size ' + JSON.stringify(sz));
    await pg.screenshot({ path: `${DIR}/ph-b-gallery.png` });
  });
  await step('delete a photo: row and file gone', async () => {
    await pg.getByLabel('Photo', { exact: true }).and(live).first().click(); await pg.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await until(async () => (await files(`${uid}/${animalId}`)).length === 1, 15000, 'file not removed');
    await until(async () => ((await api.from('animal_photos').select('id')).data ?? []).length === 1, 15000, 'row not removed');
  });
  await step('delete the animal: its photo is cleaned up from storage by the hourly function', async () => {
    await T('Delete', { exact: true }).click(); await T('No animals yet. Tap + Add, or Bulk add to paste a list or import a CSV.').waitFor({ timeout: 8000 });
    await until(async () => ((await api.from('animals').select('id')).data ?? []).length === 0, 15000, 'animal delete not synced');
    if ((await files(`${uid}/${animalId}`)).length !== 1) throw new Error('file should still be there until cleanup runs');
    const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/daily-digest?user=00000000-0000-0000-0000-000000000000`, { method: 'POST', headers: { 'x-cron-secret': process.env.CRON_SECRET } });
    const j = await res.json(); console.log('  cleanup removed', j.photosRemoved, 'file(s)');
    if ((await files(`${uid}/${animalId}`)).length !== 0) throw new Error('file not cleaned up');
  });
  await step('cleanup: delete account', async () => { await api.rpc('delete_my_account'); });
  console.log(logs.filter(l => !l.startsWith('DIALOG: Delete')).join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
