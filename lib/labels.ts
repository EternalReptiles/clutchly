// QR labels for tubs and enclosures (pure apart from the QR encoder; unit-tested in tests/labels.test.mjs).
// Each label has a QR code holding the animal's web address (any phone camera opens it; Clutchly's own Scan button
// opens the animal in the app), with its name, morph, species, sex and hatch date. Printed from app/labels.tsx.
import qrcode from 'qrcode-generator';
import brand from '../brand.json';

export type LabelAnimal = { id: string; name: string; species: string; sex: string; dob?: string | null; morph?: string | null };
export type Layout = { key: string; name: string; page: { w: number; h: number }; label: { w: number; h: number };
  cols: number; rows: number; top: number; left: number; gapX: number; gapY: number };
// Sizes in millimetres. A4 sheets follow the common Avery layouts; label printers print one label per page.
export const LAYOUTS: Layout[] = [
  { key: 'a4-21', name: 'A4 sheet, 21 labels (63.5 × 38.1 mm, e.g. Avery L7160)', page: { w: 210, h: 297 }, label: { w: 63.5, h: 38.1 }, cols: 3, rows: 7, top: 15.15, left: 7.25, gapX: 2.54, gapY: 0 },
  { key: 'a4-14', name: 'A4 sheet, 14 labels (99.1 × 38.1 mm, e.g. Avery L7163)', page: { w: 210, h: 297 }, label: { w: 99.1, h: 38.1 }, cols: 2, rows: 7, top: 15.15, left: 4.65, gapX: 2.5, gapY: 0 },
  { key: 'roll-62x29', name: 'Label printer, 62 × 29 mm (e.g. Brother DK-11209)', page: { w: 62, h: 29 }, label: { w: 62, h: 29 }, cols: 1, rows: 1, top: 0, left: 0, gapX: 0, gapY: 0 },
  { key: 'roll-57x32', name: 'Label printer, 57 × 32 mm (e.g. Dymo 11354)', page: { w: 57, h: 32 }, label: { w: 57, h: 32 }, cols: 1, rows: 1, top: 0, left: 0, gapX: 0, gapY: 0 },
];
export const layoutOf = (key: string) => LAYOUTS.find(l => l.key === key) ?? LAYOUTS[0];

