import { useCallback, useState } from 'react';
import { LogoMark } from '../lib/Brand';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { DATE_FORMATS, DateFormat, fmt, today } from '../lib/logic';
import { Btn, C, Card, Chips, Input, confirm, notify, s } from '../lib/ui';
import { NotificationSettings } from '../lib/NotificationSettings';
import { LegalLinks } from '../lib/LegalLinks';
import { usePlan } from '../lib/plan';
import { goPro } from '../lib/goPro';
import { APP_NAME } from '../lib/brand';
import { downloadMyData } from '../lib/exportData';
import Constants from 'expo-constants';
const appVersion = Constants.expoConfig?.version ?? '';
import { disablePushHere, signOutAndForgetDevice } from '../lib/notifications';
import { applyDateFormat, clearCache, getState, start, stop } from '../lib/store';

export default function Account() {
  const [email, setEmail] = useState(''); const [df, setDf] = useState<DateFormat>('auto');
  const [exporting, setExporting] = useState(false); const plan = usePlan();
  const exportData = async () => { setExporting(true); const err = await downloadMyData(); setExporting(false); if (err) notify('Could not export', err); };
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [busy, setBusy] = useState(false);
  useFocusEffect(useCallback(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? ''); setDf(data.session?.user.user_metadata?.date_format || 'auto');
    });
  }, []));

  const changeFormat = async (f: DateFormat) => {
    setDf(f); applyDateFormat(f);
    const { error } = await supabase.auth.updateUser({ data: { date_format: f } });
    if (error) notify('Could not save', error.message);
  };
  const changePassword = async () => {
    if (pw.length < 8) return notify('Use at least 8 characters');
    if (pw !== pw2) return notify("The passwords don't match");
    setBusy(true); const { error } = await supabase.auth.updateUser({ password: pw }); setBusy(false);
    if (error) return notify('Could not change password', error.message);
    setPw(''); setPw2(''); notify('Password changed');
  };
  const signOut = () => {
    const { uid, queue } = getState();
    const go = async () => { const { error } = await signOutAndForgetDevice(); if (error) return notify('Error', error.message); if (uid) clearCache(uid); };
    if (queue.length) confirm('Changes not synced yet', `${queue.length} change${queue.length === 1 ? '' : 's'} on this phone haven't reached the server. Signing out now loses them. Connect to the internet first to keep them.`, 'Sign out anyway', go);
    else go();
  };
  const del = () => confirm('Delete account?', 'All your animals and records are permanently deleted. This cannot be undone.', 'Delete', async () => {
    // Stop syncing first, so queued changes aren't sent while the account is being removed.
    const { uid } = getState(); stop();
    const { error } = await supabase.rpc('delete_my_account');
    if (error) { if (uid) start(uid); return notify('Could not delete account', error.message); }
    // The account's device tokens were deleted with it; forget this phone's copy too.
    await disablePushHere().catch(() => {});
    if (uid) clearCache(uid);
    await supabase.auth.signOut({ scope: 'local' });
  });

  return (<ScrollView style={s.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <Stack.Screen options={{ title: 'Account' }} />
    <Card><Text style={s.h}>Signed in as</Text><Text style={{ color: C.ink, marginTop: 4 }}>{email}</Text></Card>
    <Card><Text style={s.h}>Date format</Text>
      <Chips opts={DATE_FORMATS.map(f => f[1])} v={DATE_FORMATS.find(f => f[0] === df)![1]} on={l => changeFormat(DATE_FORMATS.find(f => f[1] === l)![0])} />
      <Text style={[s.mu, { marginTop: 6 }]}>Today shows as {fmt(today())}</Text></Card>
    <Card><Text style={s.h}>Plan</Text>
      <Text style={{ color: C.ink, marginTop: 4 }}>{plan.isPro ? `${APP_NAME} Pro${plan.expiresAt ? ` · ${plan.productId?.includes('lifetime') ? 'active until' : 'renews or ends'} ${fmt(plan.expiresAt.slice(0, 10))}` : ' · no end date'}` : `Free · ${plan.count} of ${plan.freeAnimals} owned animals`}</Text>
      <View style={{ marginTop: 8 }}><Btn solid={!plan.isPro} t={plan.isPro ? 'Manage Pro' : 'Go Pro'} onPress={() => goPro()} /></View></Card>
    <NotificationSettings />
    <Card><Text style={s.h}>Change password</Text>
      <Input label="New password" value={pw} onChangeText={setPw} secureTextEntry textContentType="newPassword" autoComplete="new-password" />
      <Input label="Confirm new password" value={pw2} onChangeText={setPw2} secureTextEntry textContentType="newPassword" autoComplete="new-password" onSubmitEditing={changePassword} />
      <View style={{ marginTop: 10 }}><Btn disabled={busy} t={busy ? 'Saving…' : 'Change password'} onPress={changePassword} /></View></Card>
    <Card><Text style={s.h}>Your data</Text>
      <Text style={[s.mu, { marginTop: 4 }]}>Download everything you've entered (animals, history, pairings, routine, settings and photo links) as one file.</Text>
      <View style={{ marginTop: 8 }}><Btn disabled={exporting} t={exporting ? 'Preparing…' : 'Download my data'} onPress={exportData} /></View></Card>
    <Card><Text style={s.h}>Help and legal</Text><View style={{ marginTop: 6 }}><LegalLinks /></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}><LogoMark size={28} />
        <Text style={s.mu}>{APP_NAME} · version {appVersion}</Text></View></Card>
    <View style={{ gap: 8, marginTop: 20 }}><Btn t="Sign out" onPress={signOut} />
      <Btn danger t="Delete account" onPress={del} />
      <Text style={[s.mu, { textAlign: 'center' }]}>Deleting your account permanently removes all your animals, feeding records, pairings and routines.</Text></View>
    <View style={{ height: 60 }} /></ScrollView>);
}
