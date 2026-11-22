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
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 4, size = n + 2 * m; let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
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

/** A printable HTML document: exact page and label sizes, so it prints at 100% scale on the chosen sheet or roll. */
export function labelsHtml(animals: LabelAnimal[], layoutKey: string, fmtDate: (d: string) => string, skip = 0): string {
  const L = layoutOf(layoutKey); const pad = 2; const qr = Math.min(L.label.h - 2 * pad, L.label.w * 0.4);
  // Text gets what the QR code leaves; long names step down a size and wrap to two lines rather than being cut off.
  const textMm = L.label.w - qr - 2 * pad - 2, base = Math.min(L.label.h < 33 ? 11 : 12, textMm / 2.4), small = L.label.h < 33 ? 7 : 8;
  const nameSize = (n: string) => Math.max(8, Math.round(Math.min(base, (textMm * 2.83 * 1.75) / Math.max(1, n.length)) * 2) / 2);
  const label = (a: LabelAnimal | null) => !a ? '<div class="l"></div>' :
    `<div class="l"><div class="q">${qrSvg(animalLink(a.id))}</div><div class="t"><div class="n" style="font-size:${nameSize(a.name)}pt">${esc(a.name)}</div>${
      labelLines(a, fmtDate).map((x, i) => `<div class="s${i === 0 && a.morph ? ' m' : ''}">${esc(x)}</div>`).join('')}</div></div>`;
  const pages = paginate(animals, L, skip).map(p => `<div class="p">${p.map(label).join('')}</div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(brand.name)} labels</title><style>
@page { size: ${L.page.w}mm ${L.page.h}mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #fff; color: #000; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.p { width: ${L.page.w}mm; height: ${L.page.h}mm; padding: ${L.top}mm 0 0 ${L.left}mm; display: grid; grid-template-columns: repeat(${L.cols}, ${L.label.w}mm);
  grid-auto-rows: ${L.label.h}mm; column-gap: ${L.gapX}mm; row-gap: ${L.gapY}mm; page-break-after: always; break-after: page; overflow: hidden; }
.p:last-child { page-break-after: auto; break-after: auto; }
.l { width: ${L.label.w}mm; height: ${L.label.h}mm; padding: ${pad}mm; display: flex; align-items: center; gap: 2mm; overflow: hidden; }
.q { width: ${qr}mm; height: ${qr}mm; flex: none; } .q svg { width: 100%; height: 100%; display: block; }
.t { min-width: 0; flex: 1; }
.n { font-weight: 700; line-height: 1.1; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 0.5mm; }
.s { font-size: ${small}pt; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
</style></head><body>${pages}</body></html>`;
}
