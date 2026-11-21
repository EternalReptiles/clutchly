export const SPECIES = ['Carpet', 'Bredli', 'Diamond', 'Antaresia', 'Other'];
export const SEXES = ['Female', 'Male'];
export type Animal = { id: string; name: string; species: string; sex: string; status: string; dob?: string | null;
  feed_every?: number | null; notes?: string | null; last_feed?: string | null; last_shed?: string | null; last_weight?: number | null };

// Per-species, per-user settings. A user with no saved row for a species gets DEFAULT_SEASON.
export type Season = {
  species: string;
  pause_from?: string | null; pause_to?: string | null; pair_start?: string | null; // 'MM-DD', repeating yearly
  female_every?: number | null; male_every?: number | null; // default feed interval in days
  prelay_to_lay?: number | null; ovul_to_lay?: number | null; // days, for the estimated lay date
};
export const SEASON_KEYS = ['pause_from', 'pause_to', 'pair_start', 'female_every', 'male_every', 'prelay_to_lay', 'ovul_to_lay'] as const;

// Used when a field is blank.
export const FALLBACK = { female_every: 7, male_every: 21, prelay_to_lay: 30, ovul_to_lay: 45 };

// Starting values for a new account. Every user can change these in the Season tab.
const routine = { pause_from: '05-01', pause_to: '05-31', ...FALLBACK };
export const DEFAULT_SEASON: Record<string, Omit<Season, 'species'>> = {
  Carpet: { ...routine, pair_start: '06-01' },
  Bredli: { ...routine },
  Diamond: { ...routine },
  Antaresia: { ...routine },
  Other: { ...FALLBACK },
};
export const seasonFor = (rows: Season[], species: string): Season =>
  rows.find(r => r.species === species) ?? { species, ...(DEFAULT_SEASON[species] ?? DEFAULT_SEASON.Other) };

const noon = (d: string) => new Date(d + 'T12:00:00');
export const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
export const today = () => iso(new Date());
export const addDays = (d: string, n: number) => { const x = noon(d); x.setDate(x.getDate() + n); return iso(x); };
export const diffDays = (a: string, b: string) => Math.round((noon(a).getTime() - noon(b).getTime()) / 864e5);
export const isIsoDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(noon(d).getTime()) && iso(noon(d)) === d;

// Display helpers use the device's locale, so each user sees their own date format.
export const fmt = (d?: string | null) => d ? noon(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '–';
export const fmtMD = (md?: string | null) => md ? new Date(`2000-${md}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : '–';

export const interval = (a: Animal, s: Season) =>
  a.feed_every || (a.sex === 'Male' ? s.male_every || FALLBACK.male_every : s.female_every || FALLBACK.female_every);
export const nextFeed = (a: Animal, s: Season) => (a.last_feed ? addDays(a.last_feed, interval(a, s)) : today());
export function isPaused(s: Season | undefined, d: string) {
  if (!s?.pause_from || !s?.pause_to) return false;
  const m = d.slice(5);
  return s.pause_from <= s.pause_to ? m >= s.pause_from && m <= s.pause_to : m >= s.pause_from || m <= s.pause_to;
}

export type Pairing = { id?: string; female_id?: string; male_id?: string; intro?: string | null; removed?: string | null;
  ovulation?: string | null; prelay_shed?: string | null; laid?: string | null; hatched?: string | null;
  clutch?: number | null; fertile?: number | null; locks: string[]; notes?: string | null };
export const estLay = (p: Pairing, s: Season): string | null =>
  p.laid || (p.prelay_shed ? addDays(p.prelay_shed, s.prelay_to_lay || FALLBACK.prelay_to_lay)
    : p.ovulation ? addDays(p.ovulation, s.ovul_to_lay || FALLBACK.ovul_to_lay) : null);
export const pairStatus = (p: Pairing) => p.hatched ? 'Hatched' : p.laid ? 'Eggs laid' : p.prelay_shed ? 'Pre-lay shed'
  : p.ovulation ? 'Ovulated' : p.locks?.length ? 'Locked' : p.removed ? 'Male removed' : 'Paired';
