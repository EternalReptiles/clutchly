import { useEffect, useMemo, useState } from 'react';
import { hatchlingGenes, morphName } from './genetics';
import { useAnimalGenes, useGeneLib } from './useGenes';
import { Modal, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from './supabase';
import { fmt, type Animal, type Pairing } from './logic';
import { DEFAULT_PATTERN, hatchlingNames, normalisePattern } from './hatchlings';
import { getState, insertMany, update } from './store';
import { usePlan } from './plan';
import { goPro } from './goPro';
import { Btn, C, Input, notify, s } from './ui';

/** Creates hatchlings from a pairing: asks how many, names them from the user's pattern, links them to both parents. */
export function HatchlingDialog({ open, onClose, onCreated, pairing, mother, father, hatchDate, existingCount }:
  { open: boolean; onClose: () => void; onCreated: (counts: { clutch: number | null; fertile: number | null }) => void; pairing: Pairing; mother?: Animal; father?: Animal; hatchDate: string; existingCount: number }) {
  const [count, setCount] = useState(''); const [clutch, setClutch] = useState(''); const [fertile, setFertile] = useState('');
  const [pattern, setPattern] = useState(DEFAULT_PATTERN); const [countTouched, setCountTouched] = useState(false);
  const fromFertile = (f: string) => (f.trim() ? String(Math.max(0, (parseInt(f, 10) || 0) - existingCount)) : '');
  useEffect(() => {
    if (!open) return;
    setClutch(pairing.clutch != null ? String(pairing.clutch) : ''); setFertile(pairing.fertile != null ? String(pairing.fertile) : '');
    setCount(fromFertile(pairing.fertile != null ? String(pairing.fertile) : '')); setCountTouched(false);
    supabase.auth.getSession().then(({ data }) => setPattern(data.session?.user.user_metadata?.hatchling_pattern || DEFAULT_PATTERN));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = parseInt(count, 10) || 0; const plan = usePlan();
  const lib = useGeneLib(); const mg = useAnimalGenes(mother?.id); const fg = useAnimalGenes(father?.id);
  const inherited = useMemo(() => hatchlingGenes(lib, mg, fg), [lib, mg, fg]);
  const names = useMemo(() => n > 0 && n <= 200 ? hatchlingNames(pattern, hatchDate, mother?.name ?? '', father?.name ?? '', n, getState().animals.map(a => a.name)) : [],
    [n, pattern, hatchDate, mother?.name, father?.name]);
  const num = (v: string) => (v.trim() ? parseInt(v, 10) : null);
  const create = () => {
    const c = num(clutch), f = num(fertile);
    if (!mother) return notify('The pairing has no female');
    if (!(n >= 1 && n <= 200)) return notify('How many hatchlings? Enter 1 to 200.');
    if (!plan.isPro && n > plan.remaining) { onClose(); return goPro(`The free plan has room for ${plan.remaining} more animal${plan.remaining === 1 ? '' : 's'} (up to ${plan.freeAnimals}). Go Pro to add all ${n} hatchlings.`); }
    if ((c != null && (isNaN(c) || c < 0)) || (f != null && (isNaN(f) || f < 0))) return notify('Clutch and fertile counts must be numbers');
    if (c != null && f != null && f > c) return notify('Fertile eggs cannot be more than the clutch size');
    const added = insertMany('animals', names.map(name => ({ name, species: mother.species, sex: 'Unknown', status: 'Active', dob: hatchDate,
      mother_id: mother.id, father_id: father?.id ?? null, pairing_id: pairing.id })));
    // Genes every hatchling carries (or may carry) from its parents; visual genes are set once they show.
    insertMany('animal_genes', added.flatMap(a => inherited.map(g => ({ animal_id: a.id, gene_key: g.gene_key, state: g.state, het_pct: g.het_pct ?? null }))));
    update('pairings', pairing.id!, { clutch: c, fertile: f });
    const p = normalisePattern(pattern);
    supabase.auth.updateUser({ data: { hatchling_pattern: p } }).catch(() => {}); // remembered for next time (needs a connection)
    onCreated({ clutch: c, fertile: f }); onClose(); notify(`${names.length} hatchling${names.length === 1 ? '' : 's'} added`, `${names[0]}${names.length > 1 ? ` to ${names[names.length - 1]}` : ''}`);
  };
  return (<Modal visible={open} animationType={Platform.OS === 'web' ? 'none' : 'slide'} onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView style={s.page} keyboardShouldPersistTaps="handled">
        <Text style={s.h}>Create hatchlings</Text>
        <Text style={[s.mu, { marginTop: 4 }]}>{mother?.name ?? '?'} × {father?.name ?? '?'} · hatched {fmt(hatchDate)}. Each hatchling is added as a {mother?.species ?? ''} with sex Unknown, linked to both parents.</Text>
        {existingCount > 0 && <Text style={{ color: C.bad, marginTop: 6 }}>{existingCount} hatchling{existingCount === 1 ? ' has' : 's have'} already been created from this pairing.</Text>}
        <Input label="Clutch size (eggs laid)" keyboardType="number-pad" value={clutch} onChangeText={setClutch} />
        <Input label="Fertile eggs" keyboardType="number-pad" value={fertile} onChangeText={v => { setFertile(v); if (!countTouched) setCount(fromFertile(v)); }} />
        <Input label="How many hatchlings to add" keyboardType="number-pad" value={count} onChangeText={v => { setCount(v); setCountTouched(true); }} />
        <Input label="ID pattern" value={pattern} onChangeText={setPattern} autoCapitalize="none" autoCorrect={false} />
        <Text style={[s.mu, { marginTop: 4 }]}>{'{YYYY}'} or {'{YY}'} = hatch year · {'{###}'} = running number (one # per digit) · {'{MOTHER}'} {'{FATHER}'} = parents' names. Numbering carries on from your existing IDs.</Text>
        {!plan.isPro && <Text style={[s.mu, { marginTop: 6 }]}>Free plan: room for {plan.remaining} more animal{plan.remaining === 1 ? '' : 's'} (up to {plan.freeAnimals}).</Text>}
        {inherited.length > 0 && <Text style={[s.mu, { marginTop: 6 }]}>Each hatchling will be recorded as {morphName(lib, inherited)} (from the parents' genes). Set visual genes once they show.</Text>}
        {names.length > 0 && <View style={[s.card, { marginTop: 10 }]}><Text style={s.mu}>Will create</Text>
          <Text style={{ color: C.ink, marginTop: 2 }}>{names.length <= 6 ? names.join(', ') : `${names.slice(0, 3).join(', ')} … ${names[names.length - 1]}`}</Text></View>}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Btn solid t={names.length ? `Create ${names.length}` : 'Create'} onPress={create} /><Btn t="Cancel" onPress={onClose} /></View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  </Modal>);
}
