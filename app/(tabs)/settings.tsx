import { useEffect, useMemo, useState } from 'react';
import { APP_NAME } from '../../lib/brand';
import { supabase } from '../../lib/supabase';
import { seasonFromTemplate, type Hemisphere } from '../../lib/templates';
import { useTemplates } from '../../lib/useTemplates';
import { ScrollView, Text, View } from 'react-native';
import { useCollection } from '../../lib/derived';
import { remove, saveSeason } from '../../lib/store';
import { FALLBACK, SEASON_KEYS, Season, Suggested, seasonFor, suggested } from '../../lib/logic';
import { SPECIES, Repro, speciesInfo, words } from '../../lib/species';
import { SpeciesPicker } from '../../lib/SpeciesPicker';
import { Btn, C, Card, DateField, Input, confirm, notify, s } from '../../lib/ui';

type NumKey = 'female_every' | 'male_every' | 'prelay_to_lay' | 'ovul_to_lay' | 'lay_to_hatch';
// Number fields shown for each way of reproducing.
const numFields = (r: Repro): [NumKey, string][] => [
  ['female_every', 'Feed females every (days)'], ['male_every', 'Feed males every (days)'],
  ...(r === 'python' ? [['prelay_to_lay', 'Days from pre-lay shed to lay'] as [NumKey, string]] : []),
  ['ovul_to_lay', words(r).ovulToLay],
  ...(r !== 'live' ? [['lay_to_hatch', 'Days from lay to hatch'] as [NumKey, string]] : []),
];

