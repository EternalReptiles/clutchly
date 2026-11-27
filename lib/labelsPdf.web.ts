// The labels as a PDF, for the web app (lib/labelsPdf.ts on phones, which print through expo-print instead).
// Added to an iPhone's home screen, the web app can't print, but it can share a PDF: the share sheet has Print.
// Same layout as labelsHtml in lib/labels.ts: exact page and label sizes, so it prints at 100%.
import { jsPDF } from 'jspdf';
import { animalLink, blockHeightMm, labelMetrics, labelText, layoutOf, paginate, qrModules, type LabelAnimal } from './labels';

const PT = 25.4 / 72; // mm per point

export function labelsPdf(animals: LabelAnimal[], layoutKey: string, fmtDate: (d: string) => string, skip = 0): Blob {
  const L = layoutOf(layoutKey); const { pad, qr } = labelMetrics(L);
  const landscape = L.page.w > L.page.h;
  const doc = new jsPDF({ unit: 'mm', format: [L.page.w, L.page.h], orientation: landscape ? 'landscape' : 'portrait', compress: true });
  doc.setProperties({ title: 'Clutchly labels' }); doc.setTextColor(0, 0, 0);
  paginate(animals, L, skip).forEach((page, pi) => {
    if (pi) doc.addPage([L.page.w, L.page.h], landscape ? 'landscape' : 'portrait');
    page.forEach((a, i) => {
      if (!a) return;
      const x0 = L.left + (i % L.cols) * (L.label.w + L.gapX), y0 = L.top + Math.floor(i / L.cols) * (L.label.h + L.gapY);
      // QR code, white border included, centred top to bottom.
      const q = qrModules(animalLink(a.id)), cell = qr / q.size, qx = x0 + pad, qy = y0 + (L.label.h - qr) / 2;
      doc.setFillColor(0, 0, 0);
      for (const [r, c] of q.dark) doc.rect(qx + c * cell, qy + r * cell, cell + 0.01, cell + 0.01, 'F');
      // Text already sized and broken into lines that fit (labelText), centred as a block.
      const blocks = labelText(a, L, fmtDate), tx = qx + qr + 2;
      let y = y0 + (L.label.h - blocks.reduce((h, b) => h + blockHeightMm(b), 0.5)) / 2;
      blocks.forEach((b, k) => {
        doc.setFont('helvetica', b.bold ? 'bold' : 'normal'); doc.setFontSize(b.pt); const lh = b.pt * b.lh * PT;
        for (const t of b.lines) { doc.text(t, tx, y + lh * 0.78); y += lh; }
        if (k === 0) y += 0.5;
      });
    });
  });
  return doc.output('blob');
}
