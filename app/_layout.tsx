import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable, Text } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { refreshPushToken } from '../lib/notifications';
import { applyDateFormat, start, stop } from '../lib/store';
import { SyncPill } from '../lib/SyncPill';
import { purchasesLogIn, purchasesLogOut } from '../lib/purchases';
import { C, serif } from '../lib/ui';
import { PENDING_ANIMAL_KEY } from '../lib/labels';

SplashScreen.preventAutoHideAsync().catch(() => {});
// Web: the animal a page was opened on (a scanned label's link), so it can be opened after signing in.
const OPENED_ANIMAL = Platform.OS === 'web' && typeof window !== 'undefined'
  ? (window.location.pathname.match(/\/animal\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1] ?? null) : null;

export default function Root() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session !== undefined) SplashScreen.hideAsync().catch(() => {}); }, [session]);
  // Opened a label's link while signed out: sign-in takes over the page, so remember the animal for afterwards.
  // Only when the page opened signed out (not after signing out later, or the next person would be sent there).
  const firstSession = useRef<Session | null | undefined>(undefined);
  useEffect(() => {
    if (session === undefined || firstSession.current !== undefined) return;
    firstSession.current = session;
    if (session === null && OPENED_ANIMAL) AsyncStorage.setItem(PENDING_ANIMAL_KEY, OPENED_ANIMAL).catch(() => {});
  }, [session]);
  // Expo push tokens can change; keep this phone's registration current (never prompts).
  const uid = session?.user.id;
  useEffect(() => { if (uid) refreshPushToken(); }, [uid]);
  // Purchases are linked to the Supabase user id, which is how the webhook knows whose subscription it is.
  useEffect(() => { if (uid) purchasesLogIn(uid); else if (session === null) purchasesLogOut(); }, [uid, session === null]);
  // Local copy of the user's data (offline mode): load and sync on sign in, drop on sign out.
  useEffect(() => { if (uid) start(uid); else if (session === null) stop(); }, [uid, session === null]);

  useEffect(() => { applyDateFormat(session?.user.user_metadata?.date_format); }, [session?.user.user_metadata?.date_format]);
  // First run: send new users to the welcome screen once (remembered on the account, and on the phone for offline).
  const router = useRouter(); const segments = useSegments();
  const onboarded = !!session?.user.user_metadata?.onboarded;
  useEffect(() => {
    if (!uid || onboarded || segments[0] === 'welcome' || segments[0] === 'reset-password' || segments[0] === 'claim') return;
    AsyncStorage.getItem(`clutchly.onboarded.${uid}`).then(v => { if (!v) router.replace('/welcome'); }, () => {});
  }, [uid, onboarded, segments[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  const signedIn = !!session;
  // Wait until we know whether someone is signed in. Rendering the screens before that briefly counts as signed
  // out, which sent a refreshed web page (e.g. /app/pairings) to sign-in and then back to Overview.
  if (session === undefined) return <StatusBar style="dark" />;
  return (<>
    <StatusBar style="dark" />
    <Stack screenOptions={({ navigation }) => ({
      headerStyle: { backgroundColor: C.bg }, headerTintColor: C.ink, headerShadowVisible: false,
      headerTitleStyle: { fontFamily: serif, color: C.ink }, contentStyle: { backgroundColor: C.bg },
      headerBackTitle: 'Back', headerRight: () => <SyncPill />,
      // Web: after a browser refresh (or an opened link) there's no screen to go back to, so offer Home instead.
      ...(Platform.OS === 'web' && !navigation.canGoBack() ? { headerLeft: () =>
        <Pressable onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="Home" style={{ paddingHorizontal: 12 }}>
          <Text style={{ color: C.ink, fontSize: 16 }}>‹ Home</Text></Pressable> } : {}),
    })}>
      {/* Routes are only reachable when the guard is true; expo-router redirects otherwise. */}
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="animal/[id]" options={{ title: '' }} />
        <Stack.Screen name="pairing/[id]" options={{ title: '' }} />
        <Stack.Screen name="import" options={{ title: 'Bulk add' }} />
        <Stack.Screen name="account" options={{ title: 'Account' }} />
        <Stack.Screen name="welcome" options={{ title: 'Welcome' }} />
        <Stack.Screen name="calculator" options={{ title: 'Morph calculator' }} />
        <Stack.Screen name="paywall" options={{ title: 'Pro', presentation: 'modal' }} />
        <Stack.Screen name="history/[id]" options={{ title: 'History' }} />
        <Stack.Screen name="feed" options={{ title: 'Feed several' }} />
        <Stack.Screen name="claim/index" options={{ title: 'Handover code' }} />
        <Stack.Screen name="licence" options={{ title: 'Wildlife licence' }} />
        <Stack.Screen name="labels" options={{ title: 'Print labels' }} />
        <Stack.Screen name="scan" options={{ title: 'Scan a label' }} />
        <Stack.Screen name="records" options={{ title: 'Sales and purchases' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="forgot" options={{ title: 'Forgot password' }} />
      </Stack.Protected>
      {/* Reachable signed in or out: the reset link signs the user in, then they set a new password here. */}
      <Stack.Screen name="reset-password" options={{ title: 'New password' }} />
      {/* A handover link: shows what's being handed over to anyone with the link; accepting needs an account. */}
      <Stack.Screen name="claim/[code]" options={{ title: 'Handover' }} />
    </Stack>
  </>);
}
