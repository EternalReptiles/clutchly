import React, { useId, useState } from 'react';
import { Alert, InputAccessoryView, Keyboard, Platform, Pressable, Text, TextInput, View, StyleSheet, TextInputProps } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { fmt, fmtMD, iso } from './logic';

export const C = { bg: '#fcfcf8', ink: '#141414', mu: '#6c6a62', bd: '#e0ddd3', card: '#fff', bad: '#b3261e' };
export const serif = Platform.select({ ios: 'Georgia', default: 'serif' });

// Alert.alert does nothing on web, so fall back to the browser's dialogs there.
export const notify = (title: string, msg?: string) =>
  Platform.OS === 'web' ? window.alert(msg ? `${title}\n\n${msg}` : title) : Alert.alert(title, msg);
export const confirm = (title: string, msg: string, okText: string, onOk: () => void) => {
  if (Platform.OS === 'web') { if (window.confirm(`${title}\n\n${msg}`)) onOk(); return; }
  Alert.alert(title, msg, [{ text: 'Cancel', style: 'cancel' }, { text: okText, style: 'destructive', onPress: onOk }]);
};

export const Btn = ({ t, onPress, solid, danger, disabled }:
  { t: string; onPress: () => void; solid?: boolean; danger?: boolean; disabled?: boolean }) => (
  <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
    style={[s.btn, solid && { backgroundColor: C.ink, borderColor: C.ink }, disabled && { opacity: 0.5 }]}>
    <Text style={{ fontWeight: '600', textAlign: 'center', color: solid ? C.bg : danger ? C.bad : C.ink }}>{t}</Text></Pressable>);
// A non-tappable card must be a plain View: a disabled Pressable marks everything inside it as disabled for screen readers.
export const Card = ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => onPress
  ? <Pressable onPress={onPress} style={s.card}>{children}</Pressable>
  : <View style={s.card}>{children}</View>;
export const Label = ({ t }: { t: string }) => <Text style={[s.mu, { marginTop: 10 }]}>{t}</Text>;
// iPhone number keypads have no return key, so number fields get a bar above the keypad with a Done button.
const NUMERIC = ['number-pad', 'decimal-pad', 'numeric', 'phone-pad'];
export const Input = (p: TextInputProps & { label?: string }) => {
  const id = useId(); const bar = Platform.OS === 'ios' && NUMERIC.includes(p.keyboardType ?? '');
  return (<View style={{ marginTop: 8 }}>{p.label && <Text style={s.mu}>{p.label}</Text>}
    <TextInput placeholderTextColor={C.mu} keyboardAppearance="light" selectionColor={C.ink} cursorColor={C.ink} accessibilityLabel={p.label ?? p.placeholder}
      inputAccessoryViewID={bar ? id : undefined} {...p} style={[s.in, p.style]} />
    {bar && <InputAccessoryView nativeID={id}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: '#f1f0ea', borderTopWidth: 1, borderTopColor: C.bd, paddingHorizontal: 12, paddingVertical: 6 }}>
        <Pressable onPress={() => Keyboard.dismiss()} accessibilityRole="button" hitSlop={10} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: C.ink }}>
          <Text style={{ color: C.bg, fontWeight: '700' }}>Done</Text></Pressable></View>
    </InputAccessoryView>}</View>);
};
/** Option buttons. `v` is the selected option, or a list of them for multi-select. */
export const Chips = ({ opts, v, on }: { opts: string[]; v: string | string[]; on: (x: string) => void }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
    {opts.map(o => { const sel = Array.isArray(v) ? v.includes(o) : v === o;
      return <Pressable key={o} onPress={() => on(o)} accessibilityRole="button" aria-selected={sel} style={[s.btn, sel && { backgroundColor: C.ink, borderColor: C.ink }]}>
      <Text style={{ color: sel ? C.bg : C.ink }}>{o}</Text></Pressable>; })}</View>);

/**
 * Date picker field.
 *  mode "date"      value is 'YYYY-MM-DD'
 *  mode "monthDay"  value is 'MM-DD' (repeats every year, e.g. season settings)
 * Pass `optional` to show a Clear button.
 */
