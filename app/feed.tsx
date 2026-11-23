// Feed several animals at once: one date and food for the lot, each animal marked Fed, Refused or Not offered (or left out).
// Animals in shed, or with the male still in, aren't due (lib/logic.ts feedHold) and say so.
// Opened from Overview ("Feed several", with everything due already marked Fed) or the Animals tab (nothing marked).
// Saves through the local store like every other log, so it works offline and syncs later.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { diffDays, feedHold, fmt, isPaused, nextFeed, seasonFor, today } from '../lib/logic';
import { useCollection } from '../lib/derived';
import { insertMany } from '../lib/store';
import { Btn, C, Chips, DateField, Input, notify, s } from '../lib/ui';
import { Loading } from '../lib/Brand';

type Mark = 'fed' | 'refused' | 'skip';
const OK: Record<Mark, boolean | null> = { fed: true, refused: false, skip: null };
const ALL = 'All species';

export default function FeedSeveral() {
  const { pre } = useLocalSearchParams<{ pre?: string }>(); const r = useRouter();
  const { ready, animals, seasons, pairings } = useCollection();
  const [day, setDay] = useState(today()); const [food, setFood] = useState(''); const [sp, setSp] = useState(ALL);
  const t = today(); const names = new Map(animals.map(a => [a.id, a.name]));
  // Every animal still in the collection, due ones first (most overdue first), then by name.
  const rows = useMemo(() => animals.filter(a => a.status !== 'Sold').map(a => {
    const sc = seasonFor(seasons, a.species); const paused = isPaused(sc, t); const next = nextFeed(a, sc, t);
    const hold = feedHold(a, pairings, t, names);
    return { a, paused, next, hold, due: !paused && !hold && next <= t };
  }).sort((x, y) => Number(y.due) - Number(x.due) || (x.due ? x.next.localeCompare(y.next) : 0) || x.a.name.localeCompare(y.a.name, undefined, { numeric: true })),
  [animals, seasons, pairings, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const [marks, setMarks] = useState<Record<string, Mark> | null>(null);
  // Fill in the starting marks once the collection has loaded.
  const m = marks ?? (ready ? Object.fromEntries(pre === 'due' ? rows.filter(x => x.due).map(x => [x.a.id, 'fed' as Mark]) : []) : {});
  const setMark = (id: string, v: Mark) => { const n = { ...m }; if (n[id] === v) delete n[id]; else n[id] = v; setMarks(n); };
  const species = [...new Set(rows.map(x => x.a.species))].sort();
  const shown = rows.filter(x => sp === ALL || x.a.species === sp);
  const selectAll = (ids: string[]) => setMarks({ ...m, ...Object.fromEntries(ids.filter(id => !m[id]).map(id => [id, 'fed' as Mark])) });
  const clear = () => setMarks(Object.fromEntries(Object.entries(m).filter(([id]) => !shown.some(x => x.a.id === id))));
  const fed = Object.values(m).filter(v => v === 'fed').length, refused = Object.values(m).filter(v => v === 'refused').length,
    skipped = Object.values(m).filter(v => v === 'skip').length;
  const counts = [fed && `${fed} fed`, refused && `${refused} refused`, skipped && `${skipped} not offered`].filter(Boolean).join(', ');
  const save = () => {
    const f = food.trim() || null;
    insertMany('events', Object.entries(m).map(([animal_id, v]) => ({ animal_id, kind: 'feed', ok: OK[v], food: v === 'skip' ? null : f, on_date: day, grams: null })));
    notify('Saved', `${counts} on ${fmt(day)}.`);
    if (r.canGoBack()) r.back(); else r.replace('/');
  };
  if (!ready) return <Loading />;
  if (!rows.length) return <View style={s.page}><Text style={s.mu}>No animals yet. Add some on the Animals tab.</Text></View>;
  const dueIds = shown.filter(x => x.due).map(x => x.a.id);
  return (<View style={{ flex: 1, backgroundColor: C.bg }}>
    <ScrollView style={s.page} keyboardShouldPersistTaps="handled">
      <DateField label="Date" value={day} onChange={v => setDay(v || today())} />
      <Input label="Food (for everyone fed)" value={food} onChangeText={setFood} placeholder="e.g. medium rat" />
      {species.length > 1 && <Chips opts={[ALL, ...species]} v={sp} on={setSp} />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {dueIds.length > 0 && <Btn t={`Mark due as fed (${dueIds.length})`} onPress={() => selectAll(dueIds)} />}
        <Btn t="Mark all as fed" onPress={() => selectAll(shown.map(x => x.a.id))} />
        <Btn t="Clear" onPress={clear} />
      </View>
      <Text style={[s.mu, { marginTop: 10 }]}>Tap Fed, Refused or Not offered for each animal. Tap again to leave it out.</Text>
      {shown.map(({ a, due, paused, next, hold }) => <View key={a.id} style={s.card}>
        <Text style={s.h}>{a.name}</Text>
        <Text style={s.mu}>{a.species} · {a.sex} · {paused ? 'feeding pause' : hold ? (hold.kind === 'shed' ? 'in shed' : `in with ${hold.with ?? 'its mate'}`)
          : due ? (next < t ? `${diffDays(t, next)}d overdue` : 'due today') : `next ${fmt(next)}`}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <Toggle label={`${a.name} fed`} t="Fed" on={m[a.id] === 'fed'} press={() => setMark(a.id, 'fed')} />
          <Toggle label={`${a.name} refused`} t="Refused" on={m[a.id] === 'refused'} press={() => setMark(a.id, 'refused')} />
          <Toggle label={`${a.name} not offered`} t="Not offered" on={m[a.id] === 'skip'} press={() => setMark(a.id, 'skip')} /></View>
      </View>)}
      <View style={{ height: 90 }} />
    </ScrollView>
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, paddingBottom: 24, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.bd }}>
      <Btn solid disabled={!counts} onPress={save} t={counts ? `Save ${counts}` : 'Mark animals to save'} />
    </View>
  </View>);
}

const Toggle = ({ t, on, press, label }: { t: string; on: boolean; press: () => void; label: string }) =>
  <Pressable onPress={press} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} aria-checked={on}
    style={[s.btn, on && { backgroundColor: C.ink, borderColor: C.ink }]}>
    <Text style={{ fontWeight: '600', color: on ? C.bg : C.ink }}>{t}</Text></Pressable>;
