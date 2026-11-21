import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlatList, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Animal, FALLBACK, Season, isPaused, nextFeed, seasonFor, today, diffDays, fmt } from '../../lib/logic';
import { Btn, Card, notify, s } from '../../lib/ui';
import { enablePush, pushEnabledHere, pushSupported } from '../../lib/notifications';

const PROMPT_KEY = 'clutchly.pushPromptDismissed';
export default function Today() {
  const [rows, setRows] = useState<Animal[]>([]); const [cfg, setCfg] = useState<Season[] | null>(null); const r = useRouter();
  const [askPush, setAskPush] = useState(false);
  const load = useCallback(async () => {
    const [a, c] = await Promise.all([supabase.from('animal_status').select('*').neq('status', 'Sold'), supabase.from('season_settings').select('*')]);
    if (a.error || c.error) notify('Could not load', (a.error || c.error)!.message);
    setRows((a.data as Animal[]) || []); setCfg((c.data as Season[]) || []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  // Offer reminders once the user has animals (not on first launch), until they turn them on or say no.
  useFocusEffect(useCallback(() => { (async () => {
    if (!pushSupported) return;
    const dismissed = await AsyncStorage.getItem(PROMPT_KEY).catch(() => null);
    setAskPush(!dismissed && !(await pushEnabledHere()));
  })(); }, []));
  const dismissPush = () => { setAskPush(false); AsyncStorage.setItem(PROMPT_KEY, '1').catch(() => {}); };
  const turnOnPush = async () => { const res = await enablePush(); if (!res.ok) return notify('Notifications not turned on', res.reason); dismissPush(); notify('Notifications on', 'Change what you get and when in Account.'); };
  const t = today();
  const due = rows.map(a => ({ a, sc: seasonFor(cfg || [], a.species) })).filter(({ sc }) => !isPaused(sc, t))
    .map(({ a, sc }) => ({ a, n: nextFeed(a, sc) }))
    .filter(x => diffDays(x.n, t) <= 3).sort((x, y) => x.n.localeCompare(y.n) || x.a.name.localeCompare(y.a.name));
  const log = async (id: string, ok: boolean) => {
    const { error } = await supabase.from('events').insert({ animal_id: id, kind: 'feed', ok, on_date: t });
    if (error) notify('Error', error.message); load();
  };
  return (<View style={s.page}><FlatList data={due} keyExtractor={x => x.a.id}
    ListHeaderComponent={<>
      {cfg && cfg.length === 0 ? <Card onPress={() => r.navigate('/settings')}>
        <Text style={s.h}>Set up your routine</Text>
        <Text style={s.mu}>Add your feeding pause, pairing dates and feed intervals for each species on the Season tab. Until then, feeds are due every {FALLBACK.female_every} days for females and {FALLBACK.male_every} for males. Tap to start.</Text></Card> : null}
      {askPush && rows.length > 0 ? <Card>
        <Text style={s.h}>Morning reminders?</Text>
        <Text style={s.mu}>Get one notification a morning with how many animals are due, and a heads-up before lays and pairing season.</Text>
        <View style={[s.row, { marginTop: 8 }]}><Btn solid t="Turn on" onPress={turnOnPush} /><Btn t="Not now" onPress={dismissPush} /></View></Card> : null}
    </>}
    ListEmptyComponent={<Text style={s.mu}>{rows.length ? 'Nothing due in the next 3 days.' : 'No animals yet. Add some on the Animals tab.'}</Text>}
    renderItem={({ item: { a, n } }) => (<Card onPress={() => r.push(`/animal/${a.id}`)}><View style={s.row}>
      <View style={{ flex: 1 }}><Text style={s.h}>{a.name}</Text>
        <Text style={s.mu}>{a.species} · {a.sex} · {n <= t ? (n < t ? `${diffDays(t, n)}d overdue` : 'due today') : `due ${fmt(n)}`}</Text></View>
      <Btn solid t="Fed" onPress={() => log(a.id, true)} /><Btn t="Refused" onPress={() => log(a.id, false)} /></View></Card>)} /></View>);
}
