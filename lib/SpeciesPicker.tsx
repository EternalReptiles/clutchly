import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, SectionList, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from './ModalSafeArea';
import { GROUPS, searchSpecies } from './species';
import { Btn, C, s } from './ui';

/** A field showing the chosen species; tapping opens a searchable, grouped list. */
export function SpeciesPicker({ label = 'Species', value, onChange, exclude = [] }:
  { label?: string; value?: string | null; onChange: (name: string) => void; exclude?: string[] }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState('');
  const sections = useMemo(() => {
    const hits = searchSpecies(q).filter(x => !exclude.includes(x.name));
    return GROUPS.map(g => ({ title: g, data: hits.filter(x => x.group === g) })).filter(x => x.data.length);
  }, [q, exclude]);
  const pick = (name: string) => { onChange(name); setOpen(false); setQ(''); };
  return (<View style={{ marginTop: 8 }}>
    {label ? <Text style={s.mu}>{label}</Text> : null}
    <Pressable onPress={() => setOpen(true)} style={s.in} accessibilityRole="button" accessibilityLabel={label || 'Choose species'}>
      <Text style={{ color: value ? C.ink : C.mu }}>{value || 'Choose species'}</Text></Pressable>
    <Modal visible={open} animationType={Platform.OS === 'web' ? 'none' : 'slide'} onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={[s.row, { padding: 14, paddingBottom: 6 }]}>
          <Text style={[s.h, { flex: 1 }]}>Choose species</Text><Btn t="Cancel" onPress={() => { setOpen(false); setQ(''); }} /></View>
        <View style={{ paddingHorizontal: 14 }}>
          <TextInput value={q} onChangeText={setQ} placeholder="Search name or Latin name" placeholderTextColor={C.mu} autoFocus
            autoCorrect={false} autoCapitalize="none" accessibilityLabel="Search species" keyboardAppearance="light" style={s.in} /></View>
        <SectionList sections={sections} keyExtractor={x => x.name} keyboardShouldPersistTaps="handled" stickySectionHeadersEnabled={false}
          contentContainerStyle={{ padding: 14, paddingTop: 4 }}
          ListEmptyComponent={<Text style={[s.mu, { marginTop: 12 }]}>No match. Choose Other for species not listed.</Text>}
          renderSectionHeader={({ section }) => <Text style={[s.h, { fontSize: 15, marginTop: 14, marginBottom: 2 }]}>{section.title}</Text>}
          renderItem={({ item }) => <Pressable onPress={() => pick(item.name)} accessibilityRole="button" accessibilityLabel={item.name}
            style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.bd, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}><Text style={{ color: C.ink, fontWeight: item.name === value ? '700' : '400' }}>{item.name}</Text>
              {item.latin ? <Text style={[s.mu, { fontStyle: 'italic' }]}>{item.latin}</Text> : null}</View>
            {item.name === value ? <Text style={{ color: C.ink }}>✓</Text> : null}</Pressable>} />
      </SafeAreaView>
    </Modal>
  </View>);
}
