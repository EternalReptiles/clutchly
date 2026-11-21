import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useCollection } from '../lib/derived';
import { allGenes, GeneRows } from '../lib/GeneEditor';
import { morphName, type AnimalGene, type Gene, type GeneState, type Lib } from '../lib/genetics';
import { MorphCalculator } from '../lib/MorphCalculator';
import { useAnimalGenes, useGeneLib } from '../lib/useGenes';
import { Btn, Card, Chips, Input, s } from '../lib/ui';

const MINE = 'One of mine', MADE = 'Make one up';

/** Try any female with any male (no pairing needed), or "what if" parents built from genes. */
export default function Calculator() {
  const { animals } = useCollection(); const lib = useGeneLib();
  const list = useMemo(() => allGenes(lib.genes), [lib]);
  const mother = useParent(lib, list, animals, 'Female'), father = useParent(lib, list, animals, 'Male');
  return (<ScrollView style={s.page} keyboardShouldPersistTaps="handled">
    <Stack.Screen options={{ title: 'Morph calculator' }} />
    <Text style={s.mu}>Pick each parent from your animals, or make one up to see "what if" odds.</Text>
    <ParentCard title="Female" p={mother} />
    <ParentCard title="Male" p={father} />
    {mother.ready && father.ready && <Card><MorphCalculator lib={lib} mother={mother.genes} father={father.genes} motherName={mother.name} fatherName={father.name} /></Card>}
    <View style={{ height: 60 }} /></ScrollView>);
}

type Parent = ReturnType<typeof useParent>;
function useParent(lib: Lib, list: Gene[], animals: { id: string; name: string; species: string; sex?: string | null; status?: string | null }[], sex: 'Female' | 'Male') {
  const choices = animals.filter(a => a.sex === sex && a.status !== 'Sold');
  const [mode, setMode] = useState<string | null>(null); const [id, setId] = useState<string | null>(null);
  const [made, setMade] = useState<Map<string, AnimalGene>>(new Map());
  const m = mode ?? (choices.length ? MINE : MADE);
  const animal = m === MINE ? choices.find(a => a.id === id) : undefined;
  const animalGenes = useAnimalGenes(animal?.id);
  const madeGenes = useMemo(() => [...made.values()], [made]);
  const set = (g: Gene, state: GeneState | 'none', pct?: number) => setMade(cur => { const n = new Map(cur);
    if (state === 'none') n.delete(g.key); else n.set(g.key, { gene_key: g.key, state, het_pct: state === 'possible_het' ? (pct ?? cur.get(g.key)?.het_pct ?? 50) : null }); return n; });
  const genes = m === MINE ? animalGenes : madeGenes;
  return { sex, mode: m, setMode, choices, animal, setId, made, set, clear: () => setMade(new Map()), list, genes,
    ready: m === MADE || !!animal, morph: morphName(lib, madeGenes) || 'Normal', name: m === MINE ? animal?.name ?? '' : `a ${morphName(lib, madeGenes) || 'Normal'} ${sex.toLowerCase()}` };
}

function ParentCard({ title, p }: { title: string; p: Parent }) {
  const [open, setOpen] = useState(true); const [q, setQ] = useState('');
  const many = p.choices.length > 12;
  const shown = p.choices.filter(a => !q.trim() || `${a.name} ${a.species}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, many ? 24 : undefined);
  if (p.animal && !shown.includes(p.animal as never)) shown.unshift(p.animal as never);
  return (<Card>
    <Text style={s.h}>{title}</Text>
    <Chips opts={[MINE, MADE]} v={p.mode} on={p.setMode} />
    {p.mode === MINE ? (p.choices.length
      ? <View>{many && <Input label={`Search ${p.sex.toLowerCase()}s`} value={q} onChangeText={setQ} />}
        <Chips opts={shown.map(a => a.name)} v={p.animal?.name ?? ''} on={n => p.setId(p.choices.find(a => a.name === n)?.id ?? null)} /></View>
      : <Text style={s.mu}>No {p.sex.toLowerCase()}s yet. Make one up instead.</Text>)
      : <View>
        <View style={[s.row, { marginTop: 6 }]}><Text style={{ flex: 1, fontWeight: '600' }} accessibilityLabel={`${title} genes`}>{p.morph}</Text>
          <Btn t={open ? 'Hide genes' : 'Choose genes'} onPress={() => setOpen(!open)} />
          {p.made.size > 0 && <Btn t="Clear" onPress={p.clear} />}</View>
        {open && (p.list.length ? <GeneRows list={p.list} value={p.made} onSet={p.set} /> : <Text style={s.mu}>No genes listed yet.</Text>)}
      </View>}
  </Card>);
}
