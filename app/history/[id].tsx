import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { fmt } from '../../lib/logic';
import { eventLabel, filterEvents, type Ev, type Kind } from '../../lib/history';
import { EventEditor } from '../../lib/EventEditor';
import { useStore } from '../../lib/store';
import { C, Chips, DateField, s } from '../../lib/ui';

const TYPES: [string, Kind[]][] = [['All', ['feed', 'shed', 'in_shed', 'weight']], ['Feeds', ['feed']], ['Sheds', ['shed', 'in_shed']], ['Weights', ['weight']]];

/** Full history of one animal, filtered by type and date range; tap an entry to edit or delete it. */
export default function History() {
  const { id } = useLocalSearchParams<{ id: string }>(); const st = useStore();
  const animal = st.animals.find(a => a.id === id);
  const [type, setType] = useState('All'); const [from, setFrom] = useState<string | null>(null); const [to, setTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<Ev | null>(null);
  const all = useMemo(() => (st.events as Ev[]).filter(e => e.animal_id === id), [st.events, id]);
  const rows = useMemo(() => filterEvents(all, { kinds: TYPES.find(t => t[0] === type)![1], from, to }), [all, type, from, to]);
  return (<View style={s.page}>
    <Stack.Screen options={{ title: animal ? `${animal.name} · history` : 'History' }} />
    <Chips opts={TYPES.map(t => t[0])} v={type} on={setType} />
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ flex: 1 }}><DateField optional label="From" value={from} onChange={setFrom} /></View>
      <View style={{ flex: 1 }}><DateField optional label="To" value={to} onChange={setTo} /></View></View>
    <Text style={[s.mu, { marginTop: 10 }]}>{rows.length} of {all.length} entries · tap one to edit or delete it</Text>
    <FlatList data={rows} keyExtractor={e => e.id} style={{ marginTop: 4 }}
      ListEmptyComponent={<Text style={[s.mu, { marginTop: 8 }]}>{all.length ? 'Nothing matches these filters.' : 'Nothing logged yet.'}</Text>}
      renderItem={({ item: e }) => <Pressable onPress={() => setEditing(e)} accessibilityRole="button"
        style={{ paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.bd }}>
        <Text style={{ color: C.ink }}>{fmt(e.on_date)} · {eventLabel(e)}</Text>
        {e.note ? <Text style={s.mu}>{e.note}</Text> : null}</Pressable>} />
    <EventEditor ev={editing} onClose={() => setEditing(null)} />
  </View>);
}
