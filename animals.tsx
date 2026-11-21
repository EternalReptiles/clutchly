import { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Animal } from '../../lib/logic';
import { Btn, Card, Input, s } from '../../lib/ui';
export default function Animals() {
  const [rows, setRows] = useState<Animal[]>([]); const [q, setQ] = useState(''); const r = useRouter();
  useFocusEffect(useCallback(() => { supabase.from('animal_status').select('*').order('name').then(x => setRows((x.data as Animal[]) || [])); }, []));
  const l = rows.filter(a => a.name.toLowerCase().includes(q.toLowerCase()));
  return (<View style={s.page}><View style={s.row}><View style={{ flex: 1 }}><Input placeholder="Search" value={q} onChangeText={setQ} /></View>
    <Btn solid t="+ Add" onPress={() => r.push('/animal/new')} /></View>
    <FlatList data={l} keyExtractor={a => a.id} renderItem={({ item: a }) => (<Card onPress={() => r.push(`/animal/${a.id}`)}>
      <Text style={s.h}>{a.name}</Text><Text style={s.mu}>{a.species} · {a.sex}{a.last_weight ? ` · ${a.last_weight} g` : ''} · fed {a.last_feed || '–'} · shed {a.last_shed || '–'}</Text></Card>)} /></View>);
}