const site = brand.siteUrl.replace(/\/+$/, '');
/** A label's animal opened while signed out on the web, opened by Overview after sign-in. */
export const PENDING_ANIMAL_KEY = 'clutchly.pendingAnimal';
export const animalLink = (id: string) => `${site}/app/animal/${id}`;
/** The animal id from a scanned code: one of our links, or a bare id. Null for anything else. */
export function animalIdFrom(scanned: string): string | null {
  const m = scanned.trim().match(/(?:\/app\/animal\/|^)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i);
  return m ? m[1].toLowerCase() : null;
}
/** The QR code as an SVG (scales to its box; black on white with the standard quiet zone). */
export function qrSvg(text: string): string {
  const { size, dark } = qrModules(text); let d = '';
  for (const [r, c] of dark) d += `M${c} ${r}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** Lines of text on a label, most important first. */
export const labelLines = (a: LabelAnimal, fmtDate: (d: string) => string) =>
  [a.morph || null, `${a.species} · ${a.sex}`, a.dob ? `Hatched ${fmtDate(a.dob)}` : null].filter(Boolean) as string[];

/** Pages of labels: each page is a list of slots, null for a slot left blank (e.g. used labels on a sheet). */
export function paginate<T>(items: T[], layout: Layout, skip = 0): (T | null)[][] {
  const per = layout.cols * layout.rows; const slots: (T | null)[] = [...Array(Math.max(0, Math.min(skip, per - 1))).fill(null), ...items];
  const pages: (T | null)[][] = [];
  for (let i = 0; i < slots.length; i += per) pages.push(slots.slice(i, i + per));
  return pages;
}

/** Sizes inside a label (mm, font sizes in pt), shared by the printed page and the PDF (lib/labelsPdf.web.ts). */
export function labelMetrics(L: Layout) {
  const pad = 2, qr = Math.min(L.label.h - 2 * pad, L.label.w * 0.4);
  // Text gets what the QR code leaves. These are the largest sizes; labelText makes long text smaller so it fits.
  const textMm = L.label.w - qr - 2 * pad - 2, base = Math.min(L.label.h < 33 ? 11 : 12, textMm / 2.4), small = L.label.h < 33 ? 7 : 8;
  return { pad, qr, textMm, base, small };
}

// Helvetica character widths (1/1000 em, characters 32-126), the font labels print in (Arial has the same widths).
const WIDTHS = {
  normal: '280,280,350,550,550,890,660,190,330,330,390,580,280,330,280,280,550,550,550,550,550,550,550,550,550,550,280,280,580,580,580,550,1010,660,660,720,720,660,610,780,720,280,500,660,550,830,720,780,660,780,720,660,610,720,660,940,660,660,610,280,280,280,470,550,330,550,550,500,550,550,280,550,550,220,220,500,220,830,550,550,550,550,330,500,280,550,500,720,500,500,500,330,260,330,580',
  bold: '280,330,470,550,550,890,720,240,330,330,390,580,280,330,280,280,550,550,550,550,550,550,550,550,550,550,330,330,580,580,580,610,970,720,720,720,720,660,610,780,720,280,550,720,610,830,720,780,660,780,720,660,610,720,660,940,660,660,610,330,280,330,580,550,330,550,610,550,610,550,330,610,610,280,280,550,280,890,610,610,610,610,390,550,330,610,550,780,550,550,500,390,280,390,580',
};
const TABLE = { normal: WIDTHS.normal.split(',').map(Number), bold: WIDTHS.bold.split(',').map(Number) };
/** Width of text in mm at a font size in pt, with 6% to spare (other fonts, rounding). */
export function textWidthMm(t: string, pt: number, bold = false) {
  const tb = bold ? TABLE.bold : TABLE.normal; let u = 0;
  for (const ch of t) { const c = ch.charCodeAt(0); u += c >= 32 && c < 127 ? tb[c - 32] : ch === '…' ? 1000 : ch === '·' ? 280 : 620; }
  return u / 1000 * pt * 25.4 / 72 * 1.06;
}
/** Text broken into lines no wider than `w` mm (at spaces; a word too long for a line is split). "· x" stays together. */
export function wrapText(t: string, w: number, pt: number, bold = false): string[] {
  const words = t.trim().split(/\s+/).reduce<string[]>((a, x) => { if (a.length && a[a.length - 1] === '·') a[a.length - 1] += ' ' + x; else a.push(x); return a; }, []);
  const lines: string[] = []; let cur = '';
  const fits = (x: string) => textWidthMm(x, pt, bold) <= w;
  for (let word of words) {
    const tryLine = cur ? cur + ' ' + word : word;
    if (fits(tryLine)) { cur = tryLine; continue; }
    if (cur) { lines.push(cur); cur = ''; }
    while (!fits(word)) { let i = word.length - 1; while (i > 1 && !fits(word.slice(0, i))) i--; lines.push(word.slice(0, i)); word = word.slice(i); }
    cur = word;
  }
  if (cur) lines.push(cur);
  return lines;
}
export type TextBlock = { lines: string[]; pt: number; bold: boolean; lh: number };
/** The largest size (from maxPt down to minPt) at which text fits in maxLines; at minPt the last line ends in … */
function fitText(t: string, w: number, maxLines: number, maxPt: number, minPt: number, bold: boolean, lh: number): TextBlock {
  // First without splitting a word (ER2024-CLUTCH3-07 goes smaller rather than breaking), then splitting if it must.
  const words = t.trim().split(/\s+/).length;
  // One line if it's at most 1pt smaller (not below 7pt); otherwise wrap at the largest size.
  for (let pt = maxPt; pt >= Math.max(minPt, maxPt - 1, 7); pt -= 0.5) { const lines = wrapText(t, w, pt, bold); if (lines.length === 1) return { lines, pt, bold, lh }; }
  for (const whole of [true, false]) for (let pt = maxPt; pt >= minPt; pt -= 0.5) {
    const lines = wrapText(t, w, pt, bold);
    if (lines.length <= maxLines && (!whole || lines.length <= words)) return { lines, pt, bold, lh };
  }
  const lines = wrapText(t, w, minPt, bold).slice(0, maxLines); let last = lines[maxLines - 1] ?? '';
  while (last.length > 1 && textWidthMm(last + '…', minPt, bold) > w) last = last.slice(0, -1);
  lines[maxLines - 1] = last.trimEnd() + '…';
  return { lines, pt: minPt, bold, lh };
}
export const blockHeightMm = (b: TextBlock) => b.lines.length * b.pt * b.lh * 25.4 / 72;
/** A label's text, sized and broken into lines so it fits the space beside the QR code (name first, in bold). */
export function labelText(a: LabelAnimal, L: Layout, fmtDate: (d: string) => string): TextBlock[] {
  const { pad, textMm, base, small } = labelMetrics(L); const room = L.label.h - 2 * pad;
  const details = labelLines(a, fmtDate);
  let blocks: TextBlock[] = [];
  for (let step = 0; step <= 12; step++) {
    const nameMax = Math.max(7, base - step * 0.5), smallMax = Math.max(6, small - step * 0.25), morphLines = step > 8 ? 1 : 2;
    blocks = [fitText(a.name, textMm, 2, nameMax, Math.min(nameMax, 7), true, 1.1),
      ...details.map((x, i) => fitText(x, textMm, i === 0 && a.morph ? morphLines : i === details.length - 1 && a.dob ? 1 : 2, smallMax, Math.min(smallMax, 6), false, 1.25))];
    if (blocks.reduce((h, b) => h + blockHeightMm(b), 0.5) <= room) break;
  }
  return blocks;
}

/** The QR code's squares (row, column), and its size in squares including the white border round it. */
export function qrModules(text: string) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 4, dark: [number, number][] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) dark.push([r + m, c + m]);
  return { size: n + 2 * m, dark };
}

/** A printable HTML document: exact page and label sizes, so it prints at 100% scale on the chosen sheet or roll. */
export function labelsHtml(animals: LabelAnimal[], layoutKey: string, fmtDate: (d: string) => string, skip = 0): string {
  const L = layoutOf(layoutKey); const { pad, qr, textMm } = labelMetrics(L);
  // Text is laid out here (labelText), one line per div, so the printer never wraps or cuts it differently.
  const label = (a: LabelAnimal | null) => !a ? '<div class="l"></div>' :
    `<div class="l"><div class="q">${qrSvg(animalLink(a.id))}</div><div class="t">${labelText(a, L, fmtDate).map((b, i) =>
      `<div class="${b.bold ? 'n' : 's'}" style="font-size:${b.pt}pt;line-height:${b.lh}">${b.lines.map(x => `<div>${esc(x)}</div>`).join('')}</div>`).join('')}</div></div>`;
  const pages = paginate(animals, L, skip).map(p => `<div class="p">${p.map(label).join('')}</div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(brand.name)} labels</title><style>
@page { size: ${L.page.w}mm ${L.page.h}mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #fff; color: #000; font-family: Helvetica, Arial, 'Liberation Sans', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.p { width: ${L.page.w}mm; height: ${L.page.h}mm; padding: ${L.top}mm 0 0 ${L.left}mm; display: grid; grid-template-columns: repeat(${L.cols}, ${L.label.w}mm);
  grid-auto-rows: ${L.label.h}mm; column-gap: ${L.gapX}mm; row-gap: ${L.gapY}mm; page-break-after: always; break-after: page; overflow: hidden; }
.p:last-child { page-break-after: auto; break-after: auto; }
.l { width: ${L.label.w}mm; height: ${L.label.h}mm; padding: ${pad}mm; display: flex; align-items: center; gap: 2mm; overflow: hidden; }
.q { width: ${qr}mm; height: ${qr}mm; flex: none; } .q svg { width: 100%; height: 100%; display: block; }
.t { width: ${textMm}mm; flex: none; }
.t div { white-space: nowrap; overflow: hidden; }
.n { font-weight: 700; margin-bottom: 0.5mm; }
</style></head><body>${pages}</body></html>`;
}
