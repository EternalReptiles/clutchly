import { speciesInfo, type Range } from './species';
export { SPECIES } from './species';
export const SEXES = ['Female', 'Male', 'Unknown']; // Unknown: unsexed (e.g. hatchlings); fed on the female interval
export type Animal = { id: string; name: string; species: string; sex: string; status: string; dob?: string | null;
  mother_id?: string | null; father_id?: string | null; pairing_id?: string | null; created_at?: string;
  feed_every?: number | null; notes?: string | null; last_feed?: string | null; last_shed?: string | null; last_weight?: number | null };

// Per-species, per-user settings (the user's routine). New accounts start with none: no feeding pause, no pairing dates.
export type Season = {
  species: string;
  pause_from?: string | null; pause_to?: string | null; pair_start?: string | null; // 'MM-DD', repeating yearly
  female_every?: number | null; male_every?: number | null; // default feed interval in days
  prelay_to_lay?: number | null; ovul_to_lay?: number | null; // days, for the estimated lay (or birth) date
  lay_to_hatch?: number | null; // days, for the estimated hatch date
};
export const SEASON_KEYS = ['pause_from', 'pause_to', 'pair_start', 'female_every', 'male_every', 'prelay_to_lay', 'ovul_to_lay', 'lay_to_hatch'] as const;

// Suggested values, used only while a field is blank. Shown as placeholders on the Season tab.
export const FALLBACK = { female_every: 7, male_every: 21 };
export type TimingKey = 'prelay_to_lay' | 'ovul_to_lay' | 'lay_to_hatch';
export type Suggested = { female_every: number; male_every: number } & Partial<Record<TimingKey, number>> & { range: Partial<Record<TimingKey, Range>> };
// Suggested numbers for a species: the middle of its typical range (see lib/species.ts).
export const suggested = (species: string): Suggested => {
  const i = speciesInfo(species); const mid = (x?: Range) => x ? Math.round((x[0] + x[1]) / 2) : undefined;
  return { ...FALLBACK, prelay_to_lay: mid(i.prelay_to_lay), ovul_to_lay: mid(i.ovul_to_lay), lay_to_hatch: mid(i.lay_to_hatch),
    range: { prelay_to_lay: i.prelay_to_lay, ovul_to_lay: i.ovul_to_lay, lay_to_hatch: i.lay_to_hatch } };
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
export const fmtHour = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
export const fmtDay = (d: string) => noon(d).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
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
// Estimated dates for a pairing, from fixed reference figures for the female's species (see lib/species.ts; the
// middle of each typical range). `s` is the female's species settings (only its species is used here).
//   prelay: expected pre-lay shed (pythons), from ovulation: ovulation-to-lay minus pre-lay-shed-to-lay days
//   lay:    the lay (or birth, for live-bearers): from the pre-lay shed if recorded, else from ovulation / mating
//   hatch:  from the lay date
export function estimates(p: Pairing, s: Season): { prelay: string | null; lay: string | null; hatch: string | null } {
  const sg = suggested(s.species); const repro = speciesInfo(s.species).repro;
  const prelay = sg.prelay_to_lay, ovul = sg.ovul_to_lay, hatch = sg.lay_to_hatch;
  const estPrelay = repro === 'python' && !p.laid && !p.prelay_shed && p.ovulation && ovul && prelay && ovul > prelay
    ? addDays(p.ovulation, ovul - prelay) : null;
  const lay = p.laid || (repro === 'python' && p.prelay_shed && prelay ? addDays(p.prelay_shed, prelay)
    : p.ovulation && ovul ? addDays(p.ovulation, ovul) : null);
  return { prelay: estPrelay, lay, hatch: repro === 'live' ? null : p.hatched || (p.laid && hatch ? addDays(p.laid, hatch) : null) };
}
/** The next stage still to happen and its expected date, e.g. after ovulation: { key: 'prelay_shed', date }. */
export function nextStage(p: Pairing, s: Season): { key: 'prelay_shed' | 'laid' | 'hatched'; date: string } | null {
  const e = estimates(p, s);
  if (e.prelay) return { key: 'prelay_shed', date: e.prelay };
  if (!p.laid && e.lay) return { key: 'laid', date: e.lay };
  if (p.laid && !p.hatched && e.hatch) return { key: 'hatched', date: e.hatch };
  return null;
}
export const estLay = (p: Pairing, s: Season) => estimates(p, s).lay;
export function pairStatus(p: Pairing, species?: string) {
  const r = speciesInfo(species).repro;
  if (r === 'live') return p.laid ? 'Born' : p.ovulation ? 'Gravid' : p.locks?.length ? 'Mated' : p.removed ? 'Male removed' : 'Paired';
  return p.hatched ? 'Hatched' : p.laid ? 'Eggs laid' : r === 'python' && p.prelay_shed ? 'Pre-lay shed'
    : p.ovulation ? (r === 'python' ? 'Ovulated' : 'Gravid') : p.locks?.length ? (r === 'python' ? 'Locked' : 'Mated') : p.removed ? 'Male removed' : 'Paired';
}
