// Type or paste a handover code (or the whole link) from a breeder.
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Btn, Input, notify, s } from '../../lib/ui';
import { cleanCode } from '../../lib/transfers';

export default function EnterCode() {
  const [v, setV] = useState(''); const r = useRouter();
  const go = () => { const c = cleanCode(v); if (c.length !== 10) return notify('Check the code', 'Handover codes are 10 letters and numbers, like K7QXM-3PAZ9. You can also paste the whole link.'); r.push(`/claim/${c}`); };
  return (<View style={s.page}>
    <Text style={s.mu}>Bought an animal from a breeder who uses Clutchly? Enter the handover code or paste the link they sent you, and its records are added to your collection.</Text>
    <Input label="Handover code or link" value={v} onChangeText={setV} placeholder="e.g. K7QXM-3PAZ9" autoCapitalize="characters" autoCorrect={false} onSubmitEditing={go} />
    <View style={{ marginTop: 10 }}><Btn solid t="Look up" onPress={go} /></View>
  </View>);
}
