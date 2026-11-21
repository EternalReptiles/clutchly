import { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Pairing, Season, estimates, fmt, pairStatus, seasonFor } from '../../lib/logic';
import { speciesInfo, words } from '../../lib/species';
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
        const f = animals[p.female_id!]; const e = estimates(p, seasonFor(cfg, f?.species || 'Other'));
        const rp = speciesInfo(f?.species).repro; const w = words(rp);
        const when = p.laid ? (!p.hatched && e.hatch ? ` · hatch ~ ${fmt(e.hatch)}` : '') : e.lay ? ` · ${rp === 'live' ? 'birth' : 'lay'} ~ ${fmt(e.lay)}` : '';
        return (<Card onPress={() => r.push(`/pairing/${p.id}`)}>
          <Text style={s.h}>{f?.name ?? '?'} × {animals[p.male_id!]?.name ?? '?'}</Text>
          <Text style={s.mu}>{pairStatus(p, f?.species)} · {p.locks?.length || 0} {(p.locks?.length || 0) === 1 ? w.lock : w.locks.toLowerCase()}{when}</Text></Card>);
      }} /></View>);
}
