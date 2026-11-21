import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Btn, Input, notify, s, serif, C } from '../lib/ui';
import { APP_NAME } from '../lib/brand';
import { LegalLinks } from '../lib/LegalLinks';
export default function Login() {
  const r = useRouter();
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (up: boolean) => {
    const e = email.trim();
    if (!e || !pw) return notify('Enter your email and password');
    setBusy(true);
    const r = up ? await supabase.auth.signUp({ email: e, password: pw }) : await supabase.auth.signInWithPassword({ email: e, password: pw });
    setBusy(false);
    if (r.error) notify('Error', r.error.message);
    else if (up && !r.data.session) notify('Check your email', 'Confirm your address, then sign in.');
  };
  return (<View style={[s.page, { justifyContent: 'center' }]}>
    <Image source={require('../assets/logo-ink.png')} style={{ width: 150, height: 145, alignSelf: 'center', marginBottom: 6 }} resizeMode="contain" accessibilityLabel="Clutchly logo: a python coiled around a clutch of eggs" />
    <Text style={{ fontFamily: serif, fontSize: 34, letterSpacing: 1, textAlign: 'center', color: C.ink }}>{APP_NAME}</Text>
    <Text style={[s.mu, { textAlign: 'center' }]}>Feeding, sheds and breeding for your collection</Text>
    <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" />
    <Input label="Password" value={pw} onChangeText={setPw} secureTextEntry textContentType="password" autoComplete="password" />
    <View style={{ gap: 8, marginTop: 14 }}><Btn solid disabled={busy} t="Sign in" onPress={() => go(false)} /><Btn disabled={busy} t="Create account" onPress={() => go(true)} /></View>
    <Pressable onPress={() => r.push({ pathname: '/forgot', params: email.trim() ? { email: email.trim() } : {} })} style={{ alignSelf: 'center', padding: 12, marginTop: 4 }} accessibilityRole="link">
      <Text style={{ color: C.ink, textDecorationLine: 'underline' }}>Forgot password?</Text></Pressable>
    <View style={{ marginTop: 18 }}><Text style={[s.mu, { textAlign: 'center', marginBottom: 4 }]}>By creating an account you agree to the terms of use and privacy policy.</Text><LegalLinks center /></View>
  </View>);
}
