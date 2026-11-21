import { Pressable, Text } from 'react-native';
import { dismissError, useStore } from './store';
import { C, notify } from './ui';

/** Small header badge: shows only when offline, syncing changes, or a change was rejected. */
export function SyncPill() {
  const st = useStore(); const n = st.queue.length;
  const label = st.error ? 'Sync problem' : st.status === 'offline' ? (n ? `Offline · ${n} to sync` : 'Offline') : st.status === 'syncing' && n ? 'Syncing…' : '';
  if (!label) return null;
  const explain = () => {
    if (st.error) { notify('Sync problem', st.error); dismissError(); return; }
    notify(st.status === 'offline' ? 'Offline, will sync' : 'Syncing',
      n ? `${n} change${n === 1 ? '' : 's'} saved on this phone will be sent when the connection is back. Keep using the app as normal.`
        : 'No connection right now. You are seeing the copy saved on this phone.');
  };
  return (<Pressable onPress={explain} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
    style={{ borderWidth: 1, borderColor: st.error ? C.bad : C.ink, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginRight: 8, backgroundColor: C.card }}>
    <Text style={{ fontSize: 12, color: st.error ? C.bad : C.ink }}>{label}</Text></Pressable>);
}
