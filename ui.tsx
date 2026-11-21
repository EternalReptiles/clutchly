import React from 'react';
import { Platform, Pressable, Text, TextInput, View, StyleSheet, TextInputProps } from 'react-native';
export const C = { bg: '#fcfcf8', ink: '#141414', mu: '#6c6a62', bd: '#e0ddd3', card: '#fff', bad: '#b3261e' };
export const serif = Platform.select({ ios: 'Georgia', default: 'serif' });
export const Btn = ({ t, onPress, solid, danger }: { t: string; onPress: () => void; solid?: boolean; danger?: boolean }) => (
  <Pressable onPress={onPress} style={[s.btn, solid && { backgroundColor: C.ink }]}>
    <Text style={{ fontWeight: '600', color: solid ? C.bg : danger ? C.bad : C.ink }}>{t}</Text></Pressable>);
export const Card = ({ children, onPress }: any) => (
  <Pressable onPress={onPress} style={s.card}>{children}</Pressable>);
export const Input = (p: TextInputProps & { label?: string }) => (
  <View style={{ marginTop: 8 }}>{p.label && <Text style={s.mu}>{p.label}</Text>}
    <TextInput placeholderTextColor={C.mu} {...p} style={[s.in, p.style]} /></View>);
export const Chips = ({ opts, v, on }: { opts: string[]; v: string; on: (x: string) => void }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
    {opts.map(o => <Pressable key={o} onPress={() => on(o)} style={[s.btn, v === o && { backgroundColor: C.ink }]}>
      <Text style={{ color: v === o ? C.bg : C.ink }}>{o}</Text></Pressable>)}</View>);
export const s = StyleSheet.create({
  btn: { borderWidth: 1, borderColor: C.bd, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: C.card },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.bd, borderRadius: 12, padding: 12, marginVertical: 5 },
  in: { borderWidth: 1, borderColor: C.bd, borderRadius: 8, padding: 10, backgroundColor: C.bg, color: C.ink },
  mu: { color: C.mu, fontSize: 12 }, h: { fontFamily: serif, fontSize: 18, fontWeight: '600', color: C.ink },
  page: { flex: 1, backgroundColor: C.bg, padding: 14 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 } });
