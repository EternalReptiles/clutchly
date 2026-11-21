import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { Btn, Input, s, serif } from '../lib/ui';
export default function Login() {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const go = async (up: boolean) => {
    const r = up ? await supabase.auth.signUp({ email, password: pw }) : await supabase.auth.signInWithPassword({ email, password: pw });
    if (r.error) Alert.alert('Error', r.error.message);
    else if (up && !r.data.session) Alert.alert('Check your email', 'Confirm your address, then sign in.');
  };
  return (<View style={[s.page, { justifyContent: 'center' }]}>
    <Text style={{ fontFamily: serif, fontSize: 30, textAlign: 'center' }}>Herdbook</Text>
    <Text style={[s.mu, { textAlign: 'center' }]}>Feeding, sheds and breeding for your collection</Text>
    <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
    <Input label="Password" value={pw} onChangeText={setPw} secureTextEntry />
    <View style={{ gap: 8, marginTop: 14 }}><Btn solid t="Sign in" onPress={() => go(false)} /><Btn t="Create account" onPress={() => go(true)} /></View>
  </View>);
}
