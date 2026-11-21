import { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Animal, Season, isPaused, nextFeed, today, diffDays } from '../../lib/logic';
import { Btn, Card, s } from '../../lib/ui';
export default function Today() {
  const [rows, setRows] = useState<Animal[]>([]); const [cfg, setCfg] = useState<Season[]>([]); const r = useRouter();
  const load = useCallback(async () => {
    const [a, c] = await Promise.all([supabase.from('animal_status').select('*').neq('status', 'Sold'), supabase.from('season_settings').select('*')]);
    setRows((a.data as Animal[]) || []); setCfg((c.data as Season[]) || []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const t = today();
  const due = rows.filter(a => !isPaused(cfg.find(c => c.species === a.species), t)).map(a => ({ a, n: nextFeed(a) }))
    .filter(x => diffDays(x.n, t) <= 3).sort((x, y) => x.n.localeCompare(y.n));
  const log = async (id: string, ok: boolean) => { await supabase.from('events').insert({ animal_id: id, kind: 'feed', ok }); load(); };
  return (<View style={s.page}><FlatList data={due} keyExtractor={x => x.a.id}
    ListEmptyComponent={<Text style={s.mu}>Nothing due in the next 3 days.</Text>}
    renderItem={({ item: { a, n } }) => (<Card onPress={() => r.push(`/animal/${a.id}`)}><View style={s.row}>
      <View style={{ flex: 1 }}><Text style={s.h}>{a.name}</Text>
        <Text style={s.mu}>{a.species} · {a.sex} · {n <= t ? (n < t ? `${diffDays(t, n)}d overdue` : 'due today') : `due ${n}`}</Text></View>
      <Btn solid t="Fed" onPress={() => log(a.id, true)} /><Btn t="Refused" onPress={() => log(a.id, false)} /></View></Card>)} /></View>);
}
