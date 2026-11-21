import { useMemo, useState } from 'react';
import { morphName } from '../../lib/genetics';
import { useGeneLib } from '../../lib/useGenes';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { fmt } from '../../lib/logic';
import { useCollection } from '../../lib/derived';
import { sync } from '../../lib/store';
import { Btn, C, Card, Input, s } from '../../lib/ui';
import { useStore } from '../../lib/store';
import { coverOf, useSignedUrls } from '../../lib/photos';
import { Thumb } from '../../lib/PhotoGallery';
import { EmptyState, LogoMark } from '../../lib/Brand';
export default function Animals() {
  const { ready, animals: rows } = useCollection(); const [q, setQ] = useState(''); const r = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => { setRefreshing(true); await sync(); setRefreshing(false); };
  const l = rows.filter(a => a.name.toLowerCase().includes(q.trim().toLowerCase()));
  const { animal_photos } = useStore(); // eslint-disable-line
  const covers = useMemo(() => Object.fromEntries(rows.flatMap(a => { const c = coverOf(animal_photos, a.id); return c ? [[a.id, c.path]] : []; })), [rows, animal_photos]);
  const urls = useSignedUrls(Object.values(covers) as string[]);
  const genes = useGeneLib(); const { animal_genes } = useStore();
  const morphs = useMemo(() => { const by: Record<string, any[]> = {}; for (const g of animal_genes) (by[g.animal_id] ??= []).push(g);
    return Object.fromEntries(Object.entries(by).map(([k, v]) => [k, morphName(genes, v)])); }, [animal_genes, genes]);
  return (<View style={s.page}><View style={s.row}><View style={{ flex: 1 }}><Input placeholder="Search" value={q} onChangeText={setQ} /></View>
    <View style={{ marginTop: 8, flexDirection: 'row', gap: 6 }}><Btn t="Bulk add" onPress={() => r.push('/import')} /><Btn solid t="+ Add" onPress={() => r.push('/animal/new')} /></View></View>
    <FlatList data={l} keyExtractor={a => a.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.ink} />}
      ListEmptyComponent={!ready || rows.length ? <Text style={[s.mu, { marginTop: 12 }]}>{!ready ? 'Loading your collection…' : 'No matches.'}</Text>
        : <EmptyState title="No animals yet" text="No animals yet. Tap + Add, or Bulk add to paste a list or import a CSV." />}
      renderItem={({ item: a }) => (<Card onPress={() => r.push(`/animal/${a.id}`)}><View style={s.row}>
      {covers[a.id] ? <Thumb uri={urls[covers[a.id]]} size={52} label={a.name} />
        : <View style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: C.bg, borderWidth: 1, borderColor: C.bd, alignItems: 'center', justifyContent: 'center' }}><LogoMark size={36} faded /></View>}
      <View style={{ flex: 1 }}><Text style={s.h}>{a.name}</Text>{morphs[a.id] ? <Text style={{ color: C.ink }}>{morphs[a.id]}</Text> : null}<Text style={s.mu}>{a.species} · {a.sex}{a.status !== 'Active' ? ` · ${a.status}` : ''}{a.last_weight ? ` · ${a.last_weight} g` : ''} · fed {fmt(a.last_feed)} · shed {fmt(a.last_shed)}</Text></View></View></Card>)} /></View>);
}