export function DateField({ label, value, onChange, mode = 'date', optional }:
  { label?: string; value?: string | null; onChange: (v: string | null) => void; mode?: 'date' | 'monthDay'; optional?: boolean }) {
  const [open, setOpen] = useState(false);
  const toDate = () => value ? new Date(`${mode === 'monthDay' ? '2000-' + value : value}T12:00:00`) : new Date();
  const fromDate = (d: Date) => mode === 'monthDay' ? iso(d).slice(5) : iso(d);
  const shown = value ? (mode === 'monthDay' ? fmtMD(value) : fmt(value)) : 'Not set';

  let control: React.ReactNode;
  if (Platform.OS === 'web') {
    // Browser's native date input. For month-day we use a fixed leap year so 29 Feb is allowed.
    control = React.createElement('input', {
      type: 'date', 'aria-label': label,
      value: value ? (mode === 'monthDay' ? '2000-' + value : value) : '',
      onChange: (e: any) => onChange(e.target.value ? (mode === 'monthDay' ? e.target.value.slice(5) : e.target.value) : null),
      style: { ...StyleSheet.flatten(s.in), fontSize: 15, fontFamily: 'inherit', flex: 1 },
    });
  } else {
    const press = () => {
      if (mode === 'monthDay') setOpen(o => !o);   // our own month + day chooser (no year)
      else if (Platform.OS === 'android') {
        DateTimePickerAndroid.open({ value: toDate(), mode: 'date',
          onChange: (e, d) => { if (e.type === 'set' && d) onChange(fromDate(d)); } });
      } else setOpen(o => !o);
    };
    control = <Pressable onPress={press} style={[s.in, { flex: 1 }]} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={{ color: value ? C.ink : C.mu }}>{shown}</Text></Pressable>;
  }
  return (<View style={{ marginTop: 8 }}>
    {label && <Text style={s.mu}>{label}</Text>}
    <View style={s.row}>{control}{optional && value ? <Btn t="Clear" onPress={() => { onChange(null); setOpen(false); }} /> : null}</View>
    {open && mode === 'monthDay' && Platform.OS !== 'web' && <View style={s.card}>
      <MonthDayPicker value={value} onChange={onChange} />
      <View style={{ alignItems: 'center', marginTop: 8 }}><Btn solid t="Done" onPress={() => setOpen(false)} /></View></View>}
    {open && mode === 'date' && Platform.OS === 'ios' && <View style={[s.card, { alignItems: 'center' }]}>
      <DateTimePicker value={toDate()} mode="date" display="inline" themeVariant="light" accentColor={C.ink}
        onChange={(_e, d) => { if (d) onChange(fromDate(d)); }} />
      <Btn solid t="Done" onPress={() => setOpen(false)} /></View>}
  </View>);
}

/** Month and day for dates that repeat every year ('MM-DD'): month buttons, then the days of that month. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function MonthDayPicker({ value, onChange }: { value?: string | null; onChange: (v: string) => void }) {
  const m = value ? parseInt(value.slice(0, 2), 10) : new Date().getMonth() + 1;
  const d = value ? parseInt(value.slice(3, 5), 10) : 0;
  const pad = (n: number) => String(n).padStart(2, '0');
  const pick = (month: number, day: number) => onChange(`${pad(month)}-${pad(Math.min(day, DAYS_IN[month - 1]))}`);
  const cell = (sel: boolean) => [s.btn, { width: '13%' as const, paddingHorizontal: 0, alignItems: 'center' as const }, sel && { backgroundColor: C.ink, borderColor: C.ink }];
  return (<View>
    <Text style={s.mu}>Month</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
      {MONTHS.map((n, i) => <Pressable key={n} onPress={() => pick(i + 1, d || 1)} accessibilityRole="button" aria-selected={m === i + 1}
        style={[s.btn, { width: '15%', paddingHorizontal: 0, alignItems: 'center' }, m === i + 1 && { backgroundColor: C.ink, borderColor: C.ink }]}>
        <Text style={{ color: m === i + 1 ? C.bg : C.ink }}>{n}</Text></Pressable>)}</View>
    <Text style={[s.mu, { marginTop: 10 }]}>Day</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
      {Array.from({ length: DAYS_IN[m - 1] }, (_, i) => i + 1).map(n => <Pressable key={n} onPress={() => pick(m, n)} accessibilityRole="button"
        aria-selected={d === n} style={cell(d === n)}><Text style={{ color: d === n ? C.bg : C.ink }}>{n}</Text></Pressable>)}</View>
  </View>);
}

export const s = StyleSheet.create({
  btn: { borderWidth: 1, borderColor: C.bd, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: C.card },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.bd, borderRadius: 12, padding: 12, marginVertical: 5 },
  in: { borderWidth: 1, borderColor: C.bd, borderRadius: 8, padding: 10, backgroundColor: C.bg, color: C.ink },
  mu: { color: C.mu, fontSize: 12 }, h: { fontFamily: serif, fontSize: 18, fontWeight: '600', color: C.ink },
  page: { flex: 1, backgroundColor: C.bg, padding: 14 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 } });
