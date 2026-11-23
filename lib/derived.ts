// Values worked out from the local store (the server's animal_status view, computed on the phone so it works offline).
import { useMemo } from 'react';
import type { Animal, Pairing, Season } from './logic';
import { useStore, type Row } from './store';

export type Ev = { id: string; animal_id: string; kind: 'feed' | 'shed' | 'weight'; on_date: string; ok: boolean | null;
  food: string | null; grams: number | null; note?: string | null; created_at?: string };

/** Animals with last_feed, last_shed and last_weight filled in from their history. */
export function withStatus(animals: Row[], events: Row[]): Animal[] {
  const last: Record<string, { feed?: string; shed?: string; weight?: { d: string; g: number } }> = {};
  for (const e of events) {
    const l = (last[e.animal_id] ??= {});
    if (e.kind === 'feed' && (!l.feed || e.on_date > l.feed)) l.feed = e.on_date;
    else if (e.kind === 'shed' && (!l.shed || e.on_date > l.shed)) l.shed = e.on_date;
    else if (e.kind === 'weight' && (!l.weight || e.on_date >= l.weight.d)) l.weight = { d: e.on_date, g: Number(e.grams) };
  }
  return animals.map(a => ({ ...(a as Animal), last_feed: last[a.id]?.feed ?? null, last_shed: last[a.id]?.shed ?? null, last_weight: last[a.id]?.weight?.g ?? null }));
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
