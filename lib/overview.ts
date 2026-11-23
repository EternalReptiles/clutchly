// The Overview tab: what's due now, the next 7 days day by day, things that need a look, and the last 7 days.
// Pure (unit-tested in tests/overview.test.js); works from the local store, so it works offline.
import { addDays, diffDays, estimates, feedHold, isPaused, nextFeed, seasonFor, type Animal, type FeedHold, type Pairing, type Season } from './logic';

export type Ev = { animal_id: string; kind: string; on_date: string; ok: boolean | null; created_at?: string };
export type DayItem =
  | { kind: 'feed'; animals: Animal[] }
  | { kind: 'prelay' | 'lay' | 'hatch'; pairing: Pairing; female?: Animal; male?: Animal }
  | { kind: 'season'; text: string };
export type Overview = {
  dueNow: { a: Animal; due: string }[];
  held: { a: Animal; hold: FeedHold }[];   // not due because they're in shed or the male is still in
  days: { date: string; items: DayItem[] }[];
  attention: { text: string; animalId?: string; pairingId?: string }[];
  later: { text: string; date: string }[];
  week: { feeds: number; lays: number; hatches: number };
  last7: { fed: number; refused: number; sheds: number; weights: number };
};

export function overview(animals: Animal[], events: Ev[], pairings: Pairing[], seasons: Season[], t: string): Overview {
  const active = animals.filter(a => a.status !== 'Sold');
  const byId = new Map(animals.map(a => [a.id, a]));
  const names = new Map(animals.map(a => [a.id, a.name]));
  const feedOn = (a: Animal, d: string) => { const sc = seasonFor(seasons, a.species); return !isPaused(sc, d) && !feedHold(a, pairings, d) ? nextFeed(a, sc, t) : null; };
  const held = active.flatMap(a => { const h = feedHold(a, pairings, t, names); return h && !isPaused(seasonFor(seasons, a.species), t) ? [{ a, hold: h }] : []; })
    .sort((x, y) => x.a.name.localeCompare(y.a.name, undefined, { numeric: true }));

  const dueNow = active.map(a => ({ a, due: feedOn(a, t) })).filter((x): x is { a: Animal; due: string } => !!x.due && x.due <= t)
    .sort((x, y) => x.due.localeCompare(y.due) || x.a.name.localeCompare(y.a.name, undefined, { numeric: true }));

  // Pairings still in progress, with their estimated lay and hatch dates.
  const open = pairings.filter(p => !p.hatched).map(p => {
    const female = byId.get(p.female_id!), male = byId.get(p.male_id!);
    return { p, female, male, e: estimates(p, seasonFor(seasons, female?.species || 'Other')) };
  }).filter(x => x.female);

  const species = [...new Set(active.map(a => a.species))];
  const days: Overview['days'] = [];
  for (let i = 1; i <= 7; i++) {
    const d = addDays(t, i), md = d.slice(5), items: DayItem[] = [];
    const feeds = active.filter(a => feedOn(a, d) === d).sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }));
    if (feeds.length) items.push({ kind: 'feed', animals: feeds });
    for (const o of open) {
      if (o.e.prelay === d) items.push({ kind: 'prelay', pairing: o.p, female: o.female, male: o.male });
      if (!o.p.laid && o.e.lay === d) items.push({ kind: 'lay', pairing: o.p, female: o.female, male: o.male });
      if (o.p.laid && o.e.hatch === d) items.push({ kind: 'hatch', pairing: o.p, female: o.female, male: o.male });
    }
    for (const sp of species) {
      const sc = seasonFor(seasons, sp);
      if (sc.pair_start === md) items.push({ kind: 'season', text: `Pairing season starts · ${sp}` });
      if (sc.pause_from && sc.pause_to && sc.pause_from === md) items.push({ kind: 'season', text: `Feeding pause starts · ${sp}` });
      if (sc.pause_from && sc.pause_to && addDays(`2001-${sc.pause_to}`, 1).slice(5) === md) items.push({ kind: 'season', text: `Feeding starts again · ${sp}` });
    }
    days.push({ date: d, items });
  }

  const attention: Overview['attention'] = [];
  // Refusal streaks: the most recent feeds were all refused.
  const feedsBy = new Map<string, Ev[]>();
  for (const e of events) if (e.kind === 'feed') (feedsBy.get(e.animal_id) ?? feedsBy.set(e.animal_id, []).get(e.animal_id)!).push(e);
  for (const a of active) {
    const f = (feedsBy.get(a.id) ?? []).sort((x, y) => y.on_date.localeCompare(x.on_date) || (y.created_at ?? '').localeCompare(x.created_at ?? ''));
    const offered = f.filter(e => e.ok !== null); // Not offered entries don't break or extend a streak
    let n = 0; while (n < offered.length && offered[n].ok === false) n++;
    if (n >= 3) attention.push({ text: `${a.name} has refused ${n} feeds in a row`, animalId: a.id });
  }
  // Estimated dates that have passed with nothing recorded (up to 30 days back).
  for (const o of open) {
    const who = `${o.female!.name}${o.male ? ` × ${o.male.name}` : ''}`;
    if (!o.p.laid && o.e.lay && o.e.lay <= t && diffDays(t, o.e.lay) <= 30)
      attention.push({ text: `${who}: estimated lay ${o.e.lay === t ? 'is today' : `was ${diffDays(t, o.e.lay)}d ago`}`, pairingId: o.p.id });
    if (o.p.laid && o.e.hatch && o.e.hatch <= t && diffDays(t, o.e.hatch) <= 30)
      attention.push({ text: `${who}: estimated hatch ${o.e.hatch === t ? 'is today' : `was ${diffDays(t, o.e.hatch)}d ago`}`, pairingId: o.p.id });
  }

  // Further ahead: pairing season within a month.
  const later: Overview['later'] = [];
  for (const sp of species) {
    const ps = seasonFor(seasons, sp).pair_start; if (!ps) continue;
    let d = `${t.slice(0, 4)}-${ps}`; if (d <= t) d = `${Number(t.slice(0, 4)) + 1}-${ps}`;
    const n = diffDays(d, t); if (n > 7 && n <= 31) later.push({ text: `Pairing season starts · ${sp}`, date: d });
  }

  const since = addDays(t, -6);
  const recent = events.filter(e => e.on_date >= since && e.on_date <= t && byId.has(e.animal_id));
  return {
    dueNow, held, days, attention, later: later.sort((a, b) => a.date.localeCompare(b.date)),
    week: { feeds: dueNow.length + days.reduce((s, d) => s + d.items.reduce((n, it) => n + (it.kind === 'feed' ? it.animals.length : 0), 0), 0),
      lays: days.reduce((s, d) => s + d.items.filter(i => i.kind === 'lay').length, 0),
      hatches: days.reduce((s, d) => s + d.items.filter(i => i.kind === 'hatch').length, 0) },
    last7: { fed: recent.filter(e => e.kind === 'feed' && e.ok === true).length, refused: recent.filter(e => e.kind === 'feed' && e.ok === false).length,
      sheds: recent.filter(e => e.kind === 'shed').length, weights: recent.filter(e => e.kind === 'weight').length },
  };
}
