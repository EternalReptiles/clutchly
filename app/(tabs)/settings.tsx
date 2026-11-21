import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { SPECIES, SEASON_KEYS, Season, seasonFor } from '../../lib/logic';
import { Btn, Card, DateField, Input, confirm, notify, s } from '../../lib/ui';

const NUMS = [['female_every', 'Feed females every (days)'], ['male_every', 'Feed males every (days)'],
  ['prelay_to_lay', 'Days from pre-lay shed to lay'], ['ovul_to_lay', 'Days from ovulation to lay']] as const;

export default function Settings() {
  const [rows, setRows] = useState<Season[]>([]);
  const load = useCallback(() => supabase.from('season_settings').select('*').then(x => {
    if (x.error) notify('Could not load', x.error.message); setRows((x.data as Season[]) || []);
  }), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const get = (sp: string) => seasonFor(rows, sp);
  // Saves the whole row, so editing one field also stores the defaults shown for the others.
  const save = async (sp: string, patch: Partial<Season>) => {
    const cur = get(sp); const body: any = { species: sp };
    SEASON_KEYS.forEach(k => { body[k] = k in patch ? (patch as any)[k] : (cur as any)[k] ?? null; });
    setRows(rs => [...rs.filter(r => r.species !== sp), body]);
    const { error } = await supabase.from('season_settings').upsert(body, { onConflict: 'user_id,species' });
    if (error) { notify('Could not save', error.message); load(); }
  };
  const reset = (sp: string) => confirm(`Reset ${sp}?`, 'Go back to the default settings for this species.', 'Reset', async () => {
    const { error } = await supabase.from('season_settings').delete().eq('species', sp);
    if (error) notify('Error', error.message); load();
  });
  const signOut = async () => { const { error } = await supabase.auth.signOut(); if (error) notify('Error', error.message); };
  const del = () => confirm('Delete account?', 'All your animals and records are permanently deleted. This cannot be undone.', 'Delete', async () => {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return notify('Could not delete account', error.message);
    await supabase.auth.signOut({ scope: 'local' });
  });

  return (<ScrollView style={s.page}>
    <Text style={s.mu}>Each species has its own yearly season. Animals of that species are hidden from Today during the feeding pause. Blank feed intervals fall back to 7 days for females and 21 for males; an animal's own interval overrides both.</Text>
    {SPECIES.map(sp => { const c = get(sp); const saved = rows.some(r => r.species === sp);
      return (<Card key={sp}><View style={s.row}><Text style={[s.h, { flex: 1 }]}>{sp}</Text>
        {saved ? <Btn t="Reset" onPress={() => reset(sp)} /> : <Text style={s.mu}>Defaults</Text>}</View>
        <DateField mode="monthDay" optional label="Feeding pause from" value={c.pause_from} onChange={v => save(sp, { pause_from: v })} />
        <DateField mode="monthDay" optional label="Feeding resumes after" value={c.pause_to} onChange={v => save(sp, { pause_to: v })} />
        <DateField mode="monthDay" optional label="Pairing starts" value={c.pair_start} onChange={v => save(sp, { pair_start: v })} />
        {NUMS.map(([k, l]) => <NumField key={`${sp}-${k}-${c[k] ?? ''}`} label={l} value={c[k]} onSave={v => save(sp, { [k]: v })} />)}
      </Card>); })}
    <View style={{ gap: 8, marginTop: 20 }}><Btn t="Sign out" onPress={signOut} /><Btn danger t="Delete account" onPress={del} /></View>
    <View style={{ height: 60 }} /></ScrollView>);
}

function NumField({ label, value, onSave }: { label: string; value?: number | null; onSave: (v: number | null) => void }) {
  const [t, setT] = useState(value != null ? String(value) : '');
  const commit = () => { const n = t.trim() ? parseInt(t, 10) : null;
    if (n !== null && (isNaN(n) || n < 1 || n > 365)) { notify('Enter a number of days from 1 to 365'); setT(value != null ? String(value) : ''); return; }
    if (n !== (value ?? null)) onSave(n); };
  return <Input label={label} keyboardType="number-pad" value={t} onChangeText={setT} onBlur={commit} onSubmitEditing={commit} />;
}
