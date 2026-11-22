// Incubation log summary for a clutch (pure; unit-tested in tests/incubation.test.js). Readings come from the
// incubation_logs table (migration 017), newest first after sortReadings.
import { diffDays } from './logic';

export type Reading = { id: string; pairing_id: string; on_date: string; temp: number | string | null; humidity: number | string | null;
  eggs_good: number | null; note: string | null; created_at?: string };
/** How far from the target temperature (°C) a reading can be before it's flagged. */
export const TEMP_TOLERANCE = 1;

const num = (v: unknown) => v === null || v === undefined || v === '' ? null : Number(v);
export const sortReadings = (rs: Reading[]) => [...rs].sort((a, b) => b.on_date.localeCompare(a.on_date) || String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
export const offTarget = (r: Reading, target?: number | string | null) => {
  const t = num(r.temp), g = num(target); return t !== null && g !== null && Math.abs(t - g) > TEMP_TOLERANCE + 1e-9;
};

export type Summary = { day: number | null; readings: number; temp: [number, number] | null; humidity: [number, number] | null;
  offTarget: number; eggsGood: number | null; lastChecked: string | null; sinceChecked: number | null };
/** Day of incubation (lay day = day 0, up to the hatch date if hatched), ranges, readings off target, latest good-egg count. */
export function summary(readings: Reading[], laid: string | null | undefined, hatched: string | null | undefined, target: number | string | null | undefined, today: string): Summary {
  const rs = sortReadings(readings);
  const range = (k: 'temp' | 'humidity') => { const v = rs.map(r => num(r[k])).filter((x): x is number => x !== null); return v.length ? [Math.min(...v), Math.max(...v)] as [number, number] : null; };
  const latestEggs = rs.find(r => r.eggs_good !== null && r.eggs_good !== undefined);
  const last = rs[0]?.on_date ?? null;
  return {
    day: laid ? diffDays(hatched && hatched < today ? hatched : today, laid) : null, readings: rs.length,
    temp: range('temp'), humidity: range('humidity'), offTarget: rs.filter(r => offTarget(r, target)).length,
    eggsGood: latestEggs ? Number(latestEggs.eggs_good) : null, lastChecked: last, sinceChecked: last ? diffDays(today, last) : null,
  };
}
/** "31.5 °C · 75% · 8 good · note" */
export const readingText = (r: Reading) => [num(r.temp) !== null && `${num(r.temp)} °C`, num(r.humidity) !== null && `${num(r.humidity)}%`,
  r.eggs_good !== null && r.eggs_good !== undefined && `${r.eggs_good} good`, r.note].filter(Boolean).join(' · ');
