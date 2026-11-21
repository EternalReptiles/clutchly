import { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Animal, fmt } from '../../lib/logic';
import { Btn, Card, Input, notify, s } from '../../lib/ui';
export default function Animals() {
  const [rows, setRows] = useState<Animal[]>([]); const [q, setQ] = useState(''); const r = useRouter();
  useFocusEffect(useCallback(() => {
    supabase.from('animal_status').select('*').order('name').then(x => { if (x.error) notify('Could not load', x.error.message); setRows((x.data as Animal[]) || []); });
  }, []));
  const l = rows.filter(a => a.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (<View style={s.page}><View style={s.row}><View style={{ flex: 1 }}><Input placeholder="Search" value={q} onChangeText={setQ} /></View>
    <View style={{ marginTop: 8 }}><Btn solid t="+ Add" onPress={() => r.push('/animal/new')} /></View></View>
    <FlatList data={l} keyExtractor={a => a.id}
      ListEmptyComponent={<Text style={[s.mu, { marginTop: 12 }]}>{rows.length ? 'No matches.' : 'No animals yet.'}</Text>}
      renderItem={({ item: a }) => (<Card onPress={() => r.push(`/animal/${a.id}`)}>
      <Text style={s.h}>{a.name}</Text><Text style={s.mu}>{a.species} · {a.sex}{a.status !== 'Active' ? ` · ${a.status}` : ''}{a.last_weight ? ` · ${a.last_weight} g` : ''} · fed {fmt(a.last_feed)} · shed {fmt(a.last_shed)}</Text></Card>)} /></View>);
}
