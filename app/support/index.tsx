// Help: searchable questions and answers (help.json, built into the app so it works offline), and Contact support.
// Reachable signed in or out (the sign-in screen links here).
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Btn, C, Input, s } from '../../lib/ui';
import { answerParts, searchHelp } from '../../lib/help';

export default function Help() {
  const r = useRouter(); const [q, setQ] = useState(''); const [open, setOpen] = useState<string | null>(null);
  const sections = searchHelp(q); const searching = q.trim().length > 0;
  return (<ScrollView style={s.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <Input placeholder="Search help" value={q} onChangeText={setQ} accessibilityLabel="Search help" autoCorrect={false} />
    {!sections.length && <View style={[s.card, { marginTop: 12 }]}><Text style={s.h}>No answers for "{q.trim()}"</Text>
      <Text style={s.mu}>Try other words, or send us a message.</Text></View>}
    {sections.map(sec => <View key={sec.title} style={{ marginTop: 16 }}>
      <Text style={[s.h, { marginBottom: 4 }]} accessibilityRole="header">{sec.title}</Text>
      {sec.items.map(it => { const key = `${sec.title}|${it.q}`; const shown = searching || open === key;
        return <View key={key} style={{ borderBottomWidth: 1, borderBottomColor: C.bd }}>
          <Pressable onPress={() => setOpen(shown && !searching ? null : key)} accessibilityRole="button" accessibilityState={{ expanded: shown }} aria-expanded={shown}
            style={{ paddingVertical: 10, flexDirection: 'row', gap: 8 }}>
            <Text style={{ color: C.ink, fontWeight: '600', flex: 1 }}>{it.q}</Text><Text style={{ color: C.mu }}>{shown ? '−' : '+'}</Text></Pressable>
          {shown && <View style={{ paddingBottom: 10, gap: 6 }}>{answerParts(it.a).map((p, i) =>
            <Text key={i} style={{ color: C.ink, lineHeight: 21 }}>{p.map((x, j) => <Text key={j} style={x.bold ? { fontWeight: '700' } : undefined}>{x.text}</Text>)}</Text>)}</View>}
        </View>; })}
    </View>)}
    <View style={[s.card, { marginTop: 20 }]}>
      <Text style={s.h}>Still stuck?</Text>
      <Text style={s.mu}>Send us a message and we'll reply by email.</Text>
      <View style={{ marginTop: 10 }}><Btn solid t="Contact support" onPress={() => r.push('/support/contact')} /></View>
    </View>
    <View style={{ height: 60 }} /></ScrollView>);
}
