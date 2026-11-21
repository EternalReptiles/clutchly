export const SPECIES = ['Carpet', 'Bredli', 'Diamond', 'Antaresia', 'Other'];
export const SEXES = ['Female', 'Male'];
export type Animal = { id: string; name: string; species: string; sex: string; status: string; dob?: string | null;
  feed_every?: number | null; notes?: string | null; last_feed?: string | null; last_shed?: string | null; last_weight?: number | null };

// Per-species, per-user settings (the user's routine). New accounts start with none: no feeding pause, no pairing dates.
export type Season = {
  species: string;
  pause_from?: string | null; pause_to?: string | null; pair_start?: string | null; // 'MM-DD', repeating yearly
  female_every?: number | null; male_every?: number | null; // default feed interval in days
  prelay_to_lay?: number | null; ovul_to_lay?: number | null; // days, for the estimated lay date
};
export const SEASON_KEYS = ['pause_from', 'pause_to', 'pair_start', 'female_every', 'male_every', 'prelay_to_lay', 'ovul_to_lay'] as const;

// Suggested values, used only while a field is blank. Shown as placeholders on the Season tab.
export const FALLBACK = { female_every: 7, male_every: 21 };
type Range = [number, number];
// Typical days to lay, from breeder reference ranges (vary with the animal and temperature).
// The suggestion is the middle of the range; each user can set their own per species.
const LAY_RANGES: Record<string, { prelay_to_lay: Range; ovul_to_lay: Range }> = {
  Carpet: { prelay_to_lay: [21, 28], ovul_to_lay: [42, 55] },
  Diamond: { prelay_to_lay: [21, 28], ovul_to_lay: [42, 55] },
  Bredli: { prelay_to_lay: [25, 35], ovul_to_lay: [50, 65] },
  Antaresia: { prelay_to_lay: [20, 28], ovul_to_lay: [35, 48] },
  Other: { prelay_to_lay: [20, 35], ovul_to_lay: [35, 65] },
};
export type Suggested = { female_every: number; male_every: number; prelay_to_lay: number; ovul_to_lay: number;
  range: Partial<Record<'prelay_to_lay' | 'ovul_to_lay', Range>> };
export const suggested = (species: string): Suggested => {
  const r = LAY_RANGES[species] ?? LAY_RANGES.Other; const mid = (x: Range) => Math.round((x[0] + x[1]) / 2);
  return { ...FALLBACK, prelay_to_lay: mid(r.prelay_to_lay), ovul_to_lay: mid(r.ovul_to_lay), range: r };
};

export const seasonFor = (rows: Season[], species: string): Season => rows.find(r => r.species === species) ?? { species };

const noon = (d: string) => new Date(d + 'T12:00:00');
export const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
export const today = () => iso(new Date());
export const addDays = (d: string, n: number) => { const x = noon(d); x.setDate(x.getDate() + n); return iso(x); };
export const diffDays = (a: string, b: string) => Math.round((noon(a).getTime() - noon(b).getTime()) / 864e5);
export const isIsoDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(noon(d).getTime()) && iso(noon(d)) === d;

// Date display format, chosen per user on the Season tab and stored on their account.
// 'auto' follows the phone's region setting.
export type DateFormat = 'auto' | 'au' | 'us';
export const DATE_FORMATS: [DateFormat, string][] = [['auto', 'Phone setting'], ['au', 'Australian'], ['us', 'US']];
let locale: string | undefined;
export const setDateFormat = (f?: string | null) => { locale = f === 'au' ? 'en-AU' : f === 'us' ? 'en-US' : undefined; };
// True if dates are written day-first (31/01/2024) for this user: their setting, or the phone's region.
export const isDayFirst = () => {
  const parts = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(new Date(2024, 0, 31));
  return parts.findIndex(p => p.type === 'day') < parts.findIndex(p => p.type === 'month');
};
export const fmt = (d?: string | null) => d ? noon(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '–';
export const fmtMD = (md?: string | null) => md ? new Date(`2000-${md}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long' }) : '–';

export const interval = (a: Animal, s: Season) =>
  a.feed_every || (a.sex === 'Male' ? s.male_every || suggested(a.species).male_every : s.female_every || suggested(a.species).female_every);
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
  p.laid || (p.prelay_shed ? addDays(p.prelay_shed, s.prelay_to_lay || suggested(s.species).prelay_to_lay)
    : p.ovulation ? addDays(p.ovulation, s.ovul_to_lay || suggested(s.species).ovul_to_lay) : null);
export const pairStatus = (p: Pairing) => p.hatched ? 'Hatched' : p.laid ? 'Eggs laid' : p.prelay_shed ? 'Pre-lay shed'
  : p.ovulation ? 'Ovulated' : p.locks?.length ? 'Locked' : p.removed ? 'Male removed' : 'Paired';
