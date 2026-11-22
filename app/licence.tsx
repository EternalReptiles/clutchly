// Account > Wildlife licence: saved once, offered (never sent automatically) when handing an animal over.
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Btn, Chips, DateField, Input, Label, notify, s } from '../lib/ui';
import { REGIONS, getLicence, saveLicence, type Licence } from '../lib/transfers';

export default function LicenceScreen() {
  const r = useRouter(); const [l, setL] = useState<Licence | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { getLicence().then(x => setL(x ?? {}), e => { notify('Could not load', e.message); setL({}); }); }, []);
  if (!l) return <View style={s.page}><Text style={s.mu}>Loading…</Text></View>;
  const set = (k: keyof Licence) => (v: string | null) => setL({ ...l, [k]: v });
  const save = async () => {
    setBusy(true);
    const clean = Object.fromEntries(Object.entries(l).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v])) as Licence;
    try { await saveLicence(clean); r.back(); } catch (e: any) { notify('Could not save', e.message); setBusy(false); }
  };
  return (<ScrollView style={s.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <Text style={s.mu}>Save your wildlife licence once. Every handover swaps your full name, licence number and address with the other person's (and state, class, expiry and phone if you add them), so neither of you has to find and send them. They're only shared with the person in that handover.</Text>
    <Text style={[s.mu, { marginTop: 6 }]}>Full name, licence number and address are needed to hand an animal over or accept one.</Text>
    <Input label="Full name (as on the licence)" value={l.full_name ?? ''} onChangeText={set('full_name')} autoComplete="name" textContentType="name" />
    <Input label="Licence number" value={l.licence_no ?? ''} onChangeText={set('licence_no')} autoCapitalize="characters" autoCorrect={false} />
    <Label t="State or territory" /><Chips opts={REGIONS} v={l.region ?? ''} on={v => set('region')(l.region === v ? null : v)} />
    <Input label="Licence class or type (optional)" value={l.licence_class ?? ''} onChangeText={set('licence_class')} placeholder="e.g. Recreational wildlife licence" />
    <DateField optional label="Expiry date (optional)" value={l.expires ?? null} onChange={set('expires')} />
    <Input label="Address" multiline value={l.address ?? ''} onChangeText={set('address')} autoComplete="street-address" textContentType="fullStreetAddress" placeholder="Street, suburb, state, postcode" />
    <Input label="Phone (optional)" keyboardType="phone-pad" value={l.phone ?? ''} onChangeText={set('phone')} autoComplete="tel" textContentType="telephoneNumber" />
    <View style={{ marginTop: 14 }}><Btn solid disabled={busy} t={busy ? 'Saving…' : 'Save'} onPress={save} /></View>
    <Text style={[s.mu, { marginTop: 10 }]}>Check what your state requires you to record when you buy or sell an animal; this helps you keep it, but your licence conditions still apply.</Text>
    <View style={{ height: 60 }} /></ScrollView>);
}
