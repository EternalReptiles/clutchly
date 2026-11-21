// Brand pieces used across the app: the logo mark, the header wordmark, empty states and the loading screen.
// All from assets/logo-ink.png and the app's own colours and serif (no extra libraries).
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { APP_NAME } from './brand';
import { fmtLong, today } from './logic';
import { C, serif, s } from './ui';

const LOGO = require('../assets/logo-ink.png');   // 600 x 580
const RATIO = 580 / 600;

export function LogoMark({ size = 28, faded }: { size?: number; faded?: boolean }) {
  return <Image source={LOGO} style={{ width: size, height: size * RATIO, opacity: faded ? 0.35 : 1 }} resizeMode="contain"
    accessibilityLabel={`${APP_NAME} logo`} />;
}

/** Logo and name, for the Overview header. */
export function BrandTitle() {
  return (<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityRole="header" accessibilityLabel={APP_NAME}>
    <LogoMark size={30} /><Text style={{ fontFamily: serif, fontSize: 22, color: C.ink, letterSpacing: 0.3 }}>{APP_NAME}</Text></View>);
}

/** Friendly empty screen: faded logo, a heading and a line of help. */
export function EmptyState({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return (<View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 12 }}>
    <LogoMark size={96} faded />
    <Text style={[s.h, { marginTop: 14, textAlign: 'center' }]}>{title}</Text>
    {text ? <Text style={[s.mu, { marginTop: 4, textAlign: 'center' }]}>{text}</Text> : null}
    {children ? <View style={{ marginTop: 12 }}>{children}</View> : null}
  </View>);
}

/** Shown while the collection loads from the phone. */
export function Loading({ text = 'Loading your collection…' }: { text?: string }) {
  return (<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24 }}>
    <LogoMark size={120} />
    <Text style={{ fontFamily: serif, fontSize: 26, color: C.ink, marginTop: 12 }}>{APP_NAME}</Text>
    <ActivityIndicator color={C.ink} style={{ marginTop: 16 }} />
    <Text style={[s.mu, { marginTop: 8 }]}>{text}</Text>
  </View>);
}

/** "Good morning" and today's date, at the top of Overview. */
export function Greeting() {
  const h = new Date().getHours();
  const hello = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const date = fmtLong(today());
  return (<View style={{ marginBottom: 10 }}>
    <Text style={{ fontFamily: serif, fontSize: 26, color: C.ink }}>{hello}</Text>
    <Text style={s.mu}>{date}</Text></View>);
}
