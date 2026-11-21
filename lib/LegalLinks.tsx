import { Linking, Text, View } from 'react-native';
import { LINKS } from './brand';
import { C, s } from './ui';

const open = (url: string) => Linking.openURL(url).catch(() => {});
/** Privacy · Terms · Support links (pages hosted from /site). */
export function LegalLinks({ center }: { center?: boolean }) {
  const link = (label: string, url: string) => <Text onPress={() => open(url)} accessibilityRole="link" style={{ color: C.ink, textDecorationLine: 'underline' }}>{label}</Text>;
  return (<View style={{ flexDirection: 'row', gap: 6, justifyContent: center ? 'center' : 'flex-start', flexWrap: 'wrap' }}>
    {link('Privacy policy', LINKS.privacy)}<Text style={s.mu}>·</Text>{link('Terms of use', LINKS.terms)}<Text style={s.mu}>·</Text>{link('Support', LINKS.support)}</View>);
}
