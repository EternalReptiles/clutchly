import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { estLay, pairStatus, today } from '../../lib/logic';
import { Btn, Chips, Input, s } from '../../lib/ui';
const DATES: [string, string][] = [['intro', 'Introduced'], ['removed', 'Male removed'], ['ovulation', 'Ovulation'], ['prelay_shed', 'Pre-lay shed'], ['laid', 'Eggs laid'], ['hatched', 'Hatched']];
export default function PairingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const isNew = id === 'new'; const r = useRouter();
  const [p, setP] = useState<any>({ locks: [] }); const [animals, setAnimals] = useState<any[]>([]);
  const load = useCallback(async () => {
    const a = await supabase.from('animals').select('id,name,sex').order('name'); setAnimals(a.data || []);
    if (!isNew) { const x = await supabase.from('pairings').select('*').eq('id', id).single(); if (x.data) setP(x.data); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const nm = (i?: string) => animals.find(a => a.id === i)?.name || '';
  const byName = (n: string) => animals.find(a => a.name === n)?.id;
  const save = async (patch: any = {}) => {
    const body = { ...p, ...patch }; delete body.id; delete body.user_id;
    DATES.forEach(([k]) => { if (body[k] === '') body[k] = null; });
    if (!body.female_id || !body.male_id) return Alert.alert('Pick a female and a male');
    const { error } = isNew ? await supabase.from('pairings').insert(body) : await supabase.from('pairings').update(body).eq('id', id);
    if (error) Alert.alert('Error', error.message); else if (isNew) r.back(); else { setP(body); load(); }
  };
  const e = estLay(p);
  return (<ScrollView style={s.page}><Stack.Screen options={{ title: isNew ? 'New pairing' : 'Pairing' }} />
    <Text style={s.mu}>Female</Text><Chips opts={animals.filter(a => a.sex === 'Female').map(a => a.name)} v={nm(p.female_id)} on={n => setP({ ...p, female_id: byName(n) })} />
    <Text style={[s.mu, { marginTop: 10 }]}>Male</Text><Chips opts={animals.filter(a => a.sex === 'Male').map(a => a.name)} v={nm(p.male_id)} on={n => setP({ ...p, male_id: byName(n) })} />
    {!isNew && <><Text style={[s.h, { marginTop: 14 }]}>{pairStatus(p)}{e ? ` · estimated lay ${e}` : ''}</Text>
      {DATES.map(([k, l]) => <Input key={k} label={`${l} (YYYY-MM-DD)`} value={p[k] || ''} onChangeText={v => setP({ ...p, [k]: v })} />)}
      <Input label="Clutch size" keyboardType="number-pad" value={p.clutch != null ? String(p.clutch) : ''} onChangeText={v => setP({ ...p, clutch: v ? +v : null })} />
      <Input label="Fertile eggs" keyboardType="number-pad" value={p.fertile != null ? String(p.fertile) : ''} onChangeText={v => setP({ ...p, fertile: v ? +v : null })} />
      <Text style={[s.h, { marginTop: 14 }]}>Locks ({p.locks?.length || 0})</Text>
      <Btn t="+ Log lock today" onPress={() => save({ locks: [...(p.locks || []), today()] })} />
      {(p.locks || []).map((d: string, i: number) => <Text key={i} style={{ paddingVertical: 3 }}>{d}</Text>)}
      <Input label="Notes" multiline value={p.notes || ''} onChangeText={v => setP({ ...p, notes: v })} /></>}
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}><Btn solid t={isNew ? 'Create' : 'Save'} onPress={() => save()} />
      {!isNew && <Btn danger t="Delete" onPress={async () => { await supabase.from('pairings').delete().eq('id', id); r.back(); }} />}</View>
    <View style={{ height: 60 }} /></ScrollView>);
}
