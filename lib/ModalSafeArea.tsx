// Full-screen pop-ups (React Native's Modal) render outside the app's safe-area provider, so on iPhone their
// content slid under the status bar (time, signal, battery) and the top buttons couldn't be tapped.
// This gives each pop-up its own provider so it is padded below the status bar and above the home indicator.
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaProvider, SafeAreaView as Inner } from 'react-native-safe-area-context';

export function SafeAreaView({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return <SafeAreaProvider><Inner style={style} edges={['top', 'bottom', 'left', 'right']}>{children}</Inner></SafeAreaProvider>;
}
