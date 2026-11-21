import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { APP_NAME } from '../lib/brand';
import { fmtMD } from '../lib/logic';
import { SpeciesPicker } from '../lib/SpeciesPicker';
import { deviceTimeZone } from '../lib/notifications';
import { getState, saveSeason } from '../lib/store';
import { guessHemisphere, seasonFromTemplate, type Hemisphere, type Template } from '../lib/templates';
import { useTemplates } from '../lib/useTemplates';
import { Btn, C, Card, Chips, s } from '../lib/ui';

export const onboardedKey = (uid: string) => `clutchly.onboarded.${uid}`;
const HEMIS: [Hemisphere, string][] = [['south', 'Southern'], ['north', 'Northern']];

/** First-run setup: hemisphere and species kept; applies the matching templates to the user's own routine. */
export default function Welcome() {
  const r = useRouter(); const templates = useTemplates();
  const [hemi, setHemi] = useState<Hemisphere>(guessHemisphere(deviceTimeZone()));
  const [picked, setPicked] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  const byName = useMemo(() => new Map((templates ?? []).map(t => [t.species, t])), [templates]);
  const toggle = (sp: string) => setPicked(p => p.includes(sp) ? p.filter(x => x !== sp) : [...p, sp]);

  const finish = async (apply: boolean) => {
    setBusy(true);
    const { uid, season_settings } = getState();
    if (apply) for (const sp of picked) {
      const t = byName.get(sp);
      if (t && !season_settings.some(s0 => s0.species === sp)) saveSeason(seasonFromTemplate(t, hemi)); // never overwrite a routine already set
    }
    if (uid) await AsyncStorage.setItem(onboardedKey(uid), '1').catch(() => {});
    await supabase.auth.updateUser({ data: { onboarded: true, hemisphere: hemi } }).catch(() => {});
    setBusy(false); r.replace('/');
  };

  return (<ScrollView style={s.page} keyboardShouldPersistTaps="handled">
    <Stack.Screen options={{ title: 'Welcome', headerBackVisible: false, gestureEnabled: false }} />
    <Text style={[s.h, { fontSize: 24 }]}>Welcome to {APP_NAME}</Text>
    <Text style={{ color: C.ink, marginTop: 6 }}>Two quick questions so your feeding and breeding seasons start in the right place. You can change everything later on the Season tab.</Text>

    <Text style={[s.h, { marginTop: 18 }]}>Which hemisphere are you in?</Text>
    <Text style={s.mu}>Seasons are six months apart, so this shifts every starting date.</Text>
    <Chips opts={HEMIS.map(h => h[1])} v={HEMIS.find(h => h[0] === hemi)![1]} on={l => setHemi(HEMIS.find(h => h[1] === l)![0])} />

    <Text style={[s.h, { marginTop: 18 }]}>Which species do you keep?</Text>
    {templates === null ? <Text style={s.mu}>Loading starting values…</Text>
      : templates.length === 0 ? <Text style={s.mu}>Starting values can't be loaded right now (no connection). Skip for now and set your routine on the Season tab.</Text>
      : <Chips opts={[...templates.map(t => t.species), ...picked.filter(p => !byName.has(p))]} v={picked} on={toggle} />}
    {picked.length > 0 && <Text style={[s.mu, { marginTop: 4 }]}>Tap a species again to remove it.</Text>}
    <SpeciesPicker label="Other species" value={null} exclude={picked} onChange={toggle} />

    {picked.map(sp => { const t = byName.get(sp); return (<Card key={sp}>
      <Text style={s.h}>{sp}</Text>
      {t ? <TemplateSummary t={t} hemi={hemi} /> : <Text style={s.mu}>No starting values for this species yet. Set your own on the Season tab.</Text>}
    </Card>); })}
    {picked.some(sp => byName.has(sp)) && <Text style={[s.mu, { marginTop: 6 }]}>These are starting points from an experienced breeder's routine. Adjust them to your own experience; your changes stay private and never alter the shared starting values.</Text>}

    <View style={{ gap: 8, marginTop: 16 }}>
      <Btn solid disabled={busy} t={picked.some(sp => byName.has(sp)) ? 'Use these starting values' : 'Continue'} onPress={() => finish(true)} />
      <Btn disabled={busy} t="Skip for now" onPress={() => finish(false)} /></View>
    <View style={{ height: 60 }} /></ScrollView>);
}

export function TemplateSummary({ t, hemi }: { t: Template; hemi: Hemisphere }) {
  const v = seasonFromTemplate(t, hemi);
  const lines = [
    v.pause_from && v.pause_to ? `Feeding pause ${fmtMD(v.pause_from)} – ${fmtMD(v.pause_to)}` : null,
    v.pair_start ? `Pairing from ${fmtMD(v.pair_start)}` : 'Pairing date: set your own',
    `Feed males every ${v.male_every ?? '–'} days, females every ${v.female_every ?? '–'}`,
    `Lay about ${v.prelay_to_lay ?? '–'} days after the pre-lay shed (${v.ovul_to_lay ?? '–'} after ovulation), hatch about ${v.lay_to_hatch ?? '–'} days after laying`,
  ].filter(Boolean);
  return (<>{lines.map(l => <Text key={l} style={{ color: C.ink, marginTop: 2 }}>{l}</Text>)}
    {t.notes ? <Text style={[s.mu, { marginTop: 4 }]}>{t.notes}</Text> : null}</>);
}
