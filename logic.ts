export const SPECIES = ['Carpet', 'Bredli', 'Diamond', 'Antaresia', 'Other'];
export type Animal = { id: string; name: string; species: string; sex: string; status: string; dob?: string; feed_every?: number;
  notes?: string; last_feed?: string; last_shed?: string; last_weight?: number };
export type Season = { species: string; pause_from?: string; pause_to?: string; pair_start?: string };
const noon = (d: string) => new Date(d + 'T12:00:00');
export const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
export const today = () => iso(new Date());
export const addDays = (d: string, n: number) => { const x = noon(d); x.setDate(x.getDate() + n); return iso(x); };
export const diffDays = (a: string, b: string) => Math.round((noon(a).getTime() - noon(b).getTime()) / 864e5);
export const interval = (a: Animal) => a.feed_every || (a.sex === 'Male' ? 21 : 7);
export const nextFeed = (a: Animal) => (a.last_feed ? addDays(a.last_feed, interval(a)) : today());
export function isPaused(s: Season | undefined, d: string) {
  if (!s?.pause_from || !s?.pause_to) return false;
  const m = d.slice(5);
  return s.pause_from <= s.pause_to ? m >= s.pause_from && m <= s.pause_to : m >= s.pause_from || m <= s.pause_to;
}
export const estLay = (p: any): string | null =>
  p.laid || (p.prelay_shed ? addDays(p.prelay_shed, 14) : p.ovulation ? addDays(p.ovulation, 30) : null);
export const pairStatus = (p: any) => p.hatched ? 'Hatched' : p.laid ? 'Eggs laid' : p.prelay_shed ? 'Pre-lay shed'
  : p.ovulation ? 'Ovulated' : p.locks?.length ? 'Locked' : p.removed ? 'Male removed' : 'Paired';
