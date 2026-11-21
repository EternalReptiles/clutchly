import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { SPECIES } from '../../lib/logic';
import { Btn, Card, Input, s } from '../../lib/ui';
export default function Settings() {
  const [cfg, setCfg] = useState<Record<string, any>>({});
  useFocusEffect(useCallback(() => { supabase.from('season_settings').select('*').then(x => setCfg(Object.fromEntries((x.data || []).map((c: any) => [c.species, c])))); }, []));
  const set = (sp: string, k: string, v: string) => setCfg(c => ({ ...c, [sp]: { ...c[sp], species: sp, [k]: v } }));
  const save = (sp: string) => { const { user_id, ...c } = cfg[sp] || {}; supabase.from('season_settings').upsert({ ...c, species: sp }, { onConflict: 'user_id,species' }); };
  const del = () => Alert.alert('Delete account?', 'All your animals and records are permanently deleted.', [{ text: 'Cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.rpc('delete_my_account'); await supabase.auth.signOut(); } }]);
  return (<ScrollView style={s.page}><Text style={s.mu}>Month-day (MM-DD), repeating yearly. Feeds are hidden from Today during the pause.</Text>
    {SPECIES.map(sp => <Card key={sp}><Text style={s.h}>{sp}</Text>
      {([['pause_from', 'Feeding pause from'], ['pause_to', 'Feeding resumes after'], ['pair_start', 'Pairing starts']] as const).map(([k, l]) =>
        <Input key={k} label={l} placeholder="MM-DD" value={cfg[sp]?.[k] || ''} onChangeText={v => set(sp, k, v)} onEndEditing={() => save(sp)} />)}</Card>)}
    <View style={{ gap: 8, marginTop: 20 }}><Btn t="Sign out" onPress={() => supabase.auth.signOut()} /><Btn danger t="Delete account" onPress={del} /></View>
    <View style={{ height: 60 }} /></ScrollView>);
}
