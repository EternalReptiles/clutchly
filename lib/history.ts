// Pure helpers for an animal's history: stats, chart data, filtering. No React Native imports (unit-tested).
import { addDays, diffDays } from './logic';

export type Kind = 'feed' | 'shed' | 'weight';
export type Ev = { id: string; animal_id: string; kind: Kind; on_date: string; ok: boolean | null; food: string | null;
  grams: number | null; note?: string | null; created_at?: string };

export const newestFirst = (a: Ev, b: Ev) => b.on_date.localeCompare(a.on_date) || String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
export const eventLabel = (e: Ev) => e.kind === 'feed' ? (e.ok ? 'Fed' : 'Refused') + (e.food ? ` (${e.food})` : '')
  : e.kind === 'weight' ? `${e.grams} g` : 'Shed';

/** Average days between consecutive sheds (null with fewer than two sheds). */
export function shedStats(events: Ev[]): { count: number; avgDays: number | null } {
  const d = [...new Set(events.filter(e => e.kind === 'shed').map(e => e.on_date))].sort();
  if (d.length < 2) return { count: d.length, avgDays: null };
  return { count: d.length, avgDays: Math.round(diffDays(d[d.length - 1], d[0]) / (d.length - 1)) };
}

/** Feeds offered and refused in the last `days` days, up to and including `today`. */
export function refusalStats(events: Ev[], today: string, days = 90): { offered: number; refused: number; rate: number | null } {
  const from = addDays(today, -(days - 1));
  const feeds = events.filter(e => e.kind === 'feed' && e.on_date >= from && e.on_date <= today);
  const refused = feeds.filter(e => e.ok === false).length;
  return { offered: feeds.length, refused, rate: feeds.length ? refused / feeds.length : null };
}

/** One weight per day (the last one logged that day), oldest first. */
export function weightSeries(events: Ev[]): { date: string; grams: number }[] {
  const byDay = new Map<string, Ev>();
  for (const e of [...events].filter(e => e.kind === 'weight' && e.grams != null).sort((a, b) => -newestFirst(a, b))) byDay.set(e.on_date, e);
  return [...byDay.values()].map(e => ({ date: e.on_date, grams: Number(e.grams) })).sort((a, b) => a.date.localeCompare(b.date));
}

export type Filter = { kinds: Kind[]; from: string | null; to: string | null };
export const filterEvents = (events: Ev[], f: Filter) => events
  .filter(e => f.kinds.includes(e.kind) && (!f.from || e.on_date >= f.from) && (!f.to || e.on_date <= f.to)).sort(newestFirst);

/** Clean axis ticks (1, 2, 2.5 or 5 x 10^n) covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (hi === lo) { hi = lo + 1; lo = Math.max(0, lo - 1); }
  const raw = (hi - lo) / count; const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw)!;
  const out: number[] = []; for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.001; v += step) out.push(+v.toFixed(6));
  if (out[out.length - 1] < hi) out.push(+(out[out.length - 1] + step).toFixed(6));
  return out;
}
