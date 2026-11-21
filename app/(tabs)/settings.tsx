import { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { DATE_FORMATS, DateFormat, FALLBACK, SPECIES, SEASON_KEYS, Season, fmt, seasonFor, setDateFormat, today } from '../../lib/logic';
import { Btn, C, Card, Chips, DateField, Input, confirm, notify, s } from '../../lib/ui';

const NUMS = [['female_every', 'Feed females every (days)'], ['male_every', 'Feed males every (days)'],
  ['prelay_to_lay', 'Days from pre-lay shed to lay'], ['ovul_to_lay', 'Days from ovulation to lay']] as const;

export default function Settings() {
  const [rows, setRows] = useState<Season[] | null>(null); const [df, setDf] = useState<DateFormat>('auto');
  // Bumped on every load and every edit, so a slow load can't overwrite a change made after it started.
  const seq = useRef(0);
  const load = useCallback(() => { const mine = ++seq.current;
    return supabase.from('season_settings').select('*').then(x => {
      if (mine !== seq.current) return;
      if (x.error) notify('Could not load', x.error.message); setRows((x.data as Season[]) || []);
    }); }, []);
  useFocusEffect(useCallback(() => { supabase.auth.getSession().then(({ data }) => setDf(data.session?.user.user_metadata?.date_format || 'auto')); }, []));
  const changeFormat = async (f: DateFormat) => {
    setDf(f); setDateFormat(f);
    const { error } = await supabase.auth.updateUser({ data: { date_format: f } });
    if (error) notify('Could not save', error.message);
  };
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const get = (sp: string) => seasonFor(rows || [], sp);
  // Saves the whole row for the species, keeping its other fields.
  const save = async (sp: string, patch: Partial<Season>) => {
    const cur = get(sp); const body: any = { species: sp };
    SEASON_KEYS.forEach(k => { body[k] = k in patch ? (patch as any)[k] : (cur as any)[k] ?? null; });
    seq.current++; setRows(rs => [...(rs || []).filter(r => r.species !== sp), body]);
    const { error } = await supabase.from('season_settings').upsert(body, { onConflict: 'user_id,species' });
    if (error) { notify('Could not save', error.message); load(); }
  };
  const reset = (sp: string) => confirm(`Clear ${sp} routine?`, 'Removes the feeding pause, pairing date and intervals you set for this species.', 'Clear', async () => {
    const { error } = await supabase.from('season_settings').delete().eq('species', sp);
    if (error) notify('Error', error.message); load();
  });
  const signOut = async () => { const { error } = await supabase.auth.signOut(); if (error) notify('Error', error.message); };
  const del = () => confirm('Delete account?', 'All your animals and records are permanently deleted. This cannot be undone.', 'Delete', async () => {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return notify('Could not delete account', error.message);
    await supabase.auth.signOut({ scope: 'local' });
  });

  if (!rows) return <View style={s.page} />;
  return (<ScrollView style={s.page}>
    <Card><Text style={s.h}>Date format</Text>
      <Chips opts={DATE_FORMATS.map(f => f[1])} v={DATE_FORMATS.find(f => f[0] === df)![1]} on={l => changeFormat(DATE_FORMATS.find(f => f[1] === l)![0])} />
      <Text style={[s.mu, { marginTop: 6 }]}>Today shows as {fmt(today())}</Text></Card>
    {rows.length === 0 && <View style={[s.card, { borderColor: C.ink }]}>
      <Text style={s.h}>Set up your routine</Text>
      <Text style={{ color: C.ink, marginTop: 4 }}>Clutchly doesn't assume a schedule. For each species you keep, set when you stop feeding for the season, when feeding resumes, when pairing starts, and how often you feed females and males.</Text>
      <Text style={[s.mu, { marginTop: 6 }]}>Until you do, feeds are due every {FALLBACK.female_every} days for females and {FALLBACK.male_every} for males, all year round.</Text></View>}
    <Text style={[s.h, { marginTop: 14 }]}>Your routine</Text>
    <Text style={s.mu}>Each species has its own yearly routine. Animals of that species are hidden from Today during the feeding pause. Blank fields use the suggested numbers shown in grey; an animal's own feed interval overrides both.</Text>
    {SPECIES.map(sp => { const c = get(sp); const saved = rows.some(r => r.species === sp);
      return (<Card key={sp}><View style={s.row}><Text style={[s.h, { flex: 1 }]}>{sp}</Text>
        {saved ? <Btn t="Clear" onPress={() => reset(sp)} /> : <Text style={s.mu}>Not set</Text>}</View>
        <DateField mode="monthDay" optional label="Feeding pause from" value={c.pause_from} onChange={v => save(sp, { pause_from: v })} />
        <DateField mode="monthDay" optional label="Feeding resumes after" value={c.pause_to} onChange={v => save(sp, { pause_to: v })} />
        <DateField mode="monthDay" optional label="Pairing starts" value={c.pair_start} onChange={v => save(sp, { pair_start: v })} />
        {NUMS.map(([k, l]) => <NumField key={`${sp}-${k}-${c[k] ?? ''}`} label={l} value={c[k]} suggested={FALLBACK[k]} onSave={v => save(sp, { [k]: v })} />)}
      </Card>); })}
    <View style={{ gap: 8, marginTop: 20 }}><Btn t="Sign out" onPress={signOut} /><Btn danger t="Delete account" onPress={del} /></View>
    <View style={{ height: 60 }} /></ScrollView>);
}

function NumField({ label, value, suggested, onSave }: { label: string; value?: number | null; suggested: number; onSave: (v: number | null) => void }) {
  const [t, setT] = useState(value != null ? String(value) : '');
  const commit = () => { const n = t.trim() ? parseInt(t, 10) : null;
    if (n !== null && (isNaN(n) || n < 1 || n > 365)) { notify('Enter a number of days from 1 to 365'); setT(value != null ? String(value) : ''); return; }
    if (n !== (value ?? null)) onSave(n); };
  return <Input label={label} keyboardType="number-pad" placeholder={`${suggested} (suggested)`} value={t} onChangeText={setT} onBlur={commit} onSubmitEditing={commit} />;
}
