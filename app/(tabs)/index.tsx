import { useCallback, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { FALLBACK, today, diffDays, fmt, fmtDay } from '../../lib/logic';
import { speciesInfo, words } from '../../lib/species';
import { overview } from '../../lib/overview';
import { EmptyState, Greeting, Loading } from '../../lib/Brand';
import { useCollection } from '../../lib/derived';
import { useMorphs } from '../../lib/useGenes';
import { insert, sync } from '../../lib/store';
import { Btn, C, Card, notify, s } from '../../lib/ui';
import { enablePush, pushEnabledHere, pushSupported } from '../../lib/notifications';
import { usePlan } from '../../lib/plan';
import { goPro } from '../../lib/goPro';
import { PENDING_KEY, awaitingApproval, type Transfer } from '../../lib/transfers';
import { PENDING_ANIMAL_KEY } from '../../lib/labels';

const PROMPT_KEY = 'clutchly.pushPromptDismissed';
export default function Overview() {
  const r = useRouter(); const { ready, animals, seasons, events, pairings } = useCollection();
  const rows = animals.filter(a => a.status !== 'Sold'); const cfg = ready ? seasons : null;
  const [askPush, setAskPush] = useState(false); const [requests, setRequests] = useState<Transfer[]>([]); const plan = usePlan(); const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => { setRefreshing(true); await sync(); setRefreshing(false); };
  // Offer reminders once the user has animals (not on first launch), until they turn them on or say no.
  // Handovers waiting for this seller's approval (online only; nothing shows offline).
  useFocusEffect(useCallback(() => { awaitingApproval().then(setRequests, () => {}); }, []));
  useFocusEffect(useCallback(() => { (async () => {
    // Someone opened a handover link before signing in: take them back to it.
    const claim = await AsyncStorage.getItem(PENDING_KEY).catch(() => null);
    if (claim) { await AsyncStorage.removeItem(PENDING_KEY).catch(() => {}); r.push(`/claim/${claim}`); return; }
    // ...or a label's link: open that animal.
    const animal = await AsyncStorage.getItem(PENDING_ANIMAL_KEY).catch(() => null);
    if (animal) { await AsyncStorage.removeItem(PENDING_ANIMAL_KEY).catch(() => {}); r.push(`/animal/${animal}`); return; }
    if (!pushSupported) return;
    const dismissed = await AsyncStorage.getItem(PROMPT_KEY).catch(() => null);
    setAskPush(!dismissed && !(await pushEnabledHere()));
  })(); }, []));
  const dismissPush = () => { setAskPush(false); AsyncStorage.setItem(PROMPT_KEY, '1').catch(() => {}); };
  const turnOnPush = async () => { if (!plan.isPro) return goPro('Morning notifications are part of Pro.'); const res = await enablePush(); if (!res.ok) return notify('Notifications not turned on', res.reason); dismissPush(); notify('Notifications on', 'Change what you get and when in Account.'); };
  const t = today();
  const morphs = useMorphs();   // genes under each name, to tell look-alike animals apart
  const o = useMemo(() => overview(animals, events, pairings, cfg || [], t), [animals, events, pairings, cfg, t]);
  const log = (id: string, ok: boolean) => { insert('events', { animal_id: id, kind: 'feed', ok, on_date: t }); };
  if (!ready) return <Loading />;
  const go = (x: { animalId?: string; pairingId?: string }) => x.animalId ? r.push(`/animal/${x.animalId}`) : x.pairingId ? r.push(`/pairing/${x.pairingId}`) : null;
  const pairName = (f?: { name: string }, m?: { name: string }) => `${f?.name ?? '?'}${m ? ` × ${m.name}` : ''}`;
  const empty = !rows.length;
  return (<ScrollView style={s.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.ink} />}>
    <Greeting />
    {cfg && cfg.length === 0 ? <Card onPress={() => r.navigate('/settings')}>
      <Text style={s.h}>Set up your routine</Text>
      <Text style={s.mu}>Add your feeding pause, pairing dates and feed intervals for each species on the Season tab. Until then, feeds are due every {FALLBACK.female_every} days for females and {FALLBACK.male_every} for males. Tap to start.</Text></Card> : null}
    {requests.map(t => <Card key={t.code} onPress={() => t.animal_id && r.push(`/animal/${t.animal_id}`)}>
      <Text style={s.h}>Handover waiting for you</Text>
      <Text style={{ color: C.ink }}>{t.buyer_licence?.full_name ?? 'A buyer'} has asked for {t.animal_name ?? 'an animal'}. Tap to check their details and approve.</Text></Card>)}
    {askPush && rows.length > 0 ? <Card>
      <Text style={s.h}>Morning reminders?</Text>
      <Text style={s.mu}>Get one notification a morning with how many animals are due, and a heads-up before lays and pairing season.</Text>
      <View style={[s.row, { marginTop: 8 }]}><Btn solid t="Turn on" onPress={turnOnPush} /><Btn t="Not now" onPress={dismissPush} /></View></Card> : null}
    {empty ? <EmptyState title="Welcome to your collection" text="No animals yet. Add some on the Animals tab.">
      <Btn solid t="Add your first animal" onPress={() => r.push('/animal/new')} /></EmptyState> : <>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
        <Stat n={o.dueNow.length} l={o.dueNow.length === 1 ? "feed due" : "feeds due"} /><Stat n={o.week.feeds} l="feeds this week" />
        <Stat n={o.week.lays} l={o.week.lays === 1 ? 'lay due' : 'lays due'} /><Stat n={o.week.hatches} l={o.week.hatches === 1 ? 'hatch due' : 'hatches due'} />
      </View>

      <View style={[s.row, { marginTop: 16, marginBottom: 4 }]}><Text style={[s.h, { flex: 1 }]} accessibilityRole="header">Feeds due now</Text>
        <Btn t={o.dueNow.length > 1 ? `Feed all ${o.dueNow.length}` : 'Feed several'} onPress={() => r.push(o.dueNow.length ? '/feed?pre=due' : '/feed')} /></View>
      {o.dueNow.length ? o.dueNow.map(({ a, due }) => <Card key={a.id} onPress={() => r.push(`/animal/${a.id}`)}><View style={s.row}>
        <View style={{ flex: 1 }}><Text style={s.h}>{a.name}</Text>
          {morphs[a.id] ? <Text style={{ color: C.ink }}>{morphs[a.id]}</Text> : null}
          <Text style={s.mu}>{a.species} · {a.sex} · {due < t ? `${diffDays(t, due)}d overdue` : 'due today'}</Text></View>
        <Btn solid t="Fed" onPress={() => log(a.id, true)} /><Btn t="Refused" onPress={() => log(a.id, false)} /></View></Card>)
        : <Text style={s.mu}>Nothing due today.</Text>}
      {o.held.length > 0 && <Text style={[s.mu, { marginTop: 4 }]} accessibilityLabel="Feeds paused">Paused: {o.held.map(({ a, hold }) =>
        `${a.name} (${hold.kind === 'shed' ? 'in shed' : `in with ${hold.with ?? 'its mate'}`})`).join(', ')}</Text>}

      {o.attention.length > 0 && <><Section t="Needs a look" />
        <Card>{o.attention.map((x, i) => <Pressable key={i} onPress={() => go(x)} accessibilityRole="button" style={{ paddingVertical: 4 }}>
          <Text style={{ color: C.bad }}>{x.text}</Text></Pressable>)}</Card></>}

      <Section t="Next 7 days" />
      <Card>{o.days.map(d => <View key={d.date} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.bd }}>
        <Text style={{ fontWeight: '700', color: C.ink }}>{fmtDay(d.date)}</Text>
        {!d.items.length && <Text style={s.mu}>Nothing planned</Text>}
        {d.items.map((it, i) => it.kind === 'feed'
          ? <Text key={i} style={{ color: C.ink }}>{`Feed (${it.animals.length}): ${it.animals.map(a => a.name).join(', ')}`}</Text>
          : it.kind === 'season' ? <Text key={i} style={{ color: C.ink }}>{it.text}</Text>
            : <Pressable key={i} onPress={() => go({ pairingId: it.pairing.id })} accessibilityRole="button">
              <Text style={{ color: C.ink }}>{`${pairName(it.female, it.male)}: ${it.kind === 'hatch' ? 'estimated hatch' : it.kind === 'prelay' ? 'pre-lay shed expected' : words(speciesInfo(it.female?.species).repro).est}`}</Text></Pressable>)}
      </View>)}</Card>
      {o.later.map(x => <Text key={x.text} style={[s.mu, { marginTop: 4 }]}>{x.text} on {fmt(x.date)} (in {diffDays(x.date, t)} days)</Text>)}

      <Section t="Last 7 days" />
      <Text style={s.mu}>{`${o.last7.fed} fed · ${o.last7.refused} refused · ${o.last7.sheds} ${o.last7.sheds === 1 ? 'shed' : 'sheds'} · ${o.last7.weights} ${o.last7.weights === 1 ? 'weight' : 'weights'}`}</Text>
    </>}
    <View style={{ height: 40 }} />
  </ScrollView>);
}

const Section = ({ t }: { t: string }) => <Text style={[s.h, { marginTop: 16, marginBottom: 4 }]} accessibilityRole="header">{t}</Text>;
function Stat({ n, l }: { n: number; l: string }) {
  return (<View style={{ flex: 1, borderWidth: 1, borderColor: C.bd, borderRadius: 10, backgroundColor: C.card, padding: 8 }} accessibilityLabel={`${n} ${l}`}>
    <Text style={{ fontSize: 22, fontWeight: '700', color: C.ink }}>{n}</Text><Text style={[s.mu, { fontSize: 12 }]}>{l}</Text></View>);
}
