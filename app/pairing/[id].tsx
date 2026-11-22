import { useEffect, useState } from 'react';
import { useAnimalGenes, useGeneLib } from '../../lib/useGenes';
import { MorphCalculator } from '../../lib/MorphCalculator';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCollection } from '../../lib/derived';
import { insert, remove, update } from '../../lib/store';
import { Pairing, diffDays, fmt, nextStage, pairStatus, seasonFor, today } from '../../lib/logic';
import { Repro, speciesInfo, words } from '../../lib/species';
import { Btn, C, Chips, DateField, Input, Label, confirm, notify, s } from '../../lib/ui';
import { HatchlingDialog } from '../../lib/HatchlingDialog';
import { IncubationLog } from '../../lib/IncubationLog';

type DateKey = 'intro' | 'removed' | 'ovulation' | 'prelay_shed' | 'laid' | 'hatched';
// Date fields for the female's species: pre-lay shed for pythons only; live-bearers are born, not laid and hatched.
const datesFor = (r: Repro): [DateKey, string][] => {
  const w = words(r);
  return [['intro', 'Introduced'], ['removed', 'Male removed'], ['ovulation', w.ovulation],
    ...(r === 'python' ? [['prelay_shed', 'Pre-lay shed'] as [DateKey, string]] : []), ['laid', w.laid],
    ...(r !== 'live' ? [['hatched', 'Hatched'] as [DateKey, string]] : [])];
};
const FIELDS = ['female_id', 'male_id', 'intro', 'removed', 'ovulation', 'prelay_shed', 'laid', 'hatched', 'clutch', 'fertile', 'locks', 'notes', 'incubator', 'target_temp'] as const;

