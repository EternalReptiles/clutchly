import { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { estLay, pairStatus } from '../../lib/logic';
import { Btn, Card, s } from '../../lib/ui';
export default function Pairings() {
  const [rows, setRows] = useState<any[]>([]); const [names, setNames] = useState<Record<string, string>>({}); const r = useRouter();
  useFocusEffect(useCallback(() => {
    supabase.from('pairings').select('*').order('intro', { ascending: false }).then(x => setRows(x.data || []));
    supabase.from('animals').select('id,name').then(x => setNames(Object.fromEntries((x.data || []).map((a: any) => [a.id, a.name]))));
  }, []));
  return (<View style={s.page}><Btn solid t="+ New pairing" onPress={() => r.push('/pairing/new')} />
    <FlatList data={rows} keyExtractor={p => p.id} renderItem={({ item: p }) => (<Card onPress={() => r.push(`/pairing/${p.id}`)}>
      <Text style={s.h}>{names[p.female_id]} × {names[p.male_id]}</Text>
      <Text style={s.mu}>{pairStatus(p)} · {p.locks?.length || 0} locks{estLay(p) ? ` · lay ~${estLay(p)}` : ''}</Text></Card>)} /></View>);
}
