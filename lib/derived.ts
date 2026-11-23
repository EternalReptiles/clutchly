// Values worked out from the local store (the server's animal_status view, computed on the phone so it works offline).
import { useMemo } from 'react';
import type { Animal, Pairing, Season } from './logic';
import { useStore, type Row } from './store';

export type Ev = { id: string; animal_id: string; kind: 'feed' | 'shed' | 'weight' | 'in_shed'; on_date: string; ok: boolean | null;
  food: string | null; grams: number | null; note?: string | null; created_at?: string };

/** Animals with last_feed, last_shed, last_weight and in_shed filled in from their history. */
export function withStatus(animals: Row[], events: Row[]): Animal[] {
  // Entries are compared by date, then by when they were entered (an In shed and a Shed on the same day: the later one wins).
  const key = (e: Row) => `${e.on_date}|${e.created_at ?? ''}`;
  const last: Record<string, { feed?: string; shed?: Row; blue?: Row; weight?: { d: string; g: number } }> = {};
  for (const e of events) {
    const l = (last[e.animal_id] ??= {});
    if (e.kind === 'feed' && (!l.feed || e.on_date > l.feed)) l.feed = e.on_date;
    else if (e.kind === 'shed' && (!l.shed || key(e) > key(l.shed))) l.shed = e;
    else if (e.kind === 'in_shed' && (!l.blue || key(e) > key(l.blue))) l.blue = e;
    else if (e.kind === 'weight' && (!l.weight || e.on_date >= l.weight.d)) l.weight = { d: e.on_date, g: Number(e.grams) };
  }
  return animals.map(a => { const l = last[a.id];
    return { ...(a as Animal), last_feed: l?.feed ?? null, last_shed: l?.shed?.on_date ?? null, last_weight: l?.weight?.g ?? null,
      in_shed: l?.blue && (!l.shed || key(l.blue) > key(l.shed)) ? l.blue.on_date : null }; });
}
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { numeric: true });

/** Everything most screens need, recomputed only when the underlying rows change. */
export function useCollection() {
  const s = useStore();
  const animals = useMemo(() => withStatus(s.animals, s.events).sort(byName), [s.animals, s.events]);
  return { ready: s.ready, animals, events: s.events as Ev[], pairings: s.pairings as Pairing[], seasons: s.season_settings as Season[] };
}

/** "15 animals" and "8 female · 6 male · 1 unknown": the animals you own (Sold ones aren't counted). */
export function collectionSummary(animals: { sex: string; status: string }[]) {
  const owned = animals.filter(a => a.status !== 'Sold');
  const by = (sx: string) => owned.filter(a => a.sex === sx).length;
  const parts = [by('Female') && `${by('Female')} female`, by('Male') && `${by('Male')} male`, by('Unknown') && `${by('Unknown')} unknown`];
  return { total: `${owned.length} animal${owned.length === 1 ? '' : 's'}`, detail: parts.filter(Boolean).join(' · ') };
}

/** Button labels that tell animals apart when an ID is used more than once: "ER001" when it's unique, otherwise
 * "ER001 (Carpet)", then "ER001 (Carpet, 2024)" (hatch year), then "ER001 (Carpet) 2" in the order they were added. */
export function animalLabels(animals: { id: string; name: string; species: string; dob?: string | null; created_at?: string | null }[]): Map<string, string> {
  const out = new Map<string, string>(); const groups = new Map<string, typeof animals>();
  for (const a of animals) { const k = a.name.trim().toLowerCase(); groups.set(k, [...(groups.get(k) ?? []), a]); }
  for (const g of groups.values()) {
    if (g.length === 1) { out.set(g[0].id, g[0].name); continue; }
    const first = (a: (typeof g)[number]) => `${a.name} (${a.species})`;
    const second = (a: (typeof g)[number]) => `${a.name} (${a.species}${a.dob ? `, ${a.dob.slice(0, 4)}` : ''})`;
    const count = (f: (a: (typeof g)[number]) => string, l: string) => g.filter(x => f(x) === l).length;
    const seen = new Map<string, number>();
    for (const a of [...g].sort((x, y) => String(x.created_at ?? '').localeCompare(String(y.created_at ?? '')) || x.id.localeCompare(y.id))) {
      let l = first(a); if (count(first, l) > 1) l = second(a);
      if (count(second, l) > 1) { const n = (seen.get(l) ?? 0) + 1; seen.set(l, n); if (n > 1) l = `${l} ${n}`; }
      out.set(a.id, l);
    }
  }
  return out;
}
