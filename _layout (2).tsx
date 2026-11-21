import { Tabs } from 'expo-router';
import { C } from '../../lib/ui';
export default function T() {
  return (<Tabs screenOptions={{ tabBarActiveTintColor: C.ink, headerTitleStyle: { fontFamily: 'Georgia' } }}>
    <Tabs.Screen name="index" options={{ title: 'Today' }} />
    <Tabs.Screen name="animals" options={{ title: 'Animals' }} />
    <Tabs.Screen name="pairings" options={{ title: 'Pairings' }} />
    <Tabs.Screen name="settings" options={{ title: 'Season' }} />
  </Tabs>);
}
