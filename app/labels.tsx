// Print QR labels: pick animals and a label size, then print (or save a PDF on a phone). Opened from the Animals tab
// (nothing ticked) or an animal's page (that animal ticked).
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SvgXml } from 'react-native-svg';
import { fmt } from '../lib/logic';
import { morphName } from '../lib/genetics';
import { useGeneLib } from '../lib/useGenes';
import { useCollection } from '../lib/derived';
import { useStore } from '../lib/store';
import { Btn, C, Check, Chips, Input, notify, s } from '../lib/ui';
import { Loading } from '../lib/Brand';
import { LAYOUTS, animalLink, labelLines, labelsHtml, layoutOf, qrSvg, type LabelAnimal } from '../lib/labels';
import { labelsPdf } from '../lib/labelsPdf';

const LAYOUT_KEY = 'clutchly.labelLayout'; const ALL = 'All species';
const pt = (mm: number) => Math.round(mm * 72 / 25.4);

/** Added to an iPhone's home screen, the web app can't print (iOS ignores print there), so it shares a PDF instead. */
const inHomeScreenApp = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);
const PDF_NAME = 'Clutchly labels.pdf';
/** Web: the share sheet with the PDF (it has Print); false if this browser can't share files. */
async function sharePdf(blob: Blob) {
  const file = new File([blob], PDF_NAME, { type: 'application/pdf' }); const nav = navigator as any;
  if (!nav.canShare?.({ files: [file] })) return false;
  try { await nav.share({ files: [file] }); } catch (e: any) { if (e?.name !== 'AbortError') throw e; }
  return true;
}
function downloadPdf(blob: Blob) {
  const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = PDF_NAME;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60_000);
}
/** Web: print the labels from a hidden frame, so the app page itself isn't printed. */
function printWeb(html: string) {
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f); const d = f.contentWindow!.document; d.open(); d.write(html); d.close();
  setTimeout(() => { f.contentWindow!.focus(); f.contentWindow!.print(); setTimeout(() => f.remove(), 60_000); }, 300);
}

