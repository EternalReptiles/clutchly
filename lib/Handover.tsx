// On an animal's page: make a link that hands the animal (and its records) over to its buyer, share it, or cancel it.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fmt } from './logic';
import { syncFresh } from './store';
import { Btn, C, Input, confirm, notify, s } from './ui';
import { FROM_KEY, cancelTransfer, claimLink, createTransfer, latestTransfer, shareLink, showCode, type Transfer } from './transfers';

export function Handover({ animalId, name, onAccepted }: { animalId: string; name: string; onAccepted: () => void }) {
  const [t, setT] = useState<Transfer | null | undefined>(undefined); // undefined: not loaded / offline
  const [open, setOpen] = useState(false); const [from, setFrom] = useState(''); const [notes, setNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const x = await latestTransfer(animalId).catch(() => undefined); setT(x);
    if (x?.accepted_at) { onAccepted(); syncFresh(); }
  }, [animalId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); AsyncStorage.getItem(FROM_KEY).then(v => v && setFrom(v), () => {}); }, [load]);
  const live = t && !t.accepted_at && t.expires_at > new Date().toISOString() ? t : null;

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

  return (<View style={[s.card, { marginTop: 14 }]} accessibilityLabel="Hand over to buyer">
    <Text style={s.h}>Hand over to buyer</Text>
    {t?.accepted_at ? <Text style={{ color: C.ink, marginTop: 4 }}>Handed over on {fmt(t.accepted_at.slice(0, 10))}. The buyer has their own copy; this one is marked Sold.</Text>
      : live ? <>
        <Text style={s.mu}>Waiting for the buyer. Send them this link{live.from_name ? ` (signed "${live.from_name}")` : ''}. It works once and expires {fmt(live.expires_at.slice(0, 10))}.</Text>
        <Text selectable style={{ color: C.ink, fontWeight: '700', fontSize: 20, marginTop: 8, letterSpacing: 1 }} accessibilityLabel={`Handover code ${showCode(live.code)}`}>{showCode(live.code)}</Text>
        <Text selectable style={[s.mu, { marginTop: 2 }]}>{claimLink(live.code)}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <Btn solid t="Share link" onPress={() => share(live.code)} /><Btn t="Cancel link" onPress={() => cancel(live.code)} /></View></>
      : !open ? <>
        <Text style={s.mu}>Sold {name}? Send the buyer a link and they get their own copy with its feeding, shed and weight history and its genes, free. It's marked Sold here when they accept.</Text>
        <View style={{ marginTop: 10 }}><Btn t="Make a handover link" onPress={() => t === undefined ? load().then(() => setOpen(true)) : setOpen(true)} /></View></>
      : <>
        <Input label="Your name or business (shown to the buyer)" value={from} onChangeText={setFrom} placeholder="e.g. Eternal Reptiles" />
        <Pressable onPress={() => setNotes(!notes)} accessibilityRole="checkbox" accessibilityState={{ checked: notes }} aria-checked={notes}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: C.ink, backgroundColor: notes ? C.ink : C.card, alignItems: 'center', justifyContent: 'center' }}>
            {notes && <Text style={{ color: C.bg, fontWeight: '700' }}>✓</Text>}</View>
          <Text style={{ color: C.ink, flex: 1 }}>Include my notes (otherwise only the records are sent)</Text></Pressable>
        <Text style={[s.mu, { marginTop: 8 }]}>Photos aren't included.</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Btn solid disabled={busy} t={busy ? 'Making link…' : 'Make link'} onPress={create} /><Btn t="Not now" onPress={() => setOpen(false)} /></View></>}
  </View>);
}
