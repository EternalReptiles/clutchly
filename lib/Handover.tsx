// On an animal's page: where it came from (if it arrived by handover), and handing it over to its buyer: make a link,
// share or cancel it, approve or decline the buyer's request, and afterwards the buyer's details.
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fmt } from './logic';
import { syncFresh } from './store';
import { Btn, C, Check, Input, confirm, notify, s } from './ui';
import { FROM_KEY, SWAP_TEXT, approveTransfer, cancelTransfer, claimLink, createTransfer, declineTransfer, getLicence, handoversOf, licenceComplete, licenceLines,
  shareLink, showCode, type Licence, type Transfer } from './transfers';

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
  const share = async (code: string) => {
    const r2 = await shareLink(name, code);
    if (r2 === 'copied') notify('Link copied', 'Paste it into a message to the buyer.');
    else if (r2 === 'failed') notify('Couldn\'t share the link', 'Copy the link shown on the card instead, or tell the buyer the code.');
  };
  const approve = async (t2: Transfer) => {
    setBusy(true);
    try {
      const x = await approveTransfer(t2.code); await load();
      notify('Handed over', `${name} is in ${t2.buyer_licence?.full_name ?? 'the buyer'}'s collection${x.photos ? ` with ${x.photos} photo${x.photos === 1 ? '' : 's'}` : ''}, and it's marked Sold here.`
        + (x.photos_failed ? ` ${x.photos_failed} photo${x.photos_failed === 1 ? '' : 's'} couldn't be copied.` : ''));
    } catch (e: any) { notify('Couldn\'t hand it over', e.message); }
    setBusy(false);
  };
  const decline = (t2: Transfer) => confirm('Decline this request?', `${t2.buyer_licence?.full_name ?? 'They'} won't get ${name}. The link works again for someone else, or you can cancel it.`, 'Decline',
    async () => { try { await declineTransfer(t2.code); await load(); } catch (e: any) { notify('Couldn\'t decline', e.message); } });
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
      : live?.requested_by ? <>
        <Text style={{ color: C.ink, marginTop: 4, fontWeight: '700' }}>{live.buyer_licence?.full_name ?? 'Someone'} has asked for {name}</Text>
        <Text style={s.mu}>Check this is your buyer before approving. Approving gives them their own copy with its records and photos, sends them your licence details, and marks {name} Sold here.</Text>
        {live.buyer_licence && <Details l={live.buyer_licence} />}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <Btn solid disabled={busy} t={busy ? 'Handing over…' : 'Approve'} onPress={() => approve(live)} /><Btn disabled={busy} t="Decline" onPress={() => decline(live)} /></View></>
      : live ? <>
        <Text style={s.mu}>Waiting for the buyer. Send them this link{live.from_name ? ` (signed "${live.from_name}")` : ''}. It works once and expires {fmt(live.expires_at.slice(0, 10))}. When they ask for it, you'll see their name, licence and address here to approve.</Text>
        <Text selectable style={{ color: C.ink, fontWeight: '700', fontSize: 20, marginTop: 8, letterSpacing: 1 }} accessibilityLabel={`Handover code ${showCode(live.code)}`}>{showCode(live.code)}</Text>
        <Text selectable style={[s.mu, { marginTop: 2 }]}>{claimLink(live.code)}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <Btn solid t="Share link" onPress={() => share(live.code)} /><Btn t="Cancel link" onPress={() => cancel(live.code)} /></View></>
      : !open ? <>
        <Text style={s.mu}>Sold {name}? Send the buyer a link: they ask for it, you approve, and they get their own copy with its feeding, shed and weight history, genes and photos, free. It's then marked Sold here.</Text>
        <View style={{ marginTop: 10 }}><Btn t="Make a handover link" onPress={start} /></View></>
      : <>
        {!licenceComplete(lic) ? <>
          <Text style={{ color: C.ink, marginTop: 6 }}>First, add your full name, wildlife licence number and address. {SWAP_TEXT}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Btn solid t="Add my licence details" onPress={() => { setOpen(false); r.push('/licence'); }} /><Btn t="Not now" onPress={() => setOpen(false)} /></View></>
        : <>
          <Input label="Your name or business (shown to the buyer)" value={from} onChangeText={setFrom} placeholder="e.g. your business name" />
          <Check on={notes} set={setNotes} t="Include my notes (otherwise only the records are sent)" />
          <Text style={[s.mu, { marginTop: 8 }]}>{SWAP_TEXT} Yours: {lic!.full_name}, licence {lic!.licence_no}.</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Btn solid disabled={busy} t={busy ? 'Making link…' : 'Make link'} onPress={create} /><Btn t="Not now" onPress={() => setOpen(false)} /></View></>}</>}
    </View></>);
}
