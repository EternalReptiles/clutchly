import { useEffect, useState } from 'react';
import { Modal, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fmt } from './logic';
import { eventLabel, type Ev } from './history';
import { remove, update } from './store';
import { Btn, C, Chips, DateField, Input, confirm, notify, s } from './ui';

/** Edit or delete one history entry. Opens when `ev` is set. */
export function EventEditor({ ev, onClose }: { ev: Ev | null; onClose: () => void }) {
  const [d, setD] = useState(''); const [ok, setOk] = useState(true); const [food, setFood] = useState('');
  const [g, setG] = useState(''); const [note, setNote] = useState('');
  useEffect(() => { if (ev) { setD(ev.on_date); setOk(ev.ok !== false); setFood(ev.food ?? ''); setG(ev.grams != null ? String(ev.grams) : ''); setNote(ev.note ?? ''); } }, [ev]);
  if (!ev) return null;
  const save = () => {
    const patch: Record<string, any> = { on_date: d, note: note.trim() || null };
    if (ev.kind === 'feed') { patch.ok = ok; patch.food = food.trim() || null; }
    if (ev.kind === 'weight') { const n = parseFloat(g.replace(',', '.')); if (!(n > 0)) return notify('Enter a weight in grams'); patch.grams = n; }
    update('events', ev.id, patch); onClose();
  };
  const del = () => confirm('Delete entry?', `${fmt(ev.on_date)} · ${eventLabel(ev)}`, 'Delete', () => { remove('events', ev.id); onClose(); });
  const title = ev.kind === 'feed' ? 'Feed' : ev.kind === 'weight' ? 'Weight' : 'Shed';
  return (<Modal visible animationType={Platform.OS === 'web' ? 'none' : 'slide'} onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView style={s.page} keyboardShouldPersistTaps="handled">
        <Text style={s.h}>Edit {title.toLowerCase()}</Text>
        <DateField label="Date" value={d} onChange={v => v && setD(v)} />
        {ev.kind === 'feed' && <><Text style={[s.mu, { marginTop: 10 }]}>Result</Text>
          <Chips opts={['Fed', 'Refused']} v={ok ? 'Fed' : 'Refused'} on={v => setOk(v === 'Fed')} />
          <Input label="Food" value={food} onChangeText={setFood} placeholder="e.g. medium rat" /></>}
        {ev.kind === 'weight' && <Input label="Weight (g)" keyboardType="decimal-pad" value={g} onChangeText={setG} />}
        <Input label="Note" value={note} onChangeText={setNote} multiline />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <Btn solid t="Save" onPress={save} /><Btn t="Cancel" onPress={onClose} /><Btn danger t="Delete" onPress={del} /></View>
      </ScrollView>
    </SafeAreaView>
  </Modal>);
}
