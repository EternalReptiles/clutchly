// The buyer's side of a handover: what's being handed over, and Add to my collection.
// Reachable signed in or out (the link is often opened by someone who hasn't signed up yet). Signed out, the code is
// remembered and Overview brings them back here after they sign in or create an account.
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { fmt } from '../../lib/logic';
import { syncFresh } from '../../lib/store';
import { goPro } from '../../lib/goPro';
import { Btn, C, s } from '../../lib/ui';
import { PENDING_KEY, acceptTransfer, cleanCode, previewTransfer, showCode, type Preview } from '../../lib/transfers';

const STATE: Record<string, string> = { visual: '', super: 'Super ', het: 'het ', possible_het: 'possible het ' };

export default function Claim() {
  const { code: raw } = useLocalSearchParams<{ code: string }>(); const code = cleanCode(raw ?? ''); const r = useRouter();
  const [p, setP] = useState<Preview | null | undefined>(undefined); const [err, setErr] = useState('');
  const [signedIn, setSignedIn] = useState<boolean | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    previewTransfer(code).then(setP, e => { setErr(e.message); setP(null); });
  }, [code]);
  const accept = async () => {
    setBusy(true); setErr('');
    try { const id = await acceptTransfer(code); await syncFresh(); r.replace(`/animal/${id}`); }
    catch (e: any) { setErr(e.message); setBusy(false); }
  };
  const signIn = async () => { await AsyncStorage.setItem(PENDING_KEY, code).catch(() => {}); r.replace('/login'); };
  const gene = (g: Preview['genes'][number]) => g.state === 'possible_het' && g.het_pct ? `${g.het_pct}% het ${g.name}` : `${STATE[g.state] ?? ''}${g.name}`;

  return (<ScrollView style={s.page}><Stack.Screen options={{ title: 'Handover' }} />
    {p === undefined ? <Text style={s.mu}>Looking up {showCode(code)}…</Text>
      : !p ? <View style={s.card}><Text style={s.h}>Link not found</Text>
        <Text style={s.mu}>{err || `No handover with the code ${showCode(code)}. It may have expired or been cancelled; ask the seller for a new link.`}</Text></View>
      : <>
        <Text style={s.mu}>{p.from_name ? `${p.from_name} is` : 'A breeder is'} handing this animal over to you:</Text>
        <View style={s.card}>
          <Text style={[s.h, { fontSize: 22 }]}>{p.name}</Text>
          <Text style={{ color: C.ink }}>{p.species} · {p.sex}{p.dob ? ` · hatched ${fmt(p.dob)}` : ''}</Text>
          {p.genes.length > 0 && <Text style={{ color: C.ink, marginTop: 4 }}>{p.genes.map(gene).join(', ')}</Text>}
          <Text style={[s.mu, { marginTop: 6 }]}>{p.feeds} feed{p.feeds === 1 ? '' : 's'} · {p.sheds} shed{p.sheds === 1 ? '' : 's'} · {p.weights} weight{p.weights === 1 ? '' : 's'}</Text>
        </View>
        {p.accepted ? <Text style={[s.h, { marginTop: 8 }]}>This animal has already been added to a collection.</Text>
          : p.mine ? <Text style={[s.mu, { marginTop: 8 }]}>This is your own animal. Send this link to the buyer: when they accept, they get their own copy.</Text>
          : signedIn === false ? <>
            <Text style={[s.mu, { marginTop: 8 }]}>Sign in, or create a free account, to add {p.name} and its records to your collection.</Text>
            <View style={{ marginTop: 10 }}><Btn solid t="Sign in or create account" onPress={signIn} /></View></>
          : signedIn ? <>
            <Text style={[s.mu, { marginTop: 8 }]}>You'll get your own copy with its history and genes, to keep logging. Link expires {fmt(p.expires_at.slice(0, 10))}.</Text>
            <View style={{ marginTop: 10 }}><Btn solid disabled={busy} t={busy ? 'Adding…' : 'Add to my collection'} onPress={accept} /></View></> : null}
        {err ? <View style={{ marginTop: 10 }}><Text style={{ color: C.bad }}>{err}</Text>
          {/Go Pro/.test(err) && <View style={{ marginTop: 8 }}><Btn t="See Pro" onPress={() => goPro()} /></View>}</View> : null}
      </>}
    <View style={{ height: 40 }} /></ScrollView>);
}
