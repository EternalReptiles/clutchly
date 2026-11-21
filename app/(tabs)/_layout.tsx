import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { C, serif } from '../../lib/ui';
import { SyncPill } from '../../lib/SyncPill';

// Round button in the top-right of every tab: the user's initial (a profile photo can replace it later). Opens Account.
function AccountButton() {
  const r = useRouter(); const [email, setEmail] = useState('');
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? '')); }, []);
  return (<Pressable onPress={() => r.push('/account')} accessibilityRole="button" accessibilityLabel="Account" hitSlop={8}
    style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: C.ink, backgroundColor: C.card,
      alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
    <Text style={{ fontFamily: serif, fontSize: 16, color: C.ink }}>{(email[0] || '·').toUpperCase()}</Text></Pressable>);
}

export default function T() {
  return (<Tabs screenOptions={{
    tabBarActiveTintColor: C.ink, tabBarInactiveTintColor: C.mu,
    tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.bd }, tabBarIcon: () => null, tabBarIconStyle: { display: 'none' },
    tabBarLabelStyle: { fontSize: 14, fontFamily: serif },
    headerStyle: { backgroundColor: C.bg }, headerShadowVisible: false, headerTitleStyle: { fontFamily: serif, color: C.ink },
    headerRight: () => <View style={{ flexDirection: 'row', alignItems: 'center' }}><SyncPill /><AccountButton /></View>,
    sceneStyle: { backgroundColor: C.bg },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Today' }} />
    <Tabs.Screen name="animals" options={{ title: 'Animals' }} />
    <Tabs.Screen name="pairings" options={{ title: 'Pairings' }} />
    <Tabs.Screen name="settings" options={{ title: 'Season' }} />
  </Tabs>);
}
