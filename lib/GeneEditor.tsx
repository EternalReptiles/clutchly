import { useMemo, useState } from 'react';
import { Modal, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AnimalGene, Gene, GeneState, Inheritance } from './genetics';
import { insert, remove, update, useStore } from './store';
import { useGenes } from './useGenes';
import { Btn, C, Chips, Input, notify, s } from './ui';

const KIND: Record<Inheritance, string> = { recessive: 'Recessive', incomplete_dominant: 'Incomplete dominant', dominant: 'Dominant', polygenic: 'Line-bred' };
/** The choices offered for a gene, as [state or 'none', label]. */
const choices = (g: Gene): [GeneState | 'none', string][] =>
  g.inheritance === 'recessive' ? [['none', 'None'], ['het', 'Het'], ['possible_het', 'Possible het'], ['visual', 'Visual']]
    : g.inheritance === 'polygenic' ? [['none', 'None'], ['visual', 'Has trait']]
      : g.has_super === false ? [['none', 'None'], ['visual', 'Visual']]
        : [['none', 'None'], ['visual', 'Visual'], ['super', g.super_name || `Super ${g.name}`]];
/** The genes listed for a species: single genes first (library order), then line-bred traits. */
export const speciesGenes = (genes: Map<string, Gene>, species: string) => [...genes.values()].filter(g => g.species === species)
  .sort((a, b) => Number(a.inheritance === 'polygenic') - Number(b.inheritance === 'polygenic') || (a.sort ?? 99) - (b.sort ?? 99) || a.name.localeCompare(b.name));

/** Every gene once (genes listed under several species, like Albino, are matched by name). */
export const allGenes = (genes: Map<string, Gene>, exclude: Gene[] = []) => {
  const seen = new Set(exclude.map(g => g.name.toLowerCase())); const out: Gene[] = [];
  for (const g of [...genes.values()].sort((a, b) => Number(!!a.custom) - Number(!!b.custom))) { const k = g.name.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(g); } }
  return out.sort((a, b) => Number(a.inheritance === 'polygenic') - Number(b.inheritance === 'polygenic') || (a.sort ?? 99) - (b.sort ?? 99) || a.name.localeCompare(b.name));
};

/** One row per gene with its choices. Used for real animals and for made-up parents in the calculator. */
export function GeneRows({ list, value, onSet }: { list: Gene[]; value: Map<string, AnimalGene>; onSet: (g: Gene, state: GeneState | 'none', pct?: number) => void }) {
  return (<>{list.map(g => { const cur = value.get(g.key); const v = cur?.state ?? 'none'; const ch = choices(g);
    return (<View key={g.key} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.bd }}>
      <Text style={[s.h, { fontSize: 16 }]}>{g.name} <Text style={s.mu}>· {KIND[g.inheritance]}{g.custom ? ' · your gene' : ''}</Text></Text>
      {g.description ? <Text style={s.mu}>{g.description}</Text> : null}
      {g.warning ? <Text style={{ color: C.bad }}>{g.warning}</Text> : null}
      <Chips opts={ch.map(c => c[1])} v={(ch.find(c => c[0] === v) ?? ch[1])[1]} on={l => onSet(g, ch.find(c => c[1] === l)![0])} />
      {v === 'possible_het' && <View style={[s.row, { marginTop: 6, flexWrap: 'wrap' }]}>
        <Text style={s.mu}>Chance it's het:</Text>
        <Chips opts={['50%', '66%']} v={`${cur?.het_pct}%`} on={l => onSet(g, 'possible_het', parseInt(l, 10))} />
        <PctInput key={`${g.key}-${cur?.het_pct}`} value={cur?.het_pct} onSave={n => onSet(g, 'possible_het', n)} />
      </View>}
    </View>); })}</>);
}