export default function PairingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const isNew = id === 'new'; const r = useRouter();
  const { ready, animals, pairings, seasons: cfg } = useCollection();
  const stored = isNew ? null : pairings.find(x => x.id === id);
  const [p, setP] = useState<Pairing>({ locks: [], intro: today() });
  const [lockDay, setLockDay] = useState(today()); const [loaded, setLoaded] = useState(isNew);
  // Load the pairing from the local store once; after that the screen edits its own copy.
  useEffect(() => { if (stored && !loaded) { setP(stored); setLoaded(true); } }, [stored, loaded]);

  // Sold animals are hidden from the pickers, except the ones already in this pairing.
  const pick = (sex: string) => animals.filter(a => a.sex === sex && (a.status !== 'Sold' || a.id === p.female_id || a.id === p.male_id));
  const nm = (i?: string) => animals.find(a => a.id === i)?.name || '';
  const byName = (n: string, sex: string) => animals.find(a => a.name === n && a.sex === sex)?.id;
  const save = (patch: Partial<Pairing> = {}) => {
    const next = { ...p, ...patch }; const body: any = {};
    FIELDS.forEach(k => { body[k] = (next as any)[k] ?? null; }); body.locks = next.locks || [];
    if (!body.female_id || !body.male_id) return notify('Pick a female and a male');
    if (isNew) { insert('pairings', body); r.back(); } else { update('pairings', id, body); setP(next); }
  };
  const addLock = () => save({ locks: [...(p.locks || []), lockDay].sort() });
  const delLock = (i: number) => confirm(`Remove ${w.lock}?`, fmt(p.locks[i]), 'Remove', () => save({ locks: p.locks.filter((_, j) => j !== i) }));
  const del = () => confirm('Delete pairing?', 'This cannot be undone.', 'Delete', () => { remove('pairings', id); r.back(); });
  const female = animals.find(a => a.id === p.female_id); const male = animals.find(a => a.id === p.male_id);
  const geneLib = useGeneLib(); const femaleGenes = useAnimalGenes(p.female_id); const maleGenes = useAnimalGenes(p.male_id);
  const repro = speciesInfo(female?.species).repro; const w = words(repro);
  // The next stage still to come, with its expected date (e.g. after ovulation: the pre-lay shed).
  const next = nextStage(p, seasonFor(cfg, female?.species || 'Other'));
  const nextName = next ? (next.key === 'prelay_shed' ? 'pre-lay shed' : next.key === 'laid' ? w.est.replace('estimated ', '') : 'hatch') : '';
  const estText = next ? ` · ${nextName} expected ${fmt(next.date)}` : '';
  const inDays = (d: string) => { const n = diffDays(d, today()); return n > 1 ? `in ${n} days` : n === 1 ? 'tomorrow' : n === 0 ? 'today' : `${-n} days ago`; };
  const females = pick('Female'), males = pick('Male');
  // Hatchlings can be created once the pairing has a hatch date (live-bearers: a birth date).
  const hatchDate = isNew ? null : repro === 'live' ? p.laid : p.hatched;
  const young = animals.filter(a => a.pairing_id === id);
  const [hatchOpen, setHatchOpen] = useState(false);

  // Don't show controls until the pairing has loaded, or a quick tap would save an empty pairing.
  if (!isNew && !stored && ready) return <View style={s.page}><Stack.Screen options={{ title: 'Not found' }} /><Text style={s.mu}>This pairing has been deleted.</Text></View>;
  if (!loaded) return <View style={s.page}><Stack.Screen options={{ title: isNew ? 'New pairing' : 'Pairing' }} /></View>;
  return (<ScrollView style={s.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"><Stack.Screen options={{ title: isNew ? 'New pairing' : 'Pairing' }} />
    <Text style={s.mu}>Female</Text>{females.length ? <Chips opts={females.map(a => a.name)} v={nm(p.female_id)} on={n => setP({ ...p, female_id: byName(n, 'Female') })} /> : <Text style={s.mu}>No females yet. Add one on the Animals tab.</Text>}
    <Label t="Male" />{males.length ? <Chips opts={males.map(a => a.name)} v={nm(p.male_id)} on={n => setP({ ...p, male_id: byName(n, 'Male') })} /> : <Text style={s.mu}>No males yet.</Text>}
    {isNew && <DateField label="Introduced" value={p.intro} onChange={v => setP({ ...p, intro: v })} optional />}
    {female && male && <View style={[s.card, { marginTop: 12 }]}><Text style={s.h}>Morph calculator</Text>
      <MorphCalculator lib={geneLib} mother={femaleGenes} father={maleGenes} motherName={female.name} fatherName={male.name} /></View>}
    {!isNew && <><Text style={[s.h, { marginTop: 14 }]}>{pairStatus(p, female?.species)}{estText}</Text>
      <Text style={[s.h, { marginTop: 14 }]}>{w.locks} ({p.locks?.length || 0})</Text>
      <View style={[s.row, { alignItems: 'flex-end' }]}><View style={{ flex: 1 }}><DateField label={`${w.lock[0].toUpperCase()}${w.lock.slice(1)} date`} value={lockDay} onChange={v => setLockDay(v || today())} /></View>
        <Btn solid t={`+ Log ${w.lock}`} onPress={addLock} /></View>
      {(p.locks || []).map((d, i) => <Pressable key={`${d}-${i}`} onPress={() => delLock(i)} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.bd }}>
        <Text style={{ color: C.ink }}>{fmt(d)}</Text></Pressable>)}
      {(p.locks || []).length > 0 && <Text style={s.mu}>Tap a {w.lock} to remove it.</Text>}
      <Text style={[s.h, { marginTop: 18 }]}>Dates</Text>
      {datesFor(repro).map(([k, l]) => <View key={k}>
        <DateField optional label={l} value={p[k]} onChange={v => setP({ ...p, [k]: v })} />
        {next?.key === k && !p[k] && <Text style={[s.mu, { color: C.ink }]} accessibilityLabel={`Expected ${l}`}>Expected around {fmt(next.date)} ({inDays(next.date)})</Text>}
      </View>)}
      <Input label={w.clutch} keyboardType="number-pad" value={p.clutch != null ? String(p.clutch) : ''} onChangeText={v => setP({ ...p, clutch: v ? parseInt(v, 10) || null : null })} />
      {repro !== 'live' && <Input label="Fertile eggs" keyboardType="number-pad" value={p.fertile != null ? String(p.fertile) : ''} onChangeText={v => setP({ ...p, fertile: v ? parseInt(v, 10) || null : null })} />}
      {repro !== 'live' && p.laid && <IncubationLog id={id} p={p} setP={setP} />}
      {hatchDate && <View style={[s.card, { marginTop: 14 }]}>
        <Text style={s.h}>{repro === 'live' ? 'Babies' : 'Hatchlings'} ({young.length})</Text>
        {young.map(a => <Pressable key={a.id} onPress={() => r.push(`/animal/${a.id}`)} accessibilityRole="link" style={{ paddingVertical: 4 }}>
          <Text style={{ color: C.ink, textDecorationLine: 'underline' }}>{a.name}</Text></Pressable>)}
        <View style={{ marginTop: 8 }}><Btn solid t={repro === 'live' ? 'Add babies' : 'Create hatchlings'} onPress={() => { save(); setHatchOpen(true); }} /></View>
        <HatchlingDialog open={hatchOpen} onClose={() => setHatchOpen(false)} onCreated={c => setP(x => ({ ...x, ...c }))} pairing={{ ...p, id }}
          mother={female} father={animals.find(a => a.id === p.male_id)} hatchDate={hatchDate} existingCount={young.length} /></View>}
      <Input label="Notes" multiline value={p.notes || ''} onChangeText={v => setP({ ...p, notes: v })} /></>}
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}><Btn solid t={isNew ? 'Create' : 'Save'} onPress={() => save()} />
      {!isNew && <Btn danger t="Delete" onPress={del} />}</View>
    <View style={{ height: 60 }} /></ScrollView>);
}
