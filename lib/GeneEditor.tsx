import { useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from './ModalSafeArea';
import { canonical, type AnimalGene, type Combo, type Gene, type GeneState, type Inheritance } from './genetics';
import { insert, remove, update, useStore } from './store';
import { useGeneLib } from './useGenes';
import { Btn, C, Chips, Input, notify, s } from './ui';

const KIND: Record<Inheritance, string> = { recessive: 'Recessive', incomplete_dominant: 'Incomplete dominant', dominant: 'Dominant', polygenic: 'Line-bred' };
/** The choices offered for a gene, as [state or 'none', label]. */
const choices = (g: Gene): [GeneState | 'none', string][] =>
  g.inheritance === 'recessive' ? [['none', 'None'], ['het', 'Het'], ['possible_het', 'Possible het'], ['visual', 'Visual']]
    : g.inheritance === 'polygenic' ? [['none', 'None'], ['visual', 'Has trait']]
      : g.inheritance === 'dominant' || g.has_super === false ? [['none', 'None'], ['visual', 'Visual']]
        : [['none', 'None'], ['visual', 'Visual'], ['super', g.super_name || `Super ${g.name}`]];
/** Every gene once (genes listed under several species, like Albino, are matched by name). */
export const allGenes = (genes: Map<string, Gene>, exclude: Gene[] = []) => {
  const seen = new Set(exclude.map(g => g.name.toLowerCase())); const out: Gene[] = [];
  for (const g of [...genes.values()].sort((a, b) => Number(!!a.custom) - Number(!!b.custom))) { const k = g.name.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(g); } }
  return out.sort((a, b) => KINDS.indexOf(a.inheritance) - KINDS.indexOf(b.inheritance) || a.name.localeCompare(b.name));
};
const KINDS: Inheritance[] = ['recessive', 'incomplete_dominant', 'dominant', 'polygenic'];

/** Search box, combinations (e.g. Sunglow) as one-tap shortcuts, then the gene rows grouped by type. */
export function GenePicker({ genes, value, onSet, combos = [] }: { genes: Map<string, Gene>; value: Map<string, AnimalGene>;
  onSet: (g: Gene, state: GeneState | 'none', pct?: number) => void; combos?: Combo[] }) {
  const [q, setQ] = useState('');
  // A combination is a name for genes seen together; tapping it makes the first gene of each part visual
  // (Sunglow: Caramel + Albino). Where a part has alternatives (Caramel or Hypo), the others can be chosen below.
  const shown2 = combos.map(c => ({ c, parts: c.groups.map(gr => genes.get(gr[0])).filter((g): g is Gene => !!g) }))
    .filter(x => x.parts.length === x.c.groups.length && (!q.trim() || `${x.c.name} ${x.parts.map(p => p.name).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => a.parts.length - b.parts.length || a.c.name.localeCompare(b.c.name));
  const isSet = (c: Combo) => c.groups.every(gr => gr.some(k => ['visual', 'super'].includes(value.get(k)?.state ?? '')));
  const list = useMemo(() => allGenes(genes), [genes]);
  const rest = list.filter(g => !q.trim() || g.name.toLowerCase().includes(q.trim().toLowerCase())), shown = rest;
  return (<View>
    <Input label="Search genes" value={q} onChangeText={setQ} />
    {shown2.length > 0 && <View>
      <Text style={[s.mu, { marginTop: 14, fontWeight: '700' }]}>COMBINATIONS</Text>
      <Text style={s.mu}>Tap one to set the genes it's made of. The animal is then named after it.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
        {shown2.map(({ c, parts }) => { const on = isSet(c);
          return <Pressable key={c.id} onPress={() => parts.forEach(g => onSet(g, 'visual'))} accessibilityRole="button" accessibilityLabel={`${c.name}: ${parts.map(p => p.name).join(' and ')}`}
            aria-pressed={on} style={[s.btn, { alignItems: 'flex-start' }, on && { backgroundColor: C.ink, borderColor: C.ink }]}>
            <Text style={{ color: on ? C.bg : C.ink, fontWeight: '700' }}>{on ? '✓ ' : ''}{c.name}</Text>
            <Text style={{ color: on ? C.bg : C.mu, fontSize: 12 }}>{parts.map(p => p.name).join(' + ')}</Text></Pressable>; })}
      </View></View>}
    {KINDS.map(k => { const l = rest.filter(g => g.inheritance === k); return l.length ? <View key={k}>
      <Text style={[s.mu, { marginTop: 14, fontWeight: '700' }]}>{KIND[k].toUpperCase()}</Text><GeneRows list={l} value={value} onSet={onSet} /></View> : null; })}
    {!shown.length && <Text style={[s.mu, { marginTop: 8 }]}>No genes match "{q}".</Text>}
  </View>);
}

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

/**
 * Edit one animal's genes. For a saved animal, changes save straight away (and sync like everything else).
 * For a new animal (no animalId yet), the genes are a draft held by the caller and saved with the animal.
 */
export function GeneEditor({ open, onClose, animalId, species, draft, onDraft }: { open: boolean; onClose: () => void; animalId?: string; species: string;
  draft?: Map<string, AnimalGene>; onDraft?: (m: Map<string, AnimalGene>) => void }) {
  const st = useStore(); const lib = useGeneLib(); const genes = lib.genes;
  const mine = useMemo(() => new Map(st.animal_genes.filter(g => g.animal_id === animalId).map(g => [g.gene_key as string, g])), [st.animal_genes, animalId]);
  const list = useMemo(() => allGenes(genes), [genes]);
  const value = useMemo(() => { if (draft) return draft; const c = canonical({ genes, combos: [] });
    return new Map([...mine.values()].map(r => [c(r.gene_key as string), r as unknown as AnimalGene])); }, [mine, genes, draft]);
  const [newName, setNewName] = useState(''); const [newKind, setNewKind] = useState<Inheritance>('recessive');
  // The latest draft, so several changes in one tap (a combination sets two or three genes) build on each other.
  const latest = useRef(draft); latest.current = draft;
  const set = (g: Gene, state: GeneState | 'none', pct?: number) => {
    const cur = (latest.current ?? value).get(g.key) as any;
    if (latest.current && onDraft) { const n = new Map(latest.current); latest.current = n;
      if (state === 'none') n.delete(g.key);
      else n.set(g.key, { gene_key: g.key, state, het_pct: state === 'possible_het' ? (pct ?? cur?.het_pct ?? 50) : null });
      return onDraft(n); }
    if (!animalId) return;
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
      <View style={[s.row, { padding: 14, paddingBottom: 4 }]}><Text style={[s.h, { flex: 1 }]}>Genes</Text><Btn solid t="Done" onPress={onClose} /></View>
      <ScrollView style={{ paddingHorizontal: 14 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <GenePicker genes={genes} value={value} onSet={set} combos={lib.combos} />
        <Text style={[s.h, { marginTop: 18 }]}>Add your own gene</Text>
        <Text style={s.mu}>For genes not listed here. It's private to your account and available for all your animals.</Text>
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
