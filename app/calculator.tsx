import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useCollection } from '../lib/derived';
import { MorphCalculator } from '../lib/MorphCalculator';
import { SpeciesPicker } from '../lib/SpeciesPicker';
import { useAnimalGenes, useGenes } from '../lib/useGenes';
import { Card, Chips, s } from '../lib/ui';

/** Try any female with any male (no pairing needed). */
export default function Calculator() {
  const { animals } = useCollection(); const genes = useGenes();
  const kept = useMemo(() => [...new Set(animals.map(a => a.species))], [animals]);
  const [species, setSpecies] = useState<string | null>(kept[0] ?? null);
  const sp = species ?? kept[0] ?? null;
  const females = animals.filter(a => a.species === sp && a.sex === 'Female' && a.status !== 'Sold');
  const males = animals.filter(a => a.species === sp && a.sex === 'Male' && a.status !== 'Sold');
  const [fid, setFid] = useState<string | null>(null); const [mid, setMid] = useState<string | null>(null);
  const f = females.find(a => a.id === fid), m = males.find(a => a.id === mid);
  const fg = useAnimalGenes(f?.id), mg = useAnimalGenes(m?.id);
  return (<ScrollView style={s.page} keyboardShouldPersistTaps="handled">
    <Stack.Screen options={{ title: 'Morph calculator' }} />
    <Text style={s.mu}>Pick a female and a male to see the possible babies and their odds. Genes are set on each animal's page.</Text>
    {kept.length > 1 && <Chips opts={kept} v={sp ?? ''} on={v => { setSpecies(v); setFid(null); setMid(null); }} />}
    {!kept.length && <SpeciesPicker label="Species" value={sp} onChange={setSpecies} />}
    <Text style={[s.mu, { marginTop: 10 }]}>Female</Text>
    {females.length ? <Chips opts={females.map(a => a.name)} v={f?.name ?? ''} on={n => setFid(females.find(a => a.name === n)?.id ?? null)} /> : <Text style={s.mu}>No {sp} females.</Text>}
    <Text style={[s.mu, { marginTop: 10 }]}>Male</Text>
    {males.length ? <Chips opts={males.map(a => a.name)} v={m?.name ?? ''} on={n => setMid(males.find(a => a.name === n)?.id ?? null)} /> : <Text style={s.mu}>No {sp} males.</Text>}
    {f && m && <Card><MorphCalculator genes={genes} mother={fg} father={mg} motherName={f.name} fatherName={m.name} /></Card>}
    <View style={{ height: 60 }} /></ScrollView>);
}
