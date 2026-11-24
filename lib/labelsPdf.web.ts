// The labels as a PDF, for the web app (lib/labelsPdf.ts on phones, which print through expo-print instead).
// Added to an iPhone's home screen, the web app can't print, but it can share a PDF: the share sheet has Print.
// Same layout as labelsHtml in lib/labels.ts: exact page and label sizes, so it prints at 100%.
import { jsPDF } from 'jspdf';
import { animalLink, labelLines, labelMetrics, layoutOf, paginate, qrModules, type LabelAnimal } from './labels';

const PT = 25.4 / 72; // mm per point

export function labelsPdf(animals: LabelAnimal[], layoutKey: string, fmtDate: (d: string) => string, skip = 0): Blob {
  const L = layoutOf(layoutKey); const { pad, qr, textMm, small, nameSize } = labelMetrics(L);
  const landscape = L.page.w > L.page.h;
  const doc = new jsPDF({ unit: 'mm', format: [L.page.w, L.page.h], orientation: landscape ? 'landscape' : 'portrait', compress: true });
  doc.setProperties({ title: 'Clutchly labels' });
  // Lines that fit the text width: at most `max`, the last one cut short with … if needed.
  const fit = (t: string, size: number, max: number) => {
    doc.setFontSize(size); const lines: string[] = doc.splitTextToSize(t, textMm);
    if (lines.length <= max) return lines;
    let last = lines.slice(max - 1).join(' ');
    while (last.length > 1 && doc.getTextWidth(last + '…') > textMm) last = last.slice(0, -1);
    return [...lines.slice(0, max - 1), last.trimEnd() + '…'];
  };
  paginate(animals, L, skip).forEach((page, pi) => {
    if (pi) doc.addPage([L.page.w, L.page.h], landscape ? 'landscape' : 'portrait');
    page.forEach((a, i) => {
      if (!a) return;
      const x0 = L.left + (i % L.cols) * (L.label.w + L.gapX), y0 = L.top + Math.floor(i / L.cols) * (L.label.h + L.gapY);
      // QR code, white border included, centred top to bottom.
      const q = qrModules(animalLink(a.id)), cell = qr / q.size, qx = x0 + pad, qy = y0 + (L.label.h - qr) / 2;
      doc.setFillColor(0, 0, 0);
      for (const [r, c] of q.dark) doc.rect(qx + c * cell, qy + r * cell, cell + 0.01, cell + 0.01, 'F');
      // Name (bold, up to two lines), then morph (up to two lines), species · sex and hatch date, centred as a block.
      const ns = nameSize(a.name); doc.setFont('helvetica', 'bold'); const name = fit(a.name, ns, 2);
      doc.setFont('helvetica', 'normal');
      const rest = labelLines(a, fmtDate).flatMap((t, k) => fit(t, small, k === 0 && a.morph ? 2 : 1));
      const nameH = ns * 1.1 * PT, restH = small * 1.25 * PT;
      const h = name.length * nameH + 0.5 + rest.length * restH; const tx = qx + qr + 2;
      let y = y0 + (L.label.h - h) / 2;
      doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(ns);
      for (const t of name) { doc.text(t, tx, y + nameH * 0.8); y += nameH; }
      y += 0.5; doc.setFont('helvetica', 'normal'); doc.setFontSize(small);
      for (const t of rest) { doc.text(t, tx, y + restH * 0.78); y += restH; }
    });
  });
  return doc.output('blob');
}
