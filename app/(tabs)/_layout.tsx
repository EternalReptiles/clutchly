import { Tabs } from 'expo-router';
import { C, serif } from '../../lib/ui';
export default function T() {
  return (<Tabs screenOptions={{
    tabBarActiveTintColor: C.ink, tabBarInactiveTintColor: C.mu,
    tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.bd }, tabBarIcon: () => null, tabBarIconStyle: { display: 'none' },
    tabBarLabelStyle: { fontSize: 14, fontFamily: serif },
    headerStyle: { backgroundColor: C.bg }, headerShadowVisible: false, headerTitleStyle: { fontFamily: serif, color: C.ink },
    sceneStyle: { backgroundColor: C.bg },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Today' }} />
    <Tabs.Screen name="animals" options={{ title: 'Animals' }} />
    <Tabs.Screen name="pairings" options={{ title: 'Pairings' }} />
    <Tabs.Screen name="settings" options={{ title: 'Season' }} />
  </Tabs>);
}
