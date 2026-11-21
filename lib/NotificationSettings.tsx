import { useCallback, useEffect, useState } from 'react';
import { APP_NAME } from './brand';
import { Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from './supabase';
import { deviceTimeZone, disablePushHere, enablePush, pushEnabledHere, pushSupported } from './notifications';
import { fmtHour } from './logic';
import { usePlan } from './plan';
import { goPro } from './goPro';
import { Btn, C, Card, Input, notify, s } from './ui';

type NS = { feed_due: boolean; lay_soon: boolean; pairing_soon: boolean; notify_hour: number; timezone: string };
const DEFAULTS: Omit<NS, 'timezone'> = { feed_due: true, lay_soon: true, pairing_soon: true, notify_hour: 7 };
const validZone = (z: string) => { try { new Intl.DateTimeFormat('en', { timeZone: z }); return true; } catch { return false; } };

/** Notifications card on the Account screen. Settings apply to all of the user's phones; on/off is per phone. */
export function NotificationSettings() {
  const [ns, setNs] = useState<NS | null>(null); const [here, setHere] = useState(false); const [busy, setBusy] = useState(false);
  const [zone, setZone] = useState('');
  const load = useCallback(async () => {
    const { data } = await supabase.from('notification_settings').select('feed_due,lay_soon,pairing_soon,notify_hour,timezone').maybeSingle();
    const v = (data as NS) ?? { ...DEFAULTS, timezone: deviceTimeZone() }; setNs(v); setZone(v.timezone);
    setHere(await pushEnabledHere());
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { if (ns) setZone(ns.timezone); }, [ns?.timezone]);

  const save = async (patch: Partial<NS>) => {
    const next = { ...(ns ?? { ...DEFAULTS, timezone: deviceTimeZone() }), ...patch }; setNs(next);
    const { error } = await supabase.from('notification_settings').upsert({ ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) { notify('Could not save', error.message); load(); }
  };
  const plan = usePlan();
  const turnOn = async () => { if (!plan.isPro) return goPro('Morning notifications are part of Pro.'); setBusy(true); const r = await enablePush(); setBusy(false);
    if (!r.ok) return notify('Notifications not turned on', r.reason);
    setHere(true); load(); notify('Notifications on', `You'll get a summary at ${fmtHour(ns?.notify_hour ?? 7)} when something is due.`); };
  const turnOff = async () => { setBusy(true); await disablePushHere(); setBusy(false); setHere(false); };
  const commitZone = () => { const z = zone.trim();
    if (!z || z === ns?.timezone) return;
    if (!validZone(z)) { notify('Unknown timezone', 'Use a name like Australia/Sydney or America/New_York.'); setZone(ns?.timezone ?? ''); return; }
    save({ timezone: z }); };

  if (!ns) return null;
  const phoneZone = deviceTimeZone();
  const row = (k: 'feed_due' | 'lay_soon' | 'pairing_soon', label: string, sub: string) => (
    <View style={[s.row, { marginTop: 10 }]}><View style={{ flex: 1 }}><Text style={{ color: C.ink }}>{label}</Text><Text style={s.mu}>{sub}</Text></View>
      <Switch value={ns[k]} onValueChange={v => save({ [k]: v })} accessibilityLabel={label}
        trackColor={{ true: C.ink, false: C.bd }} thumbColor={C.card} ios_backgroundColor={C.bd} /></View>);
  return (<Card><Text style={s.h}>Notifications</Text>
    {pushSupported
      ? here
        ? <View style={[s.row, { marginTop: 6 }]}><Text style={[s.mu, { flex: 1 }]}>On for this phone.</Text><Btn disabled={busy} t="Turn off for this phone" onPress={turnOff} /></View>
        : <><Text style={[s.mu, { marginTop: 4 }]}>One message a morning when something is due: feeds, lays coming up, and pairing season. Nothing is sent on days with nothing due.</Text>
          <View style={{ marginTop: 8 }}><Btn solid disabled={busy} t={busy ? 'Turning on…' : 'Turn on notifications'} onPress={turnOn} /></View></>
      : <Text style={[s.mu, { marginTop: 4 }]}>Notifications are sent to the {APP_NAME} phone app. These settings apply to all your phones.</Text>}
    {row('feed_due', 'Feeds due today', 'How many animals are due, skipping species in their feeding pause')}
    {row('lay_soon', 'Lay or birth coming up', '7 days before the estimated date')}
    {row('pairing_soon', 'Pairing season', "3 days before a species' pairing start")}
    <Text style={[s.mu, { marginTop: 12 }]}>Send at</Text>
    <View style={[s.row, { marginTop: 4 }]}>
      <Btn t="−" onPress={() => save({ notify_hour: (ns.notify_hour + 23) % 24 })} />
      <Text style={[s.h, { minWidth: 90, textAlign: 'center' }]} accessibilityLabel="Notification time">{fmtHour(ns.notify_hour)}</Text>
      <Btn t="+" onPress={() => save({ notify_hour: (ns.notify_hour + 1) % 24 })} /></View>
    <Input label="Timezone" value={zone} onChangeText={setZone} onBlur={commitZone} onSubmitEditing={commitZone} autoCapitalize="none" autoCorrect={false} />
    {ns.timezone !== phoneZone && <View style={{ marginTop: 6 }}><Btn t={`Use this phone's timezone (${phoneZone})`} onPress={() => save({ timezone: phoneZone })} /></View>}
  </Card>);
}
