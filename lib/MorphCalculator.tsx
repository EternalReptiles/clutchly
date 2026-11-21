import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { cross, type AnimalGene, type Gene } from './genetics';
import { C, s } from './ui';

const pctText = (p: number) => { const v = Math.round(p * 1000) / 10; return `${Number.isInteger(v) ? v : v.toFixed(1)}%`; }; // e.g. 25%, 12.5%, 6.3%

/** Possible babies from two parents, with odds, possible hets, health warnings and line-bred traits. */
export function MorphCalculator({ genes, mother, father, motherName, fatherName }:
  { genes: Map<string, Gene>; mother: AnimalGene[]; father: AnimalGene[]; motherName: string; fatherName: string }) {
  const r = useMemo(() => cross(genes, mother, father), [genes, mother, father]);
  const shown = r.outcomes.slice(0, 24), rest = r.outcomes.slice(24);
  return (<View>
    <Text style={s.mu}>Chance for each baby from {motherName} × {fatherName}. Real clutches vary.</Text>
    {r.warnings.length > 0 && <View style={[s.card, { borderColor: C.bad }]}>
      {r.warnings.map((w, i) => <Text key={i} style={{ color: C.bad, marginTop: i ? 6 : 0 }}><Text style={{ fontWeight: '700' }}>{w.gene.name} · {pctText(w.prob)}: </Text>{w.text}</Text>)}</View>}
    <View style={{ marginTop: 6 }} accessibilityLabel="Possible offspring">
      {shown.map(o => <View key={o.label} style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.bd }}>
        <Text style={{ flex: 1, color: C.ink }}>{o.label}</Text><Text style={{ color: C.ink, fontWeight: '600' }}>{pctText(o.prob)}</Text></View>)}
      {rest.length > 0 && <Text style={[s.mu, { marginTop: 4 }]}>…and {rest.length} rarer combinations ({pctText(rest.reduce((a, o) => a + o.prob, 0))} in total).</Text>}
    </View>
    {r.possibleHets.length > 0 && <Text style={[s.mu, { marginTop: 8 }]}>Babies that don't show the gene: {r.possibleHets.map(p => `${p.pct}% possible het ${p.gene.name}`).join(', ')}.</Text>}
    {r.usesPossibleHets && <Text style={[s.mu, { marginTop: 4 }]}>Includes possible hets: the odds assume the percentages you entered.</Text>}
    {r.lineBred.length > 0 && <Text style={[s.mu, { marginTop: 4 }]}>Line-bred traits ({r.lineBred.map(l => `${l.gene.name} from the ${l.from.join(' and ')}`).join('; ')}) depend on many genes and selection, so they can't be given as odds.</Text>}
    {!mother.length && !father.length && <Text style={[s.mu, { marginTop: 4 }]}>Neither parent has genes recorded yet. Add them on each animal's page.</Text>}
  </View>);
}
