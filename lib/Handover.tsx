// On an animal's page: where it came from (if it arrived by handover), and making a link that hands it over to its
// buyer: share it, cancel it, and afterwards the buyer's details if they shared their licence.
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fmt } from './logic';
import { syncFresh } from './store';
import { Btn, C, Check, Input, confirm, notify, s } from './ui';
import { FROM_KEY, SWAP_TEXT, cancelTransfer, claimLink, createTransfer, getLicence, handoversOf, licenceComplete, licenceLines, shareLink, showCode, type Licence, type Transfer } from './transfers';

const Details = ({ l }: { l: Licence }) => <View style={{ marginTop: 4 }}>{licenceLines(l).map((x, i) => <Text key={i} selectable style={{ color: C.ink }}>{x}</Text>)}</View>;

export function Handover({ animalId, name, onAccepted }: { animalId: string; name: string; onAccepted: () => void }) {
  const r = useRouter();
  const [h, setH] = useState<{ out: Transfer | null; in: Transfer | null } | undefined>(undefined); // undefined: not loaded / offline
  const [open, setOpen] = useState(false); const [from, setFrom] = useState(''); const [notes, setNotes] = useState(false);
  const [lic, setLic] = useState<Licence | null>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const x = await handoversOf(animalId).catch(() => undefined); setH(x);
    if (x?.out?.accepted_at) { onAccepted(); syncFresh(); }
    return x;
  }, [animalId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); AsyncStorage.getItem(FROM_KEY).then(v => v && setFrom(v), () => {}); }, [load]);
  const t = h?.out; const live = t && !t.accepted_at && t.expires_at > new Date().toISOString() ? t : null;

  const start = async () => {
    if (h === undefined && !(await load())) return notify('No connection', 'Handovers need the internet; try again when you\'re online.');
    setLic(await getLicence().catch(() => null)); setOpen(true);
  };
  const create = async () => {
    setBusy(true);
    try {
      await createTransfer(animalId, from.trim(), notes); AsyncStorage.setItem(FROM_KEY, from.trim()).catch(() => {});
      setOpen(false); await load();
    } catch (e: any) { notify('Could not make the link', e.message); }
    setBusy(false);
  };
  const share = async (code: string) => { if (await shareLink(name, code) === 'copied') notify('Link copied', 'Paste it into a message to the buyer.'); };
  const cancel = (code: string) => confirm('Cancel this link?', 'The buyer won\'t be able to use it. You can make a new one later.', 'Cancel link',
    async () => { try { await cancelTransfer(code); await load(); } catch (e: any) { notify('Could not cancel', e.message); } });

  return (<>
    {h?.in && <View style={[s.card, { marginTop: 14 }]} accessibilityLabel="Where it came from">
      <Text style={s.h}>Received</Text>
      <Text style={{ color: C.ink, marginTop: 4 }}>From {h.in.seller_licence?.full_name || h.in.from_name || 'a breeder'} on {fmt(h.in.accepted_at!.slice(0, 10))}.</Text>
      {h.in.seller_licence ? <Details l={h.in.seller_licence} /> : <Text style={s.mu}>No seller licence details on this handover (made before they were required).</Text>}
    </View>}
    <View style={[s.card, { marginTop: 14 }]} accessibilityLabel="Hand over to buyer">
    <Text style={s.h}>Hand over to buyer</Text>
    {t?.accepted_at ? <>
        <Text style={{ color: C.ink, marginTop: 4 }}>Handed over on {fmt(t.accepted_at.slice(0, 10))}. The buyer has their own copy; this one is marked Sold.</Text>
        {t.buyer_licence ? <><Text style={[s.mu, { marginTop: 6 }]}>Buyer</Text><Details l={t.buyer_licence} /></>
          : <Text style={s.mu}>No buyer licence details on this handover (made before they were required).</Text>}</>
      : live ? <>
        <Text style={s.mu}>Waiting for the buyer. Send them this link{live.from_name ? ` (signed "${live.from_name}")` : ''}. It works once and expires {fmt(live.expires_at.slice(0, 10))}. When they accept, you swap names, licence numbers and addresses.</Text>
        <Text selectable style={{ color: C.ink, fontWeight: '700', fontSize: 20, marginTop: 8, letterSpacing: 1 }} accessibilityLabel={`Handover code ${showCode(live.code)}`}>{showCode(live.code)}</Text>
        <Text selectable style={[s.mu, { marginTop: 2 }]}>{claimLink(live.code)}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <Btn solid t="Share link" onPress={() => share(live.code)} /><Btn t="Cancel link" onPress={() => cancel(live.code)} /></View></>
      : !open ? <>
        <Text style={s.mu}>Sold {name}? Send the buyer a link and they get their own copy with its feeding, shed and weight history and its genes, free. It's marked Sold here when they accept.</Text>
        <View style={{ marginTop: 10 }}><Btn t="Make a handover link" onPress={start} /></View></>
      : <>
        {!licenceComplete(lic) ? <>
          <Text style={{ color: C.ink, marginTop: 6 }}>First, add your full name, wildlife licence number and address. {SWAP_TEXT}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Btn solid t="Add my licence details" onPress={() => { setOpen(false); r.push('/licence'); }} /><Btn t="Not now" onPress={() => setOpen(false)} /></View></>
        : <>
          <Input label="Your name or business (shown to the buyer)" value={from} onChangeText={setFrom} placeholder="e.g. your business name" />
          <Check on={notes} set={setNotes} t="Include my notes (otherwise only the records are sent)" />
          <Text style={[s.mu, { marginTop: 8 }]}>{SWAP_TEXT} Yours: {lic!.full_name}, licence {lic!.licence_no}. Photos aren't included.</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Btn solid disabled={busy} t={busy ? 'Making link…' : 'Make link'} onPress={create} /><Btn t="Not now" onPress={() => setOpen(false)} /></View></>}</>}
    </View></>);
}