/** Edit one animal's genes. Changes save straight away (and sync like everything else). */
export function GeneEditor({ open, onClose, animalId, species }: { open: boolean; onClose: () => void; animalId: string; species: string }) {
  const st = useStore(); const genes = useGenes();
  const mine = useMemo(() => new Map(st.animal_genes.filter(g => g.animal_id === animalId).map(g => [g.gene_key as string, g])), [st.animal_genes, animalId]);
  const list = useMemo(() => speciesGenes(genes, species), [genes, species]);
  // Genes listed under other species (e.g. Albino for an Olive python), plus any of those this animal already has.
  const others = useMemo(() => allGenes(genes, list), [genes, list]);
  const [showOthers, setShowOthers] = useState(false);
  const othersShown = showOthers ? others : others.filter(g => mine.has(g.key));
  const [newName, setNewName] = useState(''); const [newKind, setNewKind] = useState<Inheritance>('recessive');

  const set = (g: Gene, state: GeneState | 'none', pct?: number) => {
    const cur = mine.get(g.key);
    if (state === 'none') { if (cur) remove('animal_genes', cur.id); return; }
    const het_pct = state === 'possible_het' ? (pct ?? cur?.het_pct ?? 50) : null;
    if (cur) update('animal_genes', cur.id, { state, het_pct });
    else insert('animal_genes', { animal_id: animalId, gene_key: g.key, state, het_pct });
  };
  const addOwn = () => {
    const name = newName.trim(); if (!name) return notify('Give the gene a name');
    if (list.some(g => g.name.toLowerCase() === name.toLowerCase())) return notify('That gene is already listed');
    insert('user_genes', { species, name, inheritance: newKind }); setNewName('');
  };

  return (<Modal visible={open} animationType={Platform.OS === 'web' ? 'none' : 'slide'} onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[s.row, { padding: 14, paddingBottom: 4 }]}><Text style={[s.h, { flex: 1 }]}>Genes · {species}</Text><Btn solid t="Done" onPress={onClose} /></View>
      <ScrollView style={{ paddingHorizontal: 14 }} keyboardShouldPersistTaps="handled">
        {!list.length && <Text style={s.mu}>No genes listed for {species} yet. Pick from other species or add your own below.</Text>}
        <GeneRows list={list} value={mine as unknown as Map<string, AnimalGene>} onSet={set} />
        {others.length > 0 && <>
          <View style={[s.row, { marginTop: 14 }]}><Text style={[s.h, { flex: 1 }]}>Genes from other species</Text>
            <Btn t={showOthers ? 'Hide' : `Show ${others.length}`} onPress={() => setShowOthers(!showOthers)} /></View>
          <Text style={s.mu}>Many genes turn up across pythons, like Albino or Axanthic. Genes with the same name are treated as the same gene.</Text>
          <GeneRows list={othersShown} value={mine as unknown as Map<string, AnimalGene>} onSet={set} /></>}
        <Text style={[s.h, { marginTop: 18 }]}>Add your own gene</Text>
        <Text style={s.mu}>For genes not listed here. It's private to your account and available for all your {species}.</Text>
        <Input label="Gene name" value={newName} onChangeText={setNewName} />
        <Chips opts={(['recessive', 'incomplete_dominant', 'dominant', 'polygenic'] as Inheritance[]).map(k => KIND[k])} v={KIND[newKind]}
          on={l => setNewKind((Object.keys(KIND) as Inheritance[]).find(k => KIND[k] === l)!)} />
        <View style={{ marginTop: 8 }}><Btn t="Add gene" onPress={addOwn} /></View>
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  </Modal>);
}

/** "Other %" box: saves a whole number from 1 to 99 when the user leaves it. */
function PctInput({ value, onSave }: { value?: number | null; onSave: (n: number) => void }) {
  const [t, setT] = useState(value != null && ![50, 66].includes(value) ? String(value) : '');
  const commit = () => { if (!t.trim()) return; const n = parseInt(t, 10); if (n >= 1 && n <= 99) { if (n !== value) onSave(n); } else notify('Enter a percentage from 1 to 99'); };
  return <View style={{ width: 90 }}><Input label="Other %" keyboardType="number-pad" value={t} onChangeText={setT} onBlur={commit} onSubmitEditing={commit} /></View>;
}
