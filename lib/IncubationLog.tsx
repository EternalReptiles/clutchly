// On a pairing once eggs are laid: the incubator and its target temperature, readings (temperature, humidity, good
// eggs, a note) and a summary. Readings are saved straight away and work offline (table incubation_logs).
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fmt, today, type Pairing } from './logic';
import { insert, remove, update, useStore } from './store';
import { Btn, C, DateField, Input, confirm, notify, s } from './ui';
import { offTarget, readingText, sortReadings, summary, type Reading } from './incubation';

const parse = (v: string) => { const t = v.trim().replace(',', '.'); return t === '' ? null : Number(t); };

export function IncubationLog({ id, p, setP }: { id: string; p: Pairing; setP: (p: Pairing) => void }) {
  const st = useStore();
  const readings = useMemo(() => sortReadings((st.incubation_logs as Reading[]).filter(r => r.pairing_id === id)), [st.incubation_logs, id]);
  const [day, setDay] = useState(today()); const [temp, setTemp] = useState(''); const [hum, setHum] = useState('');
  const [eggs, setEggs] = useState(''); const [note, setNote] = useState(''); const [all, setAll] = useState(false);
  const [target, setTarget] = useState(p.target_temp != null ? String(p.target_temp) : '');
  const sm = summary(readings, p.laid, p.hatched, p.target_temp, today());

  // Incubator name and target are saved as soon as you leave the field (as well as with the pairing's Save).
  const saveSetup = (patch: Partial<Pairing>) => { update('pairings', id, patch); setP({ ...p, ...patch }); };
  const add = () => {
    const t = parse(temp), h = parse(hum), e = parse(eggs);
    if ([t, h, e].some(x => x !== null && isNaN(x))) return notify('Check the numbers', 'Temperature, humidity and good eggs need to be numbers.');
    if (t !== null && (t < 0 || t > 60)) return notify('Check the temperature', 'Enter it in °C, e.g. 31.5.');
    if (h !== null && (h < 0 || h > 100)) return notify('Check the humidity', 'Enter it as a percentage, e.g. 75.');
    if (t === null && h === null && e === null && !note.trim()) return notify('Nothing to add', 'Enter a temperature, humidity, good eggs or a note.');
    insert('incubation_logs', { pairing_id: id, on_date: day, temp: t, humidity: h, eggs_good: e === null ? null : Math.round(e), note: note.trim() || null });
    setTemp(''); setHum(''); setNote('');
  };
  const del = (r: Reading) => confirm('Delete this reading?', `${fmt(r.on_date)} · ${readingText(r)}`, 'Delete', () => remove('incubation_logs', r.id));
  const shown = all ? readings : readings.slice(0, 8);
  const range = (x: [number, number] | null, unit: string) => x ? (x[0] === x[1] ? `${x[0]}${unit}` : `${x[0]}–${x[1]}${unit}`) : null;

  return (<View style={[s.card, { marginTop: 14 }]} accessibilityLabel="Incubation">
    <Text style={s.h}>Incubation{sm.day !== null ? ` · day ${sm.day}` : ''}</Text>
    <Text style={s.mu}>{[sm.readings ? `${sm.readings} reading${sm.readings === 1 ? '' : 's'}` : 'No readings yet', range(sm.temp, ' °C'), range(sm.humidity, '%'),
      sm.eggsGood !== null && `${sm.eggsGood}${p.clutch ? ` of ${p.clutch}` : ''} eggs good`,
      sm.sinceChecked !== null && (sm.sinceChecked === 0 ? 'checked today' : `last checked ${sm.sinceChecked} day${sm.sinceChecked === 1 ? '' : 's'} ago`)].filter(Boolean).join(' · ')}</Text>
    {sm.offTarget > 0 && <Text style={{ color: C.bad, marginTop: 2 }}>{sm.offTarget} reading{sm.offTarget === 1 ? '' : 's'} more than 1 °C from the target</Text>}
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ flex: 2 }}><Input label="Incubator" value={p.incubator ?? ''} onChangeText={v => setP({ ...p, incubator: v })} onBlur={() => saveSetup({ incubator: p.incubator?.trim() || null })} placeholder="e.g. Top shelf" /></View>
      <View style={{ flex: 1 }}><Input label="Target °C" keyboardType="decimal-pad" value={target} onChangeText={setTarget}
        onBlur={() => { const v = parse(target); if (v !== null && (isNaN(v) || v < 0 || v > 60)) return notify('Check the target', 'Enter it in °C, e.g. 31.5.'); saveSetup({ target_temp: v }); }} /></View>
    </View>
    <Text style={[s.h, { marginTop: 14, fontSize: 16 }]}>Add a reading</Text>
    <DateField label="Date" value={day} onChange={v => setDay(v || today())} />
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ flex: 1 }}><Input label="Temp °C" keyboardType="decimal-pad" value={temp} onChangeText={setTemp} /></View>
      <View style={{ flex: 1 }}><Input label="Humidity %" keyboardType="decimal-pad" value={hum} onChangeText={setHum} /></View>
      <View style={{ flex: 1 }}><Input label="Good eggs" keyboardType="number-pad" value={eggs} onChangeText={setEggs} /></View>
    </View>
    <Input label="Note" value={note} onChangeText={setNote} placeholder="e.g. candled, 1 slug removed" />
    <View style={{ marginTop: 10 }}><Btn solid t="+ Add reading" onPress={add} /></View>
    {readings.length > 0 && <Text style={[s.mu, { marginTop: 12 }]}>Tap a reading to delete it.</Text>}
    {shown.map(r => <Pressable key={r.id} onPress={() => del(r)} accessibilityRole="button" style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.bd }}>
      <Text style={{ color: offTarget(r, p.target_temp) ? C.bad : C.ink }}>{fmt(r.on_date)} · {readingText(r)}</Text></Pressable>)}
    {readings.length > 8 && <View style={{ marginTop: 8 }}><Btn t={all ? 'Show fewer' : `Show all ${readings.length}`} onPress={() => setAll(!all)} /></View>}
  </View>);
}
