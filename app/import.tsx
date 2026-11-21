import { useMemo, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File as FSFile } from 'expo-file-system';
import { insertMany, useStore } from '../lib/store';
import { usePlan } from '../lib/plan';
import { goPro } from '../lib/goPro';
import { fmt, isDayFirst } from '../lib/logic';
import { Row, parseImport } from '../lib/importer';
import { Btn, C, Card, Input, notify, s } from '../lib/ui';

const MAX_ROWS = 2000;
type Result = { added: number; problems: { row: Row; msg: string }[] };

export default function ImportScreen() {
  const r = useRouter();
  const [text, setText] = useState(''); const st = useStore();
  const existing = useMemo(() => st.ready ? st.animals.map(a => a.name as string) : null, [st.ready, st.animals]);
  const [busy, setBusy] = useState(false); const [result, setResult] = useState<Result | null>(null);
  const dayFirst = isDayFirst(); const fmtHint = dayFirst ? 'DD/MM/YYYY' : 'MM/DD/YYYY';

  const rows = useMemo(() => existing ? parseImport(text, dayFirst, existing) : [], [text, existing, dayFirst]);
  const plan = usePlan();
  const valid = rows.filter(x => !x.error), bad = rows.filter(x => x.error);
  const good = plan.isPro ? valid : valid.slice(0, plan.remaining); // free plan: only as many as fit
  const overLimit = valid.slice(good.length);

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel', 'text/*'], copyToCacheDirectory: true });
      if (res.canceled) return;
      const a = res.assets[0];
      if (/\.(xlsx|xls|numbers)$/i.test(a.name)) return notify('Save it as CSV first', 'In Excel, Numbers or Google Sheets use File > Save As / Download > CSV, then choose that file.');
      const t = Platform.OS === 'web' ? await a.file!.text() : await new FSFile(a.uri).text();
      setResult(null); setText(t);
    } catch (e: any) { notify('Could not read file', e?.message ?? String(e)); }
  };

  const run = () => {
    if (!good.length) return;
    if (rows.length > MAX_ROWS) return notify(`Too many rows`, `Import at most ${MAX_ROWS} at a time.`);
    setBusy(true);
    // Rows are added to the phone's copy at once and synced in the background (works offline too).
    const problems: Result['problems'] = [...bad.map(row => ({ row, msg: row.error! })),
      ...overLimit.map(row => ({ row, msg: `Over the free limit of ${plan.freeAnimals} animals` }))];
    const imported = new Set<number>(good.map(x => x.line));
    const added = insertMany('animals', good.map(x => ({ name: x.name, species: x.species, sex: x.sex, dob: x.dob, status: 'Active' })));
    const feeds = good.map((x, i) => ({ x, id: added[i].id })).filter(({ x }) => x.last_feed);
    insertMany('events', feeds.map(({ x, id }) => ({ animal_id: id, kind: 'feed', ok: true, on_date: x.last_feed, food: null, grams: null })));
    problems.sort((a, b) => a.row.line - b.row.line);
    // Leave only the rows that still need fixing in the box (keeping a header row if there was one).
    const firstLine = text.split(/\r\n|\n|\r/).find(l => l.trim()) ?? '';
    const hadHeader = rows.length > 0 && rows[0].raw !== firstLine;
    const retry = problems.filter(p => !imported.has(p.row.line)).map(p => p.row.raw);
    setText(retry.length ? [...(hadHeader ? [firstLine] : []), ...retry].join('\n') : '');
    setResult({ added: added.length, problems }); setBusy(false);
  };

  return (<ScrollView style={s.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <Stack.Screen options={{ title: 'Bulk add' }} />
    <Text style={{ color: C.ink }}>One animal per line: <Text style={{ fontWeight: '600' }}>name, species, sex</Text>, then optionally hatch date and last feed date.</Text>
    <Text style={[s.mu, { marginTop: 4 }]}>Sex is F or M. Dates as {fmtHint} or YYYY-MM-DD (change the order on the Season tab). A header row is optional; with one, columns can be in any order. From a spreadsheet, copy the cells and paste them here, or save as CSV.</Text>

    {result && <Card><Text style={s.h}>Imported {result.added} animal{result.added === 1 ? '' : 's'}</Text>
      {result.problems.length > 0 && <><Text style={{ color: C.bad, marginTop: 4 }}>{result.problems.length} row{result.problems.length === 1 ? '' : 's'} not imported:</Text>
        {result.problems.map((p, i) => <Text key={i} style={[s.mu, { marginTop: 2 }]}>Line {p.row.line}: {p.msg}</Text>)}
        <Text style={[s.mu, { marginTop: 6 }]}>Those rows are left in the box below so you can fix them and import again.</Text></>}
      <View style={{ marginTop: 8 }}><Btn t="Done" onPress={() => r.back()} /></View></Card>}

    <Input label="Paste here" multiline value={text} onChangeText={v => { setText(v); setResult(null); }} autoCapitalize="none" autoCorrect={false}
      placeholder={`ER001, Carpet, F\nER002, Bredli, M, ${dayFirst ? '15/01/2024' : '01/15/2024'}\nER003, Diamond, F, 2023-12-01, 2026-11-14`}
      style={{ minHeight: 140, textAlignVertical: 'top', fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 13 }} />
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
      <Btn t="Choose CSV file" onPress={pickFile} />{text ? <Btn t="Clear" onPress={() => { setText(''); setResult(null); }} /> : null}</View>

    {rows.length > 0 && <>
      <Text style={[s.h, { marginTop: 18 }]}>Preview</Text>
      <Text style={s.mu}>{good.length} ready to import{bad.length ? ` · ${bad.length} with problems (skipped)` : ''}</Text>
      {overLimit.length > 0 && <Card><Text style={{ color: C.ink }}>The free plan has room for {plan.remaining} more animal{plan.remaining === 1 ? '' : 's'} (up to {plan.freeAnimals}). The first {good.length} will be imported; the other {overLimit.length} stay in the box.</Text>
        <View style={{ marginTop: 8 }}><Btn t="Go Pro for unlimited animals" onPress={() => goPro()} /></View></Card>}
      {rows.slice(0, 500).map(x => <View key={x.line} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.bd }}>
        {x.error
          ? <><Text style={{ color: C.bad }}>Line {x.line}: {x.error}</Text><Text style={s.mu} numberOfLines={1}>{x.raw}</Text></>
          : <Text style={{ color: C.ink }}><Text style={{ fontWeight: '600' }}>{x.name}</Text> · {x.species} · {x.sex}
              {x.dob ? ` · hatched ${fmt(x.dob)}` : ''}{x.last_feed ? ` · fed ${fmt(x.last_feed)}` : ''}</Text>}
      </View>)}
      {rows.length > 500 && <Text style={s.mu}>…and {rows.length - 500} more</Text>}
      <View style={{ marginTop: 12 }}><Btn solid disabled={busy || !good.length || rows.length > MAX_ROWS}
        t={busy ? 'Importing…' : rows.length > MAX_ROWS ? `At most ${MAX_ROWS} rows at a time` : `Import ${good.length} animal${good.length === 1 ? '' : 's'}`} onPress={run} /></View>
    </>}
    <View style={{ height: 80 }} /></ScrollView>);
}
