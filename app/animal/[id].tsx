import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { insert, remove, update, useStore } from '../../lib/store';
import { SEXES, fmt, today } from '../../lib/logic';
import { SpeciesPicker } from '../../lib/SpeciesPicker';
import { PhotoGallery } from '../../lib/PhotoGallery';
import { WeightChart } from '../../lib/WeightChart';
import { EventEditor } from '../../lib/EventEditor';
import { eventLabel, newestFirst, refusalStats, shedStats, weightSeries, type Ev } from '../../lib/history';
import { Btn, Chips, DateField, Input, Label, confirm, notify, s, C } from '../../lib/ui';

type Form = { name: string; species: string; sex: string; status: string; dob: string | null; feed_every: string; notes: string };
const blank: Form = { name: '', species: '', sex: 'Female', status: 'Active', dob: null, feed_every: '', notes: '' };

export default function AnimalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const isNew = id === 'new'; const r = useRouter();
  const st = useStore();
  const animal = isNew ? null : st.animals.find(x => x.id === id);
  const [a, setA] = useState<Form>(blank); const [loaded, setLoaded] = useState(isNew);
  const [food, setFood] = useState(''); const [g, setG] = useState(''); const [day, setDay] = useState(today());
  // Fill the form once from the local store.
  useEffect(() => {
    if (isNew) {
      // Default to the species of the most recently added animal, which suits entering a batch.
      const last = [...st.animals].sort((x, y) => String(y.created_at ?? '').localeCompare(String(x.created_at ?? '')))[0];
      if (last?.species) setA(f => f.species ? f : { ...f, species: last.species });
      return;
    }
    if (animal && !loaded) {
      setA({ name: animal.name, species: animal.species, sex: animal.sex, status: animal.status, dob: animal.dob ?? null,
        feed_every: animal.feed_every ? String(animal.feed_every) : '', notes: animal.notes ?? '' });
      setLoaded(true);
    }
  }, [animal, isNew, loaded, st.animals]);
  const allEv = useMemo(() => (st.events as Ev[]).filter(e => e.animal_id === id).sort(newestFirst), [st.events, id]);
  const ev = allEv;
  const weights = useMemo(() => weightSeries(allEv), [allEv]);
  const sheds = useMemo(() => shedStats(allEv), [allEv]);
  const refusals = useMemo(() => refusalStats(allEv, today()), [allEv]);
  const [editing, setEditing] = useState<Ev | null>(null);
  const mother = animal?.mother_id ? st.animals.find(x => x.id === animal.mother_id) : undefined;
  const father = animal?.father_id ? st.animals.find(x => x.id === animal.father_id) : undefined;
  const offspring = useMemo(() => st.animals.filter(x => x.mother_id === id || x.father_id === id)
    .sort((x, y) => String(x.name).localeCompare(String(y.name), undefined, { numeric: true })), [st.animals, id]);

  const save = () => {
    const name = a.name.trim(); if (!name) return notify('Give the animal a name or ID');
    if (!a.species) return notify('Choose a species');
    const every = a.feed_every.trim() ? parseInt(a.feed_every, 10) : null;
    if (every !== null && (isNaN(every) || every < 1 || every > 365)) return notify('Feed interval must be 1 to 365 days, or blank');
    const body = { name, species: a.species, sex: a.sex, status: a.status, dob: a.dob, feed_every: every, notes: a.notes.trim() || null };
    if (isNew) insert('animals', body); else update('animals', id, body);
    r.back();
  };
  const log = (kind: Ev['kind'], extra: Partial<Ev> = {}) => {
    insert('events', { animal_id: id, kind, on_date: day, ok: null, food: null, grams: null, ...extra });
    if (kind === 'weight') setG('');
  };
  const logWeight = () => { const n = parseFloat(g.replace(',', '.')); if (!(n > 0)) return notify('Enter a weight in grams'); log('weight', { grams: n }); };
  const del = () => confirm('Delete animal?', 'Its history and pairings are deleted too.', 'Delete', () => { remove('animals', id); r.back(); });

  if (!isNew && !animal && st.ready) return <View style={s.page}><Stack.Screen options={{ title: 'Not found' }} /><Text style={s.mu}>This animal has been deleted.</Text></View>;
  if (!loaded) return <View style={s.page} />;
  return (<ScrollView style={s.page} keyboardShouldPersistTaps="handled"><Stack.Screen options={{ title: isNew ? 'New animal' : a.name }} />
    <Input label="Name / ID" value={a.name} onChangeText={v => setA({ ...a, name: v })} />
    <SpeciesPicker value={a.species} onChange={v => setA({ ...a, species: v })} />
    <Label t="Sex" /><Chips opts={SEXES} v={a.sex} on={v => setA({ ...a, sex: v })} />
    <Label t="Status" /><Chips opts={['Active', 'Breeding', 'Resting', 'Sold']} v={a.status} on={v => setA({ ...a, status: v })} />
    <DateField optional label="Hatch date" value={a.dob} onChange={v => setA({ ...a, dob: v })} />
    <Input label="Feed every N days (blank = species default from the Season tab)" keyboardType="number-pad" value={a.feed_every} onChangeText={v => setA({ ...a, feed_every: v })} />
    <Input label="Notes" multiline value={a.notes} onChangeText={v => setA({ ...a, notes: v })} />
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}><Btn solid t="Save" onPress={save} />{!isNew && <Btn danger t="Delete" onPress={del} />}</View>
    {!isNew && (mother || father || offspring.length > 0) && <View style={{ marginTop: 14 }}>
      <Text style={s.h}>Family</Text>
      {(mother || father) && <Text style={{ color: C.ink, marginTop: 4 }}>Parents: {mother ? <Text style={{ textDecorationLine: 'underline' }} onPress={() => r.push(`/animal/${mother.id}`)} accessibilityRole="link">{mother.name}</Text> : '?'}
        {' × '}{father ? <Text style={{ textDecorationLine: 'underline' }} onPress={() => r.push(`/animal/${father.id}`)} accessibilityRole="link">{father.name}</Text> : '?'}</Text>}
      {offspring.length > 0 && <><Text style={[s.mu, { marginTop: 6 }]}>Offspring ({offspring.length})</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {offspring.map(o => <Pressable key={o.id} onPress={() => r.push(`/animal/${o.id}`)} accessibilityRole="link" style={s.btn}>
            <Text style={{ color: C.ink }}>{o.name}</Text></Pressable>)}</View></>}
    </View>}
    {!isNew && <PhotoGallery animalId={id} />}
    {!isNew && <><Text style={[s.h, { marginTop: 22 }]}>Log</Text>
      <DateField label="Date" value={day} onChange={v => setDay(v || today())} />
      <Input label="Food" value={food} onChangeText={setFood} placeholder="e.g. medium rat" />
      <Input label="Weight (g)" keyboardType="decimal-pad" value={g} onChangeText={setG} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <Btn solid t="Fed" onPress={() => log('feed', { ok: true, food: food.trim() || null })} />
        <Btn t="Refused" onPress={() => log('feed', { ok: false, food: food.trim() || null })} />
        <Btn t="Shed" onPress={() => log('shed')} /><Btn t="Weight" onPress={logWeight} /></View>
      <Text style={[s.h, { marginTop: 22 }]}>Growth</Text>
      <WeightChart points={weights} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <View style={[s.card, { flex: 1 }]}><Text style={s.mu}>Days between sheds</Text>
          <Text style={s.h}>{sheds.avgDays != null ? `${sheds.avgDays} avg` : '–'}</Text>
          <Text style={s.mu}>{sheds.count} shed{sheds.count === 1 ? '' : 's'} logged</Text></View>
        <View style={[s.card, { flex: 1 }]}><Text style={s.mu}>Refused, last 90 days</Text>
          <Text style={s.h}>{refusals.rate != null ? `${Math.round(refusals.rate * 100)}%` : '–'}</Text>
          <Text style={s.mu}>{refusals.refused} of {refusals.offered} feed{refusals.offered === 1 ? '' : 's'}</Text></View></View>
      <Text style={[s.h, { marginTop: 18 }]}>Recent</Text>
      {!ev.length && <Text style={s.mu}>Nothing logged yet.</Text>}
      {ev.length > 0 && <Text style={s.mu}>Tap an entry to edit or delete it.</Text>}
      {ev.slice(0, 5).map(e => <Pressable key={e.id} onPress={() => setEditing(e)} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.bd }}>
        <Text style={{ color: C.ink }}>{fmt(e.on_date)} · {label(e)}</Text></Pressable>)}
      {ev.length > 0 && <View style={{ marginTop: 10 }}><Btn t={`Full history (${allEv.length})`} onPress={() => r.push(`/history/${id}`)} /></View>}
      <EventEditor ev={editing} onClose={() => setEditing(null)} /></>}
    <View style={{ height: 60 }} /></ScrollView>);
}
const label = eventLabel;