export default function Settings() {
  // Read from the local store (works offline); the race guard the old version needed is no longer required.
  const { ready, animals, seasons } = useCollection(); const rows = ready ? seasons : null;
  const kept = useMemo(() => [...new Set(animals.map(a => a.species))], [animals]);
  const [added, setAdded] = useState<string[]>([]);

  const get = (sp: string) => seasonFor(rows || [], sp);
  // Saves the whole row for the species, keeping its other fields.
  const save = (sp: string, patch: Partial<Season>) => {
    const cur = get(sp); const body: any = { species: sp };
    SEASON_KEYS.forEach(k => { body[k] = k in patch ? (patch as any)[k] : (cur as any)[k] ?? null; });
    saveSeason(body);
  };
  const templates = useTemplates(); const [hemi, setHemi] = useState<Hemisphere>('south');
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setHemi(data.session?.user.user_metadata?.hemisphere === 'north' ? 'north' : 'south')); }, []);
  const applyStarting = (sp: string) => { const tp = templates?.find(x => x.species === sp); if (!tp) return;
    const go = () => saveSeason(seasonFromTemplate(tp, hemi));
    if (rows?.some(r0 => r0.species === sp)) confirm(`Use starting values for ${sp}?`, 'This replaces the dates and numbers you set for this species.', 'Replace', go); else go(); };
  const reset = (sp: string) => confirm(`Clear ${sp} routine?`, 'Removes the dates and numbers you set for this species.', 'Clear', () => remove('season_settings', sp));
  if (!rows) return <View style={s.page} />;
  // Species shown: ones the user keeps, has a routine for, or just added here; in the species-list order.
  const shown = SPECIES.filter(sp => kept.includes(sp) || added.includes(sp) || rows.some(r => r.species === sp));
  // Animals saved with a species name that is no longer in the list still get a card.
  const unknown = [...kept, ...rows.map(r => r.species)].filter((sp, i, all) => !SPECIES.includes(sp) && all.indexOf(sp) === i);
  return (<ScrollView style={s.page} keyboardShouldPersistTaps="handled">
    {rows.length === 0 && <View style={[s.card, { borderColor: C.ink }]}>
      <Text style={s.h}>Set up your routine</Text>
      <Text style={{ color: C.ink, marginTop: 4 }}>{APP_NAME} doesn't assume a schedule. For each species you keep, set when you stop feeding for the season, when feeding resumes, when breeding starts, and how often you feed females and males.</Text>
      <Text style={[s.mu, { marginTop: 6 }]}>Until you do, feeds are due every {FALLBACK.female_every} days for females and {FALLBACK.male_every} for males, all year round.</Text></View>}
    <Text style={[s.h, { marginTop: 14 }]}>Your routine</Text>
    <Text style={s.mu}>One routine per species you keep. Animals of that species are hidden from Today during the feeding pause. Blank numbers use the suggestion shown in grey (with the typical range); an animal's own feed interval overrides them.</Text>
    <Text style={[s.mu, { marginTop: 4 }]}>Starting values (where offered) come from an experienced breeder's routine for the {hemi === 'north' ? 'northern' : 'southern'} hemisphere. They are starting points: adjust them to your own experience. Your changes are private and never alter the shared values.</Text>
    {!shown.length && !unknown.length && <Text style={[s.mu, { marginTop: 8 }]}>No species yet. Add animals, or add a species below.</Text>}
    {[...shown, ...unknown].map(sp => { const c = get(sp); const saved = rows.some(r => r.species === sp);
      const info = speciesInfo(sp); const sg = suggested(sp);
      return (<Card key={sp}><View style={s.row}><View style={{ flex: 1 }}><Text style={s.h}>{sp}</Text>
          {info.latin ? <Text style={[s.mu, { fontStyle: 'italic' }]}>{info.latin}</Text> : null}</View>
        {saved ? <Btn t="Clear" onPress={() => reset(sp)} /> : <Text style={s.mu}>Not set</Text>}</View>
        {templates?.some(x => x.species === sp) && <View style={{ marginTop: 6 }}><Btn t="Use starting values" onPress={() => applyStarting(sp)} /></View>}
        <DateField mode="monthDay" optional label="Feeding pause from" value={c.pause_from} onChange={v => save(sp, { pause_from: v })} />
        <DateField mode="monthDay" optional label="Feeding resumes after" value={c.pause_to} onChange={v => save(sp, { pause_to: v })} />
        <DateField mode="monthDay" optional label={info.repro === 'python' ? 'Pairing starts' : 'Breeding starts'} value={c.pair_start} onChange={v => save(sp, { pair_start: v })} />
        {numFields(info.repro).map(([k, l]) => <NumField key={`${sp}-${k}-${c[k] ?? ''}`} label={l} value={c[k]} hint={hintFor(sg, k)} onSave={v => save(sp, { [k]: v })} />)}
      </Card>); })}
    <SpeciesPicker label="" value={null} exclude={shown} onChange={sp => setAdded(a => [...a, sp])} />
    <Text style={[s.mu, { marginTop: 4 }]}>Tap above to add a routine for another species.</Text>
    <View style={{ height: 60 }} /></ScrollView>);
}

// Placeholder for a blank number: the suggestion, with the typical range where there is one.
const hintFor = (sg: Suggested, k: NumKey) => {
  const r = k === 'female_every' || k === 'male_every' ? undefined : sg.range[k];
  const v = sg[k];
  return r ? `${v} (typical ${r[0]}–${r[1]})` : v != null ? `${v} (suggested)` : 'Not set';
};

function NumField({ label, value, hint, onSave }: { label: string; value?: number | null; hint: string; onSave: (v: number | null) => void }) {
  const [t, setT] = useState(value != null ? String(value) : '');
  const commit = () => { const n = t.trim() ? parseInt(t, 10) : null;
    if (n !== null && (isNaN(n) || n < 1 || n > 365)) { notify('Enter a number of days from 1 to 365'); setT(value != null ? String(value) : ''); return; }
    if (n !== (value ?? null)) onSave(n); };
  return <Input label={label} keyboardType="number-pad" placeholder={hint} value={t} onChangeText={setT} onBlur={commit} onSubmitEditing={commit} />;
}
