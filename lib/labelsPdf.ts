// Phones print labels with expo-print (app/labels.tsx); the PDF builder is only in the web app (lib/labelsPdf.web.ts).
import type { LabelAnimal } from './labels';
export function labelsPdf(_animals: LabelAnimal[], _layoutKey: string, _fmtDate: (d: string) => string, _skip = 0): Blob {
  throw new Error('labelsPdf is only used on the web');
}
