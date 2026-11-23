// Pure rules for the morning notification. No Deno or network code here, so it can be tested anywhere.
import { addDays, diffDays, estimates, feedHold, isPaused, nextFeed, seasonFor, type Animal, type Pairing, type Season } from './shared/logic.ts';
import { speciesInfo } from './shared/species.ts';

export type Settings = { feed_due: boolean; lay_soon: boolean; pairing_soon: boolean };
export type Msg = { kind: 'feed' | 'lay' | 'pairing'; title: string; body: string };
export const LAY_DAYS_BEFORE = 7, PAIRING_DAYS_BEFORE = 3;

/** Next date (on or after `from`) that a yearly 'MM-DD' falls on. 29 Feb falls back to 28 Feb in other years. */
export function nextYearly(md: string, from: string): string {
  const y = +from.slice(0, 4);
  const at = (yr: number) => { const leap = (yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0; return `${yr}-${md === '02-29' && !leap ? '02-28' : md}`; };
  return at(y) >= from ? at(y) : at(y + 1);
}

/** Animals due (or overdue) to feed on `today`, skipping Sold animals, species in their feeding pause, and animals in
 * shed or with the male still in (lib/logic.ts feedHold). */
export function dueToFeed(animals: Animal[], seasons: Season[], today: string, pairings: Pairing[] = []): Animal[] {
  return animals.filter(a => a.status !== 'Sold').filter(a => {
    const s = seasonFor(seasons, a.species);
    return !isPaused(s, today) && !feedHold(a, pairings, today) && diffDays(nextFeed(a, s, today), today) <= 0;
  });
}

/** The notifications one user should get on their local date `today`. Empty when nothing is due. */
export function buildDigest(today: string, settings: Settings, animals: Animal[], seasons: Season[], pairings: Pairing[]): Msg[] {
  const out: Msg[] = [];
  if (settings.feed_due) {
    const due = dueToFeed(animals, seasons, today, pairings);
    if (due.length) out.push({ kind: 'feed', title: 'Feeding today',
      body: `${due.length} animal${due.length === 1 ? '' : 's'} due to feed today` + (due.length <= 3 ? `: ${due.map(a => a.name).join(', ')}` : '') });
  }
  if (settings.lay_soon) {
    const byId = new Map(animals.map(a => [a.id, a]));
    const soon = pairings.filter(p => !p.laid).map(p => {
      const f = byId.get(p.female_id!); const m = byId.get(p.male_id!);
      const lay = estimates(p, seasonFor(seasons, f?.species || 'Other')).lay;
      return { p, f, m, lay, live: speciesInfo(f?.species).repro === 'live' };
    }).filter(x => x.lay && diffDays(x.lay, today) === LAY_DAYS_BEFORE);
    if (soon.length) out.push({ kind: 'lay', title: soon.some(x => x.live) && soon.every(x => x.live) ? 'Birth expected in a week' : 'Lay expected in a week',
      body: soon.map(x => `${x.f?.name ?? '?'} × ${x.m?.name ?? '?'}`).join(', ') });
  }
  if (settings.pairing_soon) {
    const kept = new Set(animals.filter(a => a.status !== 'Sold').map(a => a.species));
    const starting = seasons.filter(s => s.pair_start && kept.has(s.species) && nextYearly(s.pair_start, today) === addDays(today, PAIRING_DAYS_BEFORE));
    if (starting.length) out.push({ kind: 'pairing', title: 'Pairing season soon',
      body: `${starting.map(s => s.species).join(', ')} ${starting.length === 1 ? 'pairing starts' : 'pairings start'} in ${PAIRING_DAYS_BEFORE} days` });
  }
  return out;
}

/** The user's local date and hour right now, or null if the timezone is not valid. */
export function localNow(now: Date, timeZone: string): { date: string; hour: number } | null {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(now).map(x => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour };
  } catch { return null; }
}
