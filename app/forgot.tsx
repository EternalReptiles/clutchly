import { useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { resetRedirectUrl } from '../lib/authLinks';
import { Btn, C, Input, notify, s } from '../lib/ui';

export default function Forgot() {
  const params = useLocalSearchParams<{ email?: string }>(); const r = useRouter();
  const [email, setEmail] = useState(params.email ?? ''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  const send = async () => {
    const e = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) return notify('Enter the email you signed up with');
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo: resetRedirectUrl() });
    setBusy(false);
    if (error) return notify('Could not send the email', error.status === 429 ? 'Too many requests. Wait a few minutes and try again.' : error.message);
    setSent(true);
  };
  return (<View style={[s.page, { paddingTop: 24 }]}>
    <Stack.Screen options={{ title: 'Forgot password', headerShown: true }} />
    {sent ? <>
      <Text style={s.h}>Check your email</Text>
      <Text style={{ color: C.ink, marginTop: 8 }}>If there is an account for {email.trim()}, we've sent it a link to set a new password. Open the link on this phone. It expires after an hour.</Text>
      <Text style={[s.mu, { marginTop: 8 }]}>Nothing arrived? Check your spam folder, or try again in a few minutes.</Text>
      <View style={{ gap: 8, marginTop: 16 }}><Btn solid t="Back to sign in" onPress={() => r.back()} /><Btn t="Send again" disabled={busy} onPress={send} /></View>
    </> : <>
      <Text style={{ color: C.ink }}>Enter your email and we'll send you a link to set a new password.</Text>
      <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" onSubmitEditing={send} />
      <View style={{ marginTop: 14 }}><Btn solid disabled={busy} t={busy ? 'Sending…' : 'Send reset link'} onPress={send} /></View>
    </>}
  </View>);
}
