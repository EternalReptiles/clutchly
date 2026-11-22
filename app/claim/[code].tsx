// The buyer's side of a handover: what's being handed over, and asking for it. The seller then approves (and the copy
// is made) or declines. Reachable signed in or out (the link is often opened by someone who hasn't signed up yet).
// Signed out, the code is remembered and Overview brings them back here after they sign in or create an account.
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { fmt } from '../../lib/logic';
import { syncFresh } from '../../lib/store';
import { goPro } from '../../lib/goPro';
import { Btn, C, confirm, s } from '../../lib/ui';
import { BUYER_SWAP_TEXT, PENDING_KEY, cleanCode, getLicence, licenceComplete, previewTransfer, requestTransfer, showCode, withdrawRequest,
  type Licence, type Preview } from '../../lib/transfers';

const STATE: Record<string, string> = { visual: '', super: 'Super ', het: 'het ', possible_het: 'possible het ' };

export default function Claim() {
  const { code: raw } = useLocalSearchParams<{ code: string }>(); const code = cleanCode(raw ?? ''); const r = useRouter();
  const [p, setP] = useState<Preview | null | undefined>(undefined); const [err, setErr] = useState('');
  const [signedIn, setSignedIn] = useState<boolean | null>(null); const [busy, setBusy] = useState(false);
  // undefined: still loading; 'error': couldn't load (offline); null: none saved.
  const [lic, setLic] = useState<Licence | null | undefined | 'error'>(undefined);
  const load = useCallback(() => previewTransfer(code).then(setP, e => { setErr(e.message); setP(null); }), [code]);
  // Reloaded whenever the screen shows again (after adding a licence, or coming back to see if the seller approved).
  useFocusEffect(useCallback(() => {
    load();
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      if (data.session) getLicence().then(setLic, () => setLic(x => x && x !== 'error' ? x : 'error'));
    });
  }, [load]));
  const ask = async () => {
    setBusy(true); setErr('');
    try { await requestTransfer(code); await load(); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  const withdraw = () => confirm('Withdraw your request?', 'The seller won\'t be asked any more, and your details are taken off the request.', 'Withdraw',
    async () => { try { await withdrawRequest(code); await load(); } catch (e: any) { setErr(e.message); } });
  const open = async (id: string) => { await syncFresh(); r.replace(`/animal/${id}`); };
  const signIn = async () => { await AsyncStorage.setItem(PENDING_KEY, code).catch(() => {}); r.replace('/login'); };
  const gene = (g: Preview['genes'][number]) => g.state === 'possible_het' && g.het_pct ? `${g.het_pct}% het ${g.name}` : `${STATE[g.state] ?? ''}${g.name}`;
  const seller = p?.from_name || 'the seller';

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
          <Text style={[s.mu, { marginTop: 6 }]}>{[`${p.feeds} feed${p.feeds === 1 ? '' : 's'}`, `${p.sheds} shed${p.sheds === 1 ? '' : 's'}`,
            `${p.weights} weight${p.weights === 1 ? '' : 's'}`, p.photos ? `${p.photos} photo${p.photos === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')}</Text>
        </View>
        {p.new_animal_id ? <>
            <Text style={[s.h, { marginTop: 8 }]}>{seller[0].toUpperCase() + seller.slice(1)} approved: {p.name} is in your collection.</Text>
            <View style={{ marginTop: 10 }}><Btn solid t={`Open ${p.name}`} onPress={() => open(p.new_animal_id!)} /></View></>
          : p.accepted ? <Text style={[s.h, { marginTop: 8 }]}>This animal has already been added to a collection.</Text>
          : p.mine ? <Text style={[s.mu, { marginTop: 8 }]}>This is your own animal. Send this link to the buyer: when they ask for it, you approve it on the animal's page.</Text>
          : signedIn === false ? <>
            <Text style={[s.mu, { marginTop: 8 }]}>Sign in, or create a free account, to add {p.name} and its records to your collection.</Text>
            <View style={{ marginTop: 10 }}><Btn solid t="Sign in or create account" onPress={signIn} /></View></>
          : !signedIn ? null
          : p.requested_by_me ? <>
            <Text style={[s.h, { marginTop: 8 }]}>Waiting for {seller} to approve</Text>
            <Text style={[s.mu, { marginTop: 4 }]}>You've asked for {p.name}. Once they approve, it appears in your Animals with its records, and you get their licence details. Come back to this link any time to check.</Text>
            <View style={{ marginTop: 10 }}><Btn t="Withdraw request" onPress={withdraw} /></View></>
          : p.requested ? <Text style={[s.h, { marginTop: 8 }]}>Someone else has already asked for this animal. If that wasn't you, contact the seller.</Text>
          : <>
            <Text style={[s.mu, { marginTop: 8 }]}>Ask for {p.name} and {seller} approves it; you then get your own copy with its history{p.photos ? ', genes and photos' : ' and genes'}, to keep logging. Link expires {fmt(p.expires_at.slice(0, 10))}.</Text>
            <Text style={[s.mu, { marginTop: 6 }]}>{BUYER_SWAP_TEXT}</Text>
            {lic === undefined ? <Text style={[s.mu, { marginTop: 6 }]}>Checking your licence details…</Text>
            : lic === 'error' ? <Text style={{ color: C.bad, marginTop: 6 }}>Couldn't check your licence details. Check your connection and open this link again.</Text>
            : licenceComplete(lic) ? <>
              <Text style={{ color: C.ink, marginTop: 6 }}>Yours: {lic!.full_name}, licence {lic!.licence_no}, {lic!.address}</Text>
              <View style={{ marginTop: 10 }}><Btn solid disabled={busy} t={busy ? 'Asking…' : 'Ask to add to my collection'} onPress={ask} /></View></>
            : <>
              <Text style={{ color: C.ink, marginTop: 6 }}>First, add your full name, wildlife licence number and address. You'll come back here.</Text>
              <View style={{ marginTop: 10 }}><Btn solid t="Add my licence details" onPress={() => r.push('/licence')} /></View></>}</>}
        {err ? <View style={{ marginTop: 10 }}><Text style={{ color: C.bad }}>{err}</Text>
          {/Go Pro/.test(err) && <View style={{ marginTop: 8 }}><Btn t="See Pro" onPress={() => goPro()} /></View>}</View> : null}
      </>}
    <View style={{ height: 40 }} /></ScrollView>);
}
