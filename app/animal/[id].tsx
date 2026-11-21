import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { SPECIES, today } from '../../lib/logic';
import { Btn, Chips, Input, s } from '../../lib/ui';
export default function AnimalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const isNew = id === 'new'; const r = useRouter();
  const [a, setA] = useState<any>({ name: '', species: 'Carpet', sex: 'Female', status: 'Active' });
  const [ev, setEv] = useState<any[]>([]); const [food, setFood] = useState(''); const [g, setG] = useState('');
  const load = useCallback(async () => {
    if (isNew) return;
    const [x, e] = await Promise.all([supabase.from('animals').select('*').eq('id', id).single(),
      supabase.from('events').select('*').eq('animal_id', id).order('on_date', { ascending: false }).limit(25)]);
    if (x.data) setA(x.data); setEv(e.data || []);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const save = async () => {
    if (!a.name.trim()) return;
    const body = { name: a.name.trim(), species: a.species, sex: a.sex, status: a.status, dob: a.dob || null, feed_every: a.feed_every ? +a.feed_every : null, notes: a.notes };
    const { error } = isNew ? await supabase.from('animals').insert(body) : await supabase.from('animals').update(body).eq('id', id);
    error ? Alert.alert('Error', error.message) : r.back();
  };
  const log = async (kind: string, extra: any = {}) => { await supabase.from('events').insert({ animal_id: id, kind, on_date: today(), ...extra }); load(); };
  const del = () => Alert.alert('Delete animal?', 'Its history is deleted too.', [{ text: 'Cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('animals').delete().eq('id', id); r.back(); } }]);
  return (<ScrollView style={s.page}><Stack.Screen options={{ title: isNew ? 'New animal' : a.name }} />
    <Input label="Name / ID" value={a.name} onChangeText={v => setA({ ...a, name: v })} />
    <Text style={[s.mu, { marginTop: 8 }]}>Species</Text><Chips opts={SPECIES} v={a.species} on={v => setA({ ...a, species: v })} />
    <Text style={[s.mu, { marginTop: 8 }]}>Sex</Text><Chips opts={['Female', 'Male']} v={a.sex} on={v => setA({ ...a, sex: v })} />
    <Text style={[s.mu, { marginTop: 8 }]}>Status</Text><Chips opts={['Active', 'Breeding', 'Resting', 'Sold']} v={a.status} on={v => setA({ ...a, status: v })} />
    <Input label="Hatch date (YYYY-MM-DD)" value={a.dob || ''} onChangeText={v => setA({ ...a, dob: v })} />
    <Input label="Feed every N days (blank = 7 females / 21 males)" keyboardType="number-pad" value={a.feed_every ? String(a.feed_every) : ''} onChangeText={v => setA({ ...a, feed_every: v })} />
    <Input label="Notes" multiline value={a.notes || ''} onChangeText={v => setA({ ...a, notes: v })} />
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}><Btn solid t="Save" onPress={save} />{!isNew && <Btn danger t="Delete" onPress={del} />}</View>
    {!isNew && <><Text style={[s.h, { marginTop: 22 }]}>Log today</Text>
      <Input label="Food" value={food} onChangeText={setFood} /><Input label="Weight (g)" keyboardType="decimal-pad" value={g} onChangeText={setG} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <Btn solid t="Fed" onPress={() => log('feed', { ok: true, food })} /><Btn t="Refused" onPress={() => log('feed', { ok: false, food })} />
        <Btn t="Shed" onPress={() => log('shed')} /><Btn t="Weight" onPress={() => g && log('weight', { grams: +g })} /></View>
      <Text style={[s.h, { marginTop: 22 }]}>History</Text>
      {ev.map(e => <Text key={e.id} style={{ paddingVertical: 4 }}>{e.on_date} · {e.kind === 'feed' ? (e.ok ? 'Fed' : 'Refused') + (e.food ? ` (${e.food})` : '') : e.kind === 'weight' ? `${e.grams} g` : 'Shed'}</Text>)}</>}
    <View style={{ height: 60 }} /></ScrollView>);
}
