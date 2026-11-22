// Account > Sales and purchases: every animal handed over or received through Clutchly, with the other person's
// details and licence if they shared them. Kept even if the animal or the other account is deleted later.
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { fmt } from '../lib/logic';
import { Btn, C, Card, notify, s } from '../lib/ui';
import { allTransfers, licenceLines, type Transfer } from '../lib/transfers';
import { Platform, Share } from 'react-native';

export default function Records() {
  const r = useRouter(); const [rows, setRows] = useState<Transfer[] | null>(null); const [uid, setUid] = useState('');
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? ''));
    allTransfers().then(setRows, e => { notify('Could not load', e.message); setRows([]); });
  }, []);
  if (!rows) return <View style={s.page}><Text style={s.mu}>Loading…</Text></View>;
  const sold = (t: Transfer) => t.seller_id === uid || (t.accepted_by !== uid);
  const entry = (t: Transfer) => {
    const out = sold(t); const other = out ? t.buyer_licence : t.seller_licence;
    return [`${fmt(t.accepted_at!.slice(0, 10))} · ${out ? 'Sold' : 'Bought'}: ${t.animal_name ?? 'Animal'}${t.species ? ` (${t.species})` : ''}`,
      `${out ? 'Buyer' : 'Seller'}: ${other ? licenceLines(other).join(', ') : out ? 'details not shared' : (t.from_name || 'details not shared')}`];
  };
  const shareAll = async () => {
    const text = rows.map(t => entry(t).join('\n')).join('\n\n');
    if (Platform.OS !== 'web') return Share.share({ message: text });
    try { await (globalThis.navigator as any).clipboard.writeText(text); notify('Copied', 'Paste it into a document or email.'); } catch { notify('Could not copy'); }
  };
  return (<ScrollView style={s.page}>
    <Text style={s.mu}>Animals you've handed over or received with a handover link, with the other person's licence details if they shared them.</Text>
    {!rows.length && <Text style={[s.mu, { marginTop: 12 }]}>Nothing yet. Make a handover link on an animal's page when you sell one.</Text>}
    {rows.map(t => { const out = sold(t); const other = out ? t.buyer_licence : t.seller_licence; const mine = out ? t.seller_licence : t.buyer_licence; const id = out ? t.animal_id : t.new_animal_id;
      return <Card key={t.code} onPress={id ? () => r.push(`/animal/${id}`) : undefined}>
        <Text style={s.mu}>{fmt(t.accepted_at!.slice(0, 10))} · {out ? 'Sold' : 'Bought'}</Text>
        <Text style={s.h}>{t.animal_name ?? 'Animal'}{t.species ? <Text style={s.mu}> · {t.species}</Text> : null}</Text>
        <Text style={[s.mu, { marginTop: 4 }]}>{out ? 'Buyer' : 'Seller'}</Text>
        {other ? licenceLines(other).map((x, i) => <Text key={i} selectable style={{ color: C.ink }}>{x}</Text>)
          : <Text style={{ color: C.ink }}>{!out && t.from_name ? `${t.from_name} (licence not shared)` : 'Licence details not shared'}</Text>}
        {mine && <Text style={[s.mu, { marginTop: 4 }]}>Your licence {mine.licence_no ?? ''} was shared with them.</Text>}
      </Card>; })}
    {rows.length > 0 && <View style={{ marginTop: 8 }}><Btn t={Platform.OS === 'web' ? 'Copy as text' : 'Share as text'} onPress={shareAll} /></View>}
    <View style={{ height: 60 }} /></ScrollView>);
}
