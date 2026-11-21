import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { estimates, fmt, pairStatus, seasonFor } from '../../lib/logic';
import { speciesInfo, words } from '../../lib/species';
import { useCollection } from '../../lib/derived';
import { sync } from '../../lib/store';
import { Btn, C, Card, s } from '../../lib/ui';
export default function Pairings() {
  const { ready, animals: list, pairings, seasons: cfg } = useCollection(); const r = useRouter();
  const animals = useMemo(() => Object.fromEntries(list.map(a => [a.id, a])), [list]);
  const rows = useMemo(() => [...pairings].sort((a, b) => (b.intro ?? '').localeCompare(a.intro ?? '')), [pairings]);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => { setRefreshing(true); await sync(); setRefreshing(false); };
  return (<View style={s.page}><Btn solid t="+ New pairing" onPress={() => r.push('/pairing/new')} />
    <FlatList data={rows} keyExtractor={p => p.id!}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.ink} />}
      ListEmptyComponent={<Text style={[s.mu, { marginTop: 12 }]}>{ready ? 'No pairings yet.' : 'Loading…'}</Text>}
      renderItem={({ item: p }) => {
        const f = animals[p.female_id!]; const e = estimates(p, seasonFor(cfg, f?.species || 'Other'));
        const rp = speciesInfo(f?.species).repro; const w = words(rp);
        const when = p.laid ? (!p.hatched && e.hatch ? ` · hatch ~ ${fmt(e.hatch)}` : '') : e.lay ? ` · ${rp === 'live' ? 'birth' : 'lay'} ~ ${fmt(e.lay)}` : '';
        return (<Card onPress={() => r.push(`/pairing/${p.id}`)}>
          <Text style={s.h}>{f?.name ?? '?'} × {animals[p.male_id!]?.name ?? '?'}</Text>
          <Text style={s.mu}>{pairStatus(p, f?.species)} · {p.locks?.length || 0} {(p.locks?.length || 0) === 1 ? w.lock : w.locks.toLowerCase()}{when}</Text></Card>);
      }} /></View>);
}
