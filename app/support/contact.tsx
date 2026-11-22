// Contact support: a message to the support address (supabase/functions/support-message), with the app version,
// platform and plan attached so support doesn't have to ask. Works signed in or out.
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import brand from '../../brand.json';
import { supabase } from '../../lib/supabase';
import { Btn, C, Chips, Input, Label, notify, s } from '../../lib/ui';
import { TOPICS, sendSupport, supportMeta } from '../../lib/help';

export default function Contact() {
  const r = useRouter(); const [email, setEmail] = useState(''); const [topic, setTopic] = useState(TOPICS[0]);
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { const e = data.session?.user.email; if (e) setEmail(e); }); }, []);
  const meta = supportMeta();
  const send = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return notify('Check your email address', 'We need it to reply.');
    if (!msg.trim()) return notify('Write a message', 'Tell us what happened or what you need.');
    setBusy(true);
    try { await sendSupport(email.trim(), topic, msg.trim()); setSent(true); } catch (e: any) { notify('Not sent', e.message); }
    setBusy(false);
  };
  if (sent) return (<View style={s.page}><View style={s.card}>
    <Text style={s.h}>Thanks, your message is on its way</Text>
    <Text style={{ color: C.ink, marginTop: 4 }}>We'll reply to {email.trim()}, usually within a couple of days. Check your junk folder if you don't see it.</Text>
    <View style={{ marginTop: 10 }}><Btn t="Done" onPress={() => r.canGoBack() ? r.back() : r.replace('/')} /></View></View></View>);
  return (<ScrollView style={s.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <Label t="What's it about?" /><Chips opts={TOPICS} v={topic} on={setTopic} />
    <Input label="Your email (for our reply)" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" />
    <Input label="Message" multiline value={msg} onChangeText={setMsg} maxLength={5000} placeholder="What happened, or what do you need? For a problem, the steps that cause it help a lot."
      style={{ minHeight: 140, textAlignVertical: 'top' }} />
    <Text style={[s.mu, { marginTop: 8 }]}>Sent with your message, to help us help you: {Object.entries(meta).map(([k, v]) => `${k.replace(/_/g, ' ')} ${k === 'platform' ? String(v).split(' (')[0] : v}`).join(' · ')}. Nothing about your animals or records.</Text>
    <View style={{ marginTop: 12 }}><Btn solid disabled={busy} t={busy ? 'Sending…' : 'Send message'} onPress={send} /></View>
    <Text style={[s.mu, { marginTop: 12 }]}>Or email {brand.supportEmail}.</Text>
    <View style={{ height: 60 }} /></ScrollView>);
}
