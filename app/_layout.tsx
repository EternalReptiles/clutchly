import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { setDateFormat } from '../lib/logic';
import { C, serif } from '../lib/ui';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Root() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session !== undefined) SplashScreen.hideAsync().catch(() => {}); }, [session]);

  setDateFormat(session?.user.user_metadata?.date_format);
  const signedIn = !!session;
  return (<>
    <StatusBar style="dark" />
    <Stack screenOptions={{
      headerStyle: { backgroundColor: C.bg }, headerTintColor: C.ink, headerShadowVisible: false,
      headerTitleStyle: { fontFamily: serif, color: C.ink }, contentStyle: { backgroundColor: C.bg },
      headerBackTitle: 'Back',
    }}>
      {/* Routes are only reachable when the guard is true; expo-router redirects otherwise. */}
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="animal/[id]" options={{ title: '' }} />
        <Stack.Screen name="pairing/[id]" options={{ title: '' }} />
        <Stack.Screen name="import" options={{ title: 'Bulk add' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="forgot" options={{ title: 'Forgot password' }} />
      </Stack.Protected>
      {/* Reachable signed in or out: the reset link signs the user in, then they set a new password here. */}
      <Stack.Screen name="reset-password" options={{ title: 'New password' }} />
    </Stack>
  </>);
}
