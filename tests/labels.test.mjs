// Unit tests for lib/labels.ts, plus a print check: renders a sheet in Chromium and decodes every QR code from the image.
// Run: npx tsc lib/labels.ts --outDir /tmp/lb --rootDir . --module commonjs --target es2020 --resolveJsonModule --esModuleInterop \
//        && NODE_PATH=$PWD/node_modules node tests/labels.test.mjs /tmp/lb /path/to/dir-with-jsqr-and-pngjs
// (jsqr and pngjs are only needed for the decode check: npm install jsqr pngjs in any folder and pass it.)
import { createRequire } from 'node:module'; import path from 'node:path';
const [out, decDir] = process.argv.slice(2); const require = createRequire(import.meta.url);
const Lb = require(path.resolve(out, 'lib/labels.js'));
let fails = 0; const ok = (c, m, got) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (c ? '' : '  got ' + JSON.stringify(got))); if (!c) fails++; };
const id = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b';

ok(Lb.animalLink(id) === `https://clutchly.com.au/app/animal/${id}`, 'label link is the animal\'s web address', Lb.animalLink(id));
ok(Lb.animalIdFrom(`https://clutchly.com.au/app/animal/${id}`) === id, 'scan: our link');
ok(Lb.animalIdFrom(`https://clutchly.com.au/app/animal/${id.toUpperCase()}?x=1`) === id, 'scan: any case, with a query');
ok(Lb.animalIdFrom(id) === id, 'scan: bare id');
ok(Lb.animalIdFrom('https://example.com/whatever') === null && Lb.animalIdFrom(`${id}0`) === null, 'scan: anything else is ignored');
const L21 = Lb.layoutOf('a4-21');
ok(Lb.paginate([1, 2, 3], L21).length === 1 && Lb.paginate(Array(22).fill(1), L21).length === 2, '21 per A4 sheet');
const sk = Lb.paginate([1, 2], L21, 5); ok(sk[0].length === 7 && sk[0].slice(0, 5).every(x => x === null) && sk[0][5] === 1, 'skip used labels at the start of a sheet', sk);
ok(Lb.paginate([1], L21, 99)[0].length === 21, 'skip is capped so at least one label prints on the first sheet');
ok(Lb.paginate([1, 2], Lb.layoutOf('roll-62x29')).length === 2, 'label printer: one per page');
ok(Lb.layoutOf('nope').key === 'a4-21', 'unknown layout falls back to A4');
for (const L of Lb.LAYOUTS) {
  const right = L.left + L.cols * L.label.w + (L.cols - 1) * L.gapX, bottom = L.top + L.rows * L.label.h + (L.rows - 1) * L.gapY;
  ok(right <= L.page.w + 0.01 && bottom <= L.page.h + 0.01, `${L.key}: labels fit on the page`, { right, bottom });
}
const a = { id, name: 'ER<001>', species: 'Carpet', sex: 'Female', dob: '2025-12-01', morph: 'Jaguar het Albino' };
const fmtDate = d => d.split('-').reverse().join('/');
ok(JSON.stringify(Lb.labelLines(a, fmtDate)) === JSON.stringify(['Jaguar het Albino', 'Carpet · Female', 'Hatched 01/12/2025']), 'label text', Lb.labelLines(a, fmtDate));
ok(JSON.stringify(Lb.labelLines({ ...a, morph: null, dob: null }, fmtDate)) === JSON.stringify(['Carpet · Female']), 'label text without morph or date');
const html = Lb.labelsHtml([a, { ...a, id: id.replace('3f', '4f'), name: 'B2' }], 'a4-21', fmtDate, 1);
ok(html.includes('ER&lt;001&gt;') && !html.includes('ER<001>'), 'names are escaped');
ok(html.includes('@page { size: 210mm 297mm') && (html.match(/class="l"/g) || []).length === 3, 'A4 page with a blank first slot and two labels');

// Text fits: every line within the width beside the QR code and the whole block within the label, on every size.
const hard = [{ ...a, name: 'ER2024-CLUTCH3-07', species: 'Rough-scaled python', sex: 'Unknown', morph: 'Het Albino Zebra Jaguar Sunglow het Hypo pos het Axanthic' },
  { ...a, name: 'Princess Buttercup the Second', species: 'Black-headed python' }, { ...a, name: 'WWWWWWWWWWWWWWWWWWWW', species: 'Eastern long-necked turtle', morph: null },
  { ...a, name: 'ER014', species: "Children's python", morph: null }];
for (const L of Lb.LAYOUTS) {
  const { textMm, pad } = Lb.labelMetrics(L); let widest = 0, tallest = 0;
  for (const x of hard) { const bl = Lb.labelText(x, L, fmtDate);
    widest = Math.max(widest, ...bl.flatMap(b => b.lines.map(t => Lb.textWidthMm(t, b.pt, b.bold))));
    tallest = Math.max(tallest, bl.reduce((h, b) => h + Lb.blockHeightMm(b), 0.5)); }
  ok(widest <= textMm && tallest <= L.label.h - 2 * pad, `${L.key}: long names, genes and species fit (widest ${widest.toFixed(1)} of ${textMm.toFixed(1)} mm)`);
}
const t21 = Lb.labelText(hard[0], Lb.layoutOf('a4-21'), fmtDate);
ok(t21[0].lines.length === 1 && t21[0].lines[0] === 'ER2024-CLUTCH3-07', 'a long ID gets smaller rather than split', t21[0]);
ok(Lb.labelText(hard[3], Lb.layoutOf('a4-21'), fmtDate)[1].lines.join('|') === "Children's python · Female", 'species and sex stay on one line when a little smaller fits');
ok(Lb.labelText(a, Lb.layoutOf('a4-14'), fmtDate)[0].pt === 12, 'short names stay at full size');

if (decDir) {
  const { chromium } = require('playwright'); const jsQR = require(path.resolve(decDir, 'node_modules/jsqr')); const { PNG } = require(path.resolve(decDir, 'node_modules/pngjs'));
  // About 290 dpi: a 96-dpi page at 3x.
  const b = await chromium.launch(); const pg = await b.newPage({ deviceScaleFactor: 3 });
  for (const key of Lb.LAYOUTS.map(l => l.key)) {
    await pg.setContent(Lb.labelsHtml([a], key, fmtDate)); const box = await pg.locator('.q').first().boundingBox();
    const png = PNG.sync.read(await pg.locator('.l').first().screenshot()); const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    ok(code?.data === Lb.animalLink(id), `${key}: printed QR code decodes to the animal's link (${Math.round(box.width / 96 * 25.4)} mm wide)`, code?.data);
  }
  await b.close();
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
