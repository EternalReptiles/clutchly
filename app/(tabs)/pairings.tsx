import { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Pairing, Season, estLay, fmt, pairStatus, seasonFor } from '../../lib/logic';
import { Btn, Card, notify, s } from '../../lib/ui';
type A = { id: string; name: string; species: string };
export default function Pairings() {
  const [rows, setRows] = useState<Pairing[]>([]); const [animals, setAnimals] = useState<Record<string, A>>({});
  const [cfg, setCfg] = useState<Season[]>([]); const r = useRouter();
  useFocusEffect(useCallback(() => {
    Promise.all([supabase.from('pairings').select('*').order('intro', { ascending: false }),
      supabase.from('animals').select('id,name,species'), supabase.from('season_settings').select('*')]).then(([p, a, c]) => {
      const err = p.error || a.error || c.error; if (err) notify('Could not load', err.message);
      setRows((p.data as Pairing[]) || []); setCfg((c.data as Season[]) || []);
      setAnimals(Object.fromEntries(((a.data as A[]) || []).map(x => [x.id, x])));
    });
  }, []));
  return (<View style={s.page}><Btn solid t="+ New pairing" onPress={() => r.push('/pairing/new')} />
    <FlatList data={rows} keyExtractor={p => p.id!}
      ListEmptyComponent={<Text style={[s.mu, { marginTop: 12 }]}>No pairings yet.</Text>}
      renderItem={({ item: p }) => {
        const f = animals[p.female_id!]; const e = estLay(p, seasonFor(cfg, f?.species || 'Other'));
        return (<Card onPress={() => r.push(`/pairing/${p.id}`)}>
          <Text style={s.h}>{f?.name ?? '?'} × {animals[p.male_id!]?.name ?? '?'}</Text>
          <Text style={s.mu}>{pairStatus(p)} · {p.locks?.length || 0} locks{e ? ` · ${p.laid ? 'laid' : 'lay ~'} ${fmt(e)}` : ''}</Text></Card>);
      }} /></View>);
}
