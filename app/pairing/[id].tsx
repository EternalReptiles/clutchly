import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Pairing, Season, estimates, fmt, pairStatus, seasonFor, today } from '../../lib/logic';
import { Repro, speciesInfo, words } from '../../lib/species';
import { Btn, C, Chips, DateField, Input, Label, confirm, notify, s } from '../../lib/ui';

type DateKey = 'intro' | 'removed' | 'ovulation' | 'prelay_shed' | 'laid' | 'hatched';
// Date fields for the female's species: pre-lay shed for pythons only; live-bearers are born, not laid and hatched.
const datesFor = (r: Repro): [DateKey, string][] => {
  const w = words(r);
  return [['intro', 'Introduced'], ['removed', 'Male removed'], ['ovulation', w.ovulation],
    ...(r === 'python' ? [['prelay_shed', 'Pre-lay shed'] as [DateKey, string]] : []), ['laid', w.laid],
    ...(r !== 'live' ? [['hatched', 'Hatched'] as [DateKey, string]] : [])];
};
const FIELDS = ['female_id', 'male_id', 'intro', 'removed', 'ovulation', 'prelay_shed', 'laid', 'hatched', 'clutch', 'fertile', 'locks', 'notes'] as const;
type A = { id: string; name: string; sex: string; species: string; status: string };

export default function PairingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const isNew = id === 'new'; const r = useRouter();
  const [p, setP] = useState<Pairing>({ locks: [], intro: today() }); const [animals, setAnimals] = useState<A[]>([]);
  const [cfg, setCfg] = useState<Season[]>([]); const [lockDay, setLockDay] = useState(today()); const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    const [a, c, x] = await Promise.all([supabase.from('animals').select('id,name,sex,species,status').order('name'),
      supabase.from('season_settings').select('*'),
      isNew ? Promise.resolve(null) : supabase.from('pairings').select('*').eq('id', id).maybeSingle()]);
    const err = a.error || c.error || x?.error; if (err) notify('Could not load', err.message);
    setAnimals((a.data as A[]) || []); setCfg((c.data as Season[]) || []); if (x?.data) setP(x.data as Pairing);
    if (!isNew && !x?.data && !err) { notify('Pairing not found'); r.back(); return; }
    setLoaded(true);
  }, [id, isNew, r]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Sold animals are hidden from the pickers, except the ones already in this pairing.
  const pick = (sex: string) => animals.filter(a => a.sex === sex && (a.status !== 'Sold' || a.id === p.female_id || a.id === p.male_id));
  const nm = (i?: string) => animals.find(a => a.id === i)?.name || '';
  const byName = (n: string, sex: string) => animals.find(a => a.name === n && a.sex === sex)?.id;
  const save = async (patch: Partial<Pairing> = {}) => {
    const next = { ...p, ...patch }; const body: any = {};
    FIELDS.forEach(k => { body[k] = (next as any)[k] ?? null; }); body.locks = next.locks || [];
    if (!body.female_id || !body.male_id) return notify('Pick a female and a male');
    const res = isNew ? await supabase.from('pairings').insert(body) : await supabase.from('pairings').update(body).eq('id', id);
    if (res.error) return notify('Error', res.error.message);
    if (isNew) r.back(); else setP(next);
  };
  const addLock = () => save({ locks: [...(p.locks || []), lockDay].sort() });
  const delLock = (i: number) => confirm(`Remove ${w.lock}?`, fmt(p.locks[i]), 'Remove', () => save({ locks: p.locks.filter((_, j) => j !== i) }));
  const del = () => confirm('Delete pairing?', 'This cannot be undone.', 'Delete', async () => {
    const { error } = await supabase.from('pairings').delete().eq('id', id); error ? notify('Error', error.message) : r.back();
  });
  const female = animals.find(a => a.id === p.female_id);
  const repro = speciesInfo(female?.species).repro; const w = words(repro);
  const est = estimates(p, seasonFor(cfg, female?.species || 'Other'));
  const estText = !p.laid && est.lay ? ` · ${w.est} ${fmt(est.lay)}` : p.laid && !p.hatched && est.hatch ? ` · estimated hatch ${fmt(est.hatch)}` : '';
  const females = pick('Female'), males = pick('Male');

  // Don't show controls until the pairing has loaded, or a quick tap would save an empty pairing.
  if (!loaded) return <View style={s.page}><Stack.Screen options={{ title: isNew ? 'New pairing' : 'Pairing' }} /></View>;
  return (<ScrollView style={s.page} keyboardShouldPersistTaps="handled"><Stack.Screen options={{ title: isNew ? 'New pairing' : 'Pairing' }} />
    <Text style={s.mu}>Female</Text>{females.length ? <Chips opts={females.map(a => a.name)} v={nm(p.female_id)} on={n => setP({ ...p, female_id: byName(n, 'Female') })} /> : <Text style={s.mu}>No females yet. Add one on the Animals tab.</Text>}
    <Label t="Male" />{males.length ? <Chips opts={males.map(a => a.name)} v={nm(p.male_id)} on={n => setP({ ...p, male_id: byName(n, 'Male') })} /> : <Text style={s.mu}>No males yet.</Text>}
    {isNew && <DateField label="Introduced" value={p.intro} onChange={v => setP({ ...p, intro: v })} optional />}
    {!isNew && <><Text style={[s.h, { marginTop: 14 }]}>{pairStatus(p, female?.species)}{estText}</Text>
      <Text style={[s.h, { marginTop: 14 }]}>{w.locks} ({p.locks?.length || 0})</Text>
      <View style={[s.row, { alignItems: 'flex-end' }]}><View style={{ flex: 1 }}><DateField label={`${w.lock[0].toUpperCase()}${w.lock.slice(1)} date`} value={lockDay} onChange={v => setLockDay(v || today())} /></View>
        <Btn solid t={`+ Log ${w.lock}`} onPress={addLock} /></View>
      {(p.locks || []).map((d, i) => <Pressable key={`${d}-${i}`} onPress={() => delLock(i)} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.bd }}>
        <Text style={{ color: C.ink }}>{fmt(d)}</Text></Pressable>)}
      {(p.locks || []).length > 0 && <Text style={s.mu}>Tap a {w.lock} to remove it.</Text>}
      <Text style={[s.h, { marginTop: 18 }]}>Dates</Text>
      {datesFor(repro).map(([k, l]) => <DateField key={k} optional label={l} value={p[k]} onChange={v => setP({ ...p, [k]: v })} />)}
      <Input label={w.clutch} keyboardType="number-pad" value={p.clutch != null ? String(p.clutch) : ''} onChangeText={v => setP({ ...p, clutch: v ? parseInt(v, 10) || null : null })} />
      {repro !== 'live' && <Input label="Fertile eggs" keyboardType="number-pad" value={p.fertile != null ? String(p.fertile) : ''} onChangeText={v => setP({ ...p, fertile: v ? parseInt(v, 10) || null : null })} />}
      <Input label="Notes" multiline value={p.notes || ''} onChangeText={v => setP({ ...p, notes: v })} /></>}
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}><Btn solid t={isNew ? 'Create' : 'Save'} onPress={() => save()} />
      {!isNew && <Btn danger t="Delete" onPress={del} />}</View>
    <View style={{ height: 60 }} /></ScrollView>);
}
