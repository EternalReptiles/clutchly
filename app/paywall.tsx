import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { PurchasesPackage } from 'react-native-purchases';
import { APP_NAME } from '../lib/brand';
import { fmt } from '../lib/logic';
import { usePlan } from '../lib/plan';
import { buy, manageSubscriptionsUrl, purchasesAvailable, redeemCode, restore, yearlyPackage } from '../lib/purchases';
import { getState, sync } from '../lib/store';
import { LegalLinks } from '../lib/LegalLinks';
import { Btn, C, Card, notify, s } from '../lib/ui';

/** Waits (up to ~30 s) for the server to record the purchase; Pro status comes only from the server. */
async function waitForPro() {
  for (let i = 0; i < 15; i++) {
    await sync(); const p = getState().plan;
    if (p.active && (!p.expiresAt || Date.parse(p.expiresAt) > Date.now())) return true;
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

export default function Paywall() {
  const r = useRouter(); const { reason } = useLocalSearchParams<{ reason?: string }>();
  const plan = usePlan();
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null); const [loading, setLoading] = useState(purchasesAvailable); const [busy, setBusy] = useState(false);
  useEffect(() => { if (purchasesAvailable) yearlyPackage().then(setPkg, () => {}).finally(() => setLoading(false)); }, []);

  const subscribe = async () => {
    if (!pkg) return; setBusy(true);
    const res = await buy(pkg);
    if (res === 'purchased') {
      const ok = await waitForPro(); setBusy(false);
      if (ok) { notify(`Welcome to ${APP_NAME} Pro`, 'Thank you! Unlimited animals, photos and notifications are unlocked.'); r.back(); }
      else notify('Purchase received', 'It can take a minute to activate. If Pro is not on soon, tap Restore purchases.');
      return;
    }
    setBusy(false);
    if (res !== 'cancelled') notify('Purchase not completed', res.error);
  };
  const doRestore = async () => {
    setBusy(true); const res = await restore();
    if ('error' in res) { setBusy(false); return notify('Could not restore', res.error); }
    if (!res.hasPro) { setBusy(false); return notify('Nothing to restore', `No ${APP_NAME} Pro purchase was found for this Apple or Google account.`); }
    const ok = await waitForPro(); setBusy(false);
    notify(ok ? 'Purchases restored' : 'Restoring…', ok ? 'Pro is active on this account.' : 'It can take a minute to activate.');
  };

  const price = pkg?.product.priceString;
  const store = Platform.OS === 'ios' ? 'Apple ID' : 'Google Play account';
  return (<ScrollView style={s.page}>
    <Stack.Screen options={{ title: `${APP_NAME} Pro` }} />
    {reason ? <View style={[s.card, { borderColor: C.ink, marginBottom: 12 }]}><Text style={{ color: C.ink }}>{reason}</Text></View> : null}
    <Text style={[s.h, { fontSize: 24 }]}>{APP_NAME} Pro</Text>
    {plan.isPro ? <Card><Text style={s.h}>You have Pro</Text>
        <Text style={{ color: C.ink, marginTop: 4 }}>{plan.expiresAt ? `${plan.productId?.includes('lifetime') ? 'Active' : 'Renews or ends'} ${fmt(plan.expiresAt.slice(0, 10))}.` : 'Active, with no end date.'}</Text>
        {plan.expiresAt && <View style={{ marginTop: 8 }}><Btn t="Manage subscription" onPress={() => Linking.openURL(manageSubscriptionsUrl)} /></View>}</Card>
      : <Text style={{ color: C.ink, marginTop: 4 }}>The free plan includes every record-keeping feature for up to {plan.freeAnimals} owned animals (animals marked Sold don't count). Pro adds:</Text>}
    <Card>
      {[['Unlimited animals', `Free: up to ${plan.freeAnimals} owned (you have ${plan.count})`], ['Photos', 'A gallery and cover photo for every animal'],
        ['Morning notifications', 'Feeds due, lays coming up and pairing season']].map(([a, b]) =>
        <View key={a} style={{ marginBottom: 8 }}><Text style={[s.h, { fontSize: 16 }]}>{a}</Text><Text style={s.mu}>{b}</Text></View>)}
      <Text style={s.mu}>Your data is never deleted. If Pro ends you keep everything and can view, edit and download it; you just can't add more than {plan.freeAnimals} animals or new photos.</Text>
    </Card>

    {!plan.isPro && (Platform.OS === 'web'
      ? <Card><Text style={{ color: C.ink }}>Subscriptions are available in the {APP_NAME} app for iPhone and Android.</Text></Card>
      : !purchasesAvailable ? <Card><Text style={{ color: C.ink }}>Purchases aren't set up in this build yet.</Text></Card>
      : loading ? <Text style={[s.mu, { marginTop: 10 }]}>Loading price…</Text>
      : !pkg ? <Card><Text style={{ color: C.ink }}>The subscription can't be loaded right now. Check your connection and try again.</Text></Card>
      : <View style={{ marginTop: 10 }}>
          <Btn solid disabled={busy} t={busy ? 'Please wait…' : `Subscribe for ${price} per year`} onPress={subscribe} />
          <Text style={[s.mu, { marginTop: 8 }]}>{price} per year, charged to your {store} when you confirm. The subscription renews automatically each year at the same price unless you turn off auto-renew at least 24 hours before the end of the current year. Manage or cancel any time in your {store} settings; cancelling stops the next renewal and Pro stays on until the end of the year you paid for.</Text>
        </View>)}

    <View style={{ gap: 8, marginTop: 14 }}>
      {Platform.OS !== 'web' && purchasesAvailable && <Btn disabled={busy} t="Restore purchases" onPress={doRestore} />}
      {Platform.OS !== 'web' && <Btn t="Redeem a code" onPress={redeemCode} />}
      <Btn t={plan.isPro ? 'Done' : 'Not now'} onPress={() => r.back()} /></View>
    <View style={{ marginTop: 16 }}><LegalLinks center /></View>
    <View style={{ height: 60 }} /></ScrollView>);
}
