import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { cross, type AnimalGene, type Lib } from './genetics';
import { C, s } from './ui';

const pctText = (p: number) => { const v = Math.round(p * 1000) / 10; return v === 0 && p > 0 ? '<0.1%' : `${Number.isInteger(v) ? v : v.toFixed(1)}%`; }; // 25%, 12.5%, 6.3%

/** Possible babies from two parents, most likely first, with odds, het tags, health warnings and line-bred traits.
 *  With `title` (on a pairing) it has its own heading and starts folded to one line; health warnings always show. */
export function MorphCalculator({ lib, mother, father, motherName, fatherName, title }:
  { lib: Lib; mother: AnimalGene[]; father: AnimalGene[]; motherName: string; fatherName: string; title?: string }) {
  const r = useMemo(() => cross(lib, mother, father), [lib, mother, father]);
  const [open, setOpen] = useState(!title);
  const shown = r.outcomes.slice(0, 32), rest = r.outcomes.slice(32);
  const severe = r.warnings.filter(w => w.severe), other = r.warnings.filter(w => !w.severe);
  const top = r.outcomes[0];
  const summary = `${r.outcomes.length} possible ${r.outcomes.length === 1 ? 'baby' : 'babies'}${top ? ` · most likely ${top.name} (${pctText(top.prob)})` : ''}`;
  return (<View>
    {title && <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} aria-expanded={open}
      accessibilityLabel={title} accessibilityHint={open ? 'Hides the possible babies' : 'Shows the possible babies'}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
      <View style={{ flex: 1 }}><Text style={s.h}>{title}</Text>{!open && <Text style={s.mu}>{summary}</Text>}</View>
      <Text style={{ color: C.ink, fontSize: 18 }}>{open ? '▴' : '▾'}</Text></Pressable>}
    {open && <Text style={s.mu}>Chance for each baby from {motherName} × {fatherName}. Real clutches vary.</Text>}
    {severe.map((w, i) => <View key={i} style={[s.card, { borderColor: C.bad, borderWidth: 2 }]} accessibilityLabel="Not recommended">
      <Text style={{ color: C.bad, fontWeight: '700', fontSize: 16 }}>Not recommended: {w.gene.name} × {w.gene.name}</Text>
      <Text style={{ color: C.bad, marginTop: 4 }}>{w.text}</Text></View>)}
    {r.nonViable > 0 && <Text style={[s.mu, { marginTop: 6 }]}>About {pctText(r.nonViable)} of eggs are expected not to develop. The odds below are for the babies that do.</Text>}
    {other.length > 0 && <View style={[s.card, { borderColor: C.bad }]}>
      {other.map((w, i) => <Text key={i} style={{ color: C.bad, marginTop: i ? 6 : 0 }}><Text style={{ fontWeight: '700' }}>{w.gene.name} · {pctText(w.prob)}: </Text>{w.text}</Text>)}</View>}
    {open && <>
    <View style={{ flexDirection: 'row', marginTop: 10, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: C.ink }}>
      <Text style={[s.mu, { flex: 1, fontWeight: '700' }]}>Possible babies ({r.outcomes.length})</Text><Text style={[s.mu, { fontWeight: '700' }]}>Odds</Text></View>
    <View accessibilityLabel="Possible offspring">
      {shown.map(o => <View key={o.label} accessibilityLabel={`${o.label}: ${o.fraction ? o.fraction + ', ' : ''}${pctText(o.prob)}`}
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.bd }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.ink, fontWeight: '600' }}>{o.name}</Text>
          {o.hets.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 3 }}>
            {o.hets.map(h => <Text key={h} style={{ color: C.ink, fontSize: 12, borderWidth: 1, borderColor: C.bd, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1, marginRight: 4, marginTop: 2 }}>het {h}</Text>)}</View>}
        </View>
        <View style={{ alignItems: 'flex-end', minWidth: 64 }}>
          <Text style={{ color: C.ink, fontWeight: '700' }}>{pctText(o.prob)}</Text>
          {o.fraction && <Text style={[s.mu, { fontSize: 12 }]}>{o.fraction}</Text>}
        </View></View>)}
      {rest.length > 0 && <Text style={[s.mu, { marginTop: 4 }]}>…and {rest.length} rarer combinations ({pctText(rest.reduce((a, o) => a + o.prob, 0))} in total).</Text>}
    </View>
    {r.possibleHets.length > 0 && <Text style={[s.mu, { marginTop: 8 }]}>Babies that don't show the gene: {r.possibleHets.map(p => `${p.pct}% possible het ${p.gene.name}`).join(', ')}.</Text>}
    {r.usesPossibleHets && <Text style={[s.mu, { marginTop: 4 }]}>Includes possible hets: the odds assume the percentages you entered.</Text>}
    {r.lineBred.length > 0 && <Text style={[s.mu, { marginTop: 4 }]}>Line-bred traits ({r.lineBred.map(l => `${l.gene.name} from the ${l.from.join(' and ')}`).join('; ')}) depend on many genes and selection, so they can't be given as odds.</Text>}
    {!mother.length && !father.length && <Text style={[s.mu, { marginTop: 4 }]}>Neither parent has genes recorded yet.</Text>}
    </>}
  </View>);
}
