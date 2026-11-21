import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useCollection } from '../lib/derived';
import { GeneRows, speciesGenes } from '../lib/GeneEditor';
import { morphName, type AnimalGene, type Gene, type GeneState, type Lib } from '../lib/genetics';
import { MorphCalculator } from '../lib/MorphCalculator';
import { SpeciesPicker } from '../lib/SpeciesPicker';
import { useAnimalGenes, useGeneLib } from '../lib/useGenes';
import { Btn, Card, Chips, s } from '../lib/ui';

const MINE = 'One of mine', MADE = 'Make one up';

/** Try any female with any male (no pairing needed), or "what if" parents built from genes. */
export default function Calculator() {
  const { animals } = useCollection(); const lib = useGeneLib();
  const options = useMemo(() => [...new Set([...animals.map(a => a.species), ...[...lib.genes.values()].filter(g => !g.custom).map(g => g.species)])], [animals, lib]);
  const [species, setSpecies] = useState<string | null>(null);
  const sp = species ?? animals[0]?.species ?? options[0] ?? null;
  const mother = useParent(lib, animals, sp, 'Female'), father = useParent(lib, animals, sp, 'Male');
  return (<ScrollView style={s.page} keyboardShouldPersistTaps="handled">
    <Stack.Screen options={{ title: 'Morph calculator' }} />
    <Text style={s.mu}>Pick each parent from your animals, or make one up to see "what if" odds.</Text>
    {options.length ? <Chips opts={options} v={sp ?? ''} on={v => { setSpecies(v); mother.reset(); father.reset(); }} />
      : <SpeciesPicker label="Species" value={sp} onChange={setSpecies} />}
    <ParentCard title="Female" p={mother} />
    <ParentCard title="Male" p={father} />
    {mother.ready && father.ready && <Card><MorphCalculator lib={lib} mother={mother.genes} father={father.genes} motherName={mother.name} fatherName={father.name} /></Card>}
    <View style={{ height: 60 }} /></ScrollView>);
}

type Parent = ReturnType<typeof useParent>;
function useParent(lib: Lib, animals: { id: string; name: string; species: string; sex?: string | null; status?: string | null }[], sp: string | null, sex: 'Female' | 'Male') {
  const choices = animals.filter(a => a.species === sp && a.sex === sex && a.status !== 'Sold');
  const [mode, setMode] = useState<string | null>(null); const [id, setId] = useState<string | null>(null);
  const [made, setMade] = useState<Map<string, AnimalGene>>(new Map());
  const m = mode ?? (choices.length ? MINE : MADE);
  const animal = m === MINE ? choices.find(a => a.id === id) : undefined;
  const animalGenes = useAnimalGenes(animal?.id);
  const madeGenes = useMemo(() => [...made.values()], [made]);
  const set = (g: Gene, state: GeneState | 'none', pct?: number) => setMade(cur => { const n = new Map(cur);
    if (state === 'none') n.delete(g.key); else n.set(g.key, { gene_key: g.key, state, het_pct: state === 'possible_het' ? (pct ?? cur.get(g.key)?.het_pct ?? 50) : null }); return n; });
  const genes = m === MINE ? animalGenes : madeGenes;
  return { sex, mode: m, setMode, choices, animal, setId, made, set, clear: () => setMade(new Map()), list: sp ? speciesGenes(lib.genes, sp) : [], genes,
    ready: m === MADE || !!animal, morph: morphName(lib, madeGenes) || 'Normal', name: m === MINE ? animal?.name ?? '' : `a ${morphName(lib, madeGenes) || 'Normal'} ${sex.toLowerCase()}`,
    reset: () => { setId(null); setMade(new Map()); } };
}

function ParentCard({ title, p }: { title: string; p: Parent }) {
  const [open, setOpen] = useState(true);
  return (<Card>
    <Text style={s.h}>{title}</Text>
    <Chips opts={[MINE, MADE]} v={p.mode} on={p.setMode} />
    {p.mode === MINE ? (p.choices.length
      ? <Chips opts={p.choices.map(a => a.name)} v={p.animal?.name ?? ''} on={n => p.setId(p.choices.find(a => a.name === n)?.id ?? null)} />
      : <Text style={s.mu}>No {p.sex.toLowerCase()}s of this species. Make one up instead.</Text>)
      : <View>
        <View style={[s.row, { marginTop: 6 }]}><Text style={{ flex: 1, fontWeight: '600' }} accessibilityLabel={`${title} genes`}>{p.morph}</Text>
          <Btn t={open ? 'Hide genes' : 'Choose genes'} onPress={() => setOpen(!open)} />
          {p.made.size > 0 && <Btn t="Clear" onPress={p.clear} />}</View>
        {open && (p.list.length ? <GeneRows list={p.list} value={p.made} onSet={p.set} /> : <Text style={s.mu}>No genes listed for this species yet.</Text>)}
      </View>}
  </Card>);
}
