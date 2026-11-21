import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { parseAuthParams } from '../lib/authLinks';
import { Btn, C, Input, notify, s } from '../lib/ui';

// Opened from the password-reset email. The link signs the user in for this one purpose; they then choose a new password.
export default function ResetPassword() {
  const r = useRouter(); const linkUrl = Linking.useLinkingURL();
  // expo-router also hands the link's #fragment to the screen as the '#' param; use it if the full URL isn't available.
  const hash = useLocalSearchParams<{ '#'?: string }>()['#'];
  const url = linkUrl && linkUrl.includes('reset-password') ? linkUrl : hash ? `#${hash}` : linkUrl;
  const [state, setState] = useState<'checking' | 'ready' | 'error'>('checking'); const [msg, setMsg] = useState('');
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = parseAuthParams(url);
      const fail = (m: string) => { if (!cancelled) { setMsg(m); setState('error'); } };
      if (p.error || p.error_description) {
        return fail(p.error_code === 'otp_expired' ? 'This reset link has expired or was already used.' : (p.error_description || p.error));
      }
      if (p.access_token && p.refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token });
        if (error) return fail(error.message);
      } else if (p.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(p.code);
        if (error) return fail('This reset link only works on the device that asked for it. Request a new one here.');
      } else {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return fail('Open this screen from the link in your password reset email.');
      }
      if (!cancelled) setState('ready');
    })();
    return () => { cancelled = true; };
  }, [url]);

  const save = async () => {
    if (pw.length < 8) return notify('Use at least 8 characters');
    if (pw !== pw2) return notify("The passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return notify('Could not change password', error.message);
    notify('Password changed', "You're signed in.");
    r.replace('/');
  };

  return (<View style={[s.page, { paddingTop: 24 }]}>
    <Stack.Screen options={{ title: 'New password', headerShown: true }} />
    {state === 'checking' && <Text style={s.mu}>Checking your link…</Text>}
    {state === 'error' && <>
      <Text style={s.h}>Link not valid</Text><Text style={{ color: C.ink, marginTop: 8 }}>{msg}</Text>
      <View style={{ gap: 8, marginTop: 16 }}><Btn solid t="Send a new link" onPress={() => r.replace('/forgot')} /><Btn t="Back to sign in" onPress={() => r.replace('/login')} /></View>
    </>}
    {state === 'ready' && <>
      <Text style={{ color: C.ink }}>Choose a new password.</Text>
      <Input label="New password" value={pw} onChangeText={setPw} secureTextEntry textContentType="newPassword" autoComplete="new-password" />
      <Input label="Confirm new password" value={pw2} onChangeText={setPw2} secureTextEntry textContentType="newPassword" autoComplete="new-password" onSubmitEditing={save} />
      <View style={{ marginTop: 14 }}><Btn solid disabled={busy} t={busy ? 'Saving…' : 'Save password'} onPress={save} /></View>
    </>}
  </View>);
}