export default function Labels() {
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const { ready, animals } = useCollection(); const { animal_genes } = useStore(); const genes = useGeneLib();
  const [picked, setPicked] = useState<Set<string>>(() => new Set((ids ?? '').split(',').filter(Boolean)));
  const [layout, setLayout] = useState('a4-21'); const [skip, setSkip] = useState(''); const [sold, setSold] = useState(false); const [sp, setSp] = useState(ALL);
  const [busy, setBusy] = useState(false);
  useEffect(() => { AsyncStorage.getItem(LAYOUT_KEY).then(v => v && LAYOUTS.some(l => l.key === v) && setLayout(v), () => {}); }, []);
  const morphs = useMemo(() => { const by: Record<string, any[]> = {}; for (const g of animal_genes) (by[g.animal_id] ??= []).push(g);
    return Object.fromEntries(Object.entries(by).map(([k, v]) => [k, morphName(genes, v)])); }, [animal_genes, genes]);
  const L = layoutOf(layout); const sheet = L.cols * L.rows > 1;
  const pool = animals.filter(a => sold || a.status !== 'Sold' || picked.has(a.id));
  const species = [...new Set(pool.map(a => a.species))].sort();
  const shown = pool.filter(a => sp === ALL || a.species === sp);
  const chosen: LabelAnimal[] = animals.filter(a => picked.has(a.id)).map(a => ({ id: a.id, name: a.name, species: a.species, sex: a.sex, dob: a.dob, morph: morphs[a.id] || null }));
  const toggle = (id: string) => { const n = new Set(picked); n.has(id) ? n.delete(id) : n.add(id); setPicked(n); };
  const pickLayout = (k: string) => { setLayout(k); AsyncStorage.setItem(LAYOUT_KEY, k).catch(() => {}); };
  const sheets = Math.ceil((chosen.length + (sheet ? Math.min(parseInt(skip, 10) || 0, L.cols * L.rows - 1) : 0)) / (L.cols * L.rows));

  const go = async (pdf: boolean) => {
    if (!chosen.length) return notify('Tick the animals to print');
    const html = labelsHtml(chosen, layout, fmt, sheet ? parseInt(skip, 10) || 0 : 0);
    if (Platform.OS === 'web') {
      const home = inHomeScreenApp();
      if (!pdf && !home) return printWeb(html);
      try {
        const blob = labelsPdf(chosen, layout, fmt, sheet ? parseInt(skip, 10) || 0 : 0);
        if (!(home && await sharePdf(blob))) downloadPdf(blob);
      } catch (e: any) { notify('Could not make the PDF', String(e?.message ?? e)); }
      return;
    }
    setBusy(true);
    try {
      const size = { width: pt(L.page.w), height: pt(L.page.h) };
      if (pdf) { const { uri } = await Print.printToFileAsync({ html, ...size }); await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' }); }
      else await Print.printAsync({ html, ...size });
    } catch (e: any) { if (!/cancel/i.test(String(e?.message))) notify('Could not print', String(e?.message ?? e)); }
    setBusy(false);
  };

  if (!ready) return <Loading />;
  const first = chosen[0];
  return (<View style={{ flex: 1, backgroundColor: C.bg }}><ScrollView style={s.page} keyboardShouldPersistTaps="handled">
    <Text style={s.mu}>Each label has a QR code: scan it with Clutchly's Scan button (or any phone camera) to open that animal.</Text>
    <Text style={[s.h, { marginTop: 12 }]}>Label size</Text>
    {LAYOUTS.map(l => <Pressable key={l.key} onPress={() => pickLayout(l.key)} accessibilityRole="radio" accessibilityState={{ checked: layout === l.key }} aria-checked={layout === l.key}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
        {layout === l.key && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.ink }} />}</View>
      <Text style={{ color: C.ink, flex: 1 }}>{l.name}</Text></Pressable>)}
    {sheet && <Input label="Labels already used on the first sheet (skip them)" keyboardType="number-pad" value={skip} onChangeText={setSkip} placeholder="0" />}
    {first && <><Text style={[s.h, { marginTop: 14 }]}>Preview</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: C.bd, borderRadius: 6, padding: 8, marginTop: 6, alignSelf: 'flex-start', maxWidth: '100%' }}
        accessibilityLabel={`Label preview for ${first.name}`}>
        <SvgXml xml={qrSvg(animalLink(first.id))} width={84} height={84} />
        <View style={{ flexShrink: 1 }}><Text style={{ fontWeight: '700', fontSize: 16, color: '#000' }} numberOfLines={1}>{first.name}</Text>
          {labelLines(first, fmt).map((x, i) => <Text key={i} style={{ fontSize: 12, color: '#000' }} numberOfLines={1}>{x}</Text>)}</View></View></>}
    <Text style={[s.h, { marginTop: 14 }]}>Animals ({chosen.length} ticked)</Text>
    {species.length > 1 && <Chips opts={[ALL, ...species]} v={sp} on={setSp} />}
    <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
      <Btn t="Tick all shown" onPress={() => setPicked(new Set([...picked, ...shown.map(a => a.id)]))} />
      <Btn t="Clear" onPress={() => setPicked(new Set())} /></View>
    <Check on={sold} set={setSold} t="Show sold animals" />
    {shown.map(a => <Check key={a.id} on={picked.has(a.id)} set={() => toggle(a.id)} t={[a.name, a.species, morphs[a.id], a.sex].filter(Boolean).join(' · ')} />)}
    <View style={{ height: 100 }} />
  </ScrollView>
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, paddingBottom: 24, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.bd, flexDirection: 'row', gap: 8 }}>
      <View style={{ flex: 1 }}><Btn solid disabled={busy || !chosen.length} onPress={() => go(false)}
        t={chosen.length ? `Print ${chosen.length} label${chosen.length === 1 ? '' : 's'}${sheet ? ` (${sheets} sheet${sheets === 1 ? '' : 's'})` : ''}` : 'Tick animals to print'} /></View>
      <Btn disabled={busy || !chosen.length} t="Save PDF" onPress={() => go(true)} />
    </View></View>);
}
