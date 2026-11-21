import { useMemo, useState } from 'react';
import { Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { fmt } from './logic';
import { niceTicks } from './history';
import { C, s } from './ui';

const H = 180, PAD = { l: 44, r: 16, t: 12, b: 24 };
const t = (d: string) => new Date(d + 'T12:00:00').getTime();
const gramsLabel = (g: number) => (g >= 10000 ? `${Math.round(g / 1000)}k` : g >= 1000 ? g.toLocaleString() : String(g));

/** Growth chart: weight over time. Single series in ink, so no legend; tap or drag to read any point. */
export function WeightChart({ points }: { points: { date: string; grams: number }[] }) {
  const [w, setW] = useState(0); const [sel, setSel] = useState<number | null>(null);
  const geo = useMemo(() => {
    if (points.length < 2 || !w) return null;
    const lo = Math.min(...points.map(p => p.grams)), hi = Math.max(...points.map(p => p.grams));
    const ticks = niceTicks(lo, hi); const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const x0 = t(points[0].date), x1 = t(points[points.length - 1].date);
    const X = (d: string) => PAD.l + ((t(d) - x0) / Math.max(1, x1 - x0)) * (w - PAD.l - PAD.r);
    const Y = (g: number) => PAD.t + (1 - (g - y0) / Math.max(1e-9, y1 - y0)) * (H - PAD.t - PAD.b);
    const xy = points.map(p => ({ ...p, x: X(p.date), y: Y(p.grams) }));
    const line = xy.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L${xy[xy.length - 1].x.toFixed(1)},${(H - PAD.b).toFixed(1)} L${xy[0].x.toFixed(1)},${(H - PAD.b).toFixed(1)} Z`;
    return { ticks, Y, xy, line, area };
  }, [points, w]);

  if (points.length === 0) return <Text style={s.mu}>Log a weight to start the growth chart.</Text>;
  if (points.length === 1) return <Text style={s.mu}>{points[0].grams} g on {fmt(points[0].date)}. Log another weight to see the growth chart.</Text>;
  const pick = (e: GestureResponderEvent) => {
    if (!geo) return; const x = e.nativeEvent.locationX;
    let best = 0; geo.xy.forEach((p, i) => { if (Math.abs(p.x - x) < Math.abs(geo.xy[best].x - x)) best = i; }); setSel(best);
  };
  const last = geo?.xy[geo.xy.length - 1]; const shown = sel != null && geo ? geo.xy[sel] : null;
  const first = points[0], end = points[points.length - 1], change = end.grams - first.grams;
  return (<View>
    <Text style={s.mu}>{shown ? `${fmt(shown.date)} · ${shown.grams} g` : `${first.grams} g → ${end.grams} g (${change >= 0 ? '+' : ''}${change} g) since ${fmt(first.date)}`}</Text>
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ height: H, marginTop: 4 }}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={pick} onResponderMove={pick}
      onResponderRelease={() => setTimeout(() => setSel(null), 2500)} accessible accessibilityRole="image"
      accessibilityLabel={`Weight chart: ${points.length} weights from ${first.grams} grams on ${fmt(first.date)} to ${end.grams} grams on ${fmt(end.date)}`}>
      {geo && <Svg width={w} height={H}>
        {geo.ticks.map(v => <Line key={v} x1={PAD.l} x2={w - PAD.r} y1={geo.Y(v)} y2={geo.Y(v)} stroke={C.bd} strokeWidth={1} />)}
        {geo.ticks.map(v => <SvgText key={'l' + v} x={PAD.l - 6} y={geo.Y(v) + 4} fontSize={11} fill={C.mu} textAnchor="end">{gramsLabel(v)}</SvgText>)}
        <SvgText x={PAD.l} y={H - 6} fontSize={11} fill={C.mu}>{fmt(first.date)}</SvgText>
        <SvgText x={w - PAD.r} y={H - 6} fontSize={11} fill={C.mu} textAnchor="end">{fmt(end.date)}</SvgText>
        <Path d={geo.area} fill={C.ink} fillOpacity={0.08} />
        <Path d={geo.line} fill="none" stroke={C.ink} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {last && <Circle cx={last.x} cy={last.y} r={4} fill={C.ink} stroke={C.bg} strokeWidth={2} />}
        {last && !shown && <SvgText x={last.x - 8} y={last.y - 9} fontSize={12} fill={C.ink} textAnchor="end" fontWeight="600">{last.grams} g</SvgText>}
        {shown && <Line x1={shown.x} x2={shown.x} y1={PAD.t} y2={H - PAD.b} stroke={C.mu} strokeWidth={1} />}
        {shown && <Circle cx={shown.x} cy={shown.y} r={5} fill={C.ink} stroke={C.bg} strokeWidth={2} />}
      </Svg>}
    </View>
  </View>);
}
