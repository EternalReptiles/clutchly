// Choose one animal from a list (pairing female/male, calculator parents): each row shows the ID, its genes and species,
// so you can tell them apart without going back to the Animals tab. A search box appears when there are many.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fmt } from './logic';
import { C, Input, s } from './ui';
import { animalLabels } from './derived';

type A = { id: string; name: string; species: string; sex?: string | null; dob?: string | null; created_at?: string | null; status?: string | null };
export function AnimalChooser({ animals, value, onChange, morphs, label }: { animals: A[]; value?: string | null; onChange: (id: string) => void;
  morphs: Record<string, string>; label: string }) {
  const [q, setQ] = useState(''); const labels = animalLabels(animals); const many = animals.length > 8;
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = animals.filter(a => a.id === value || words.every(w => `${a.name} ${a.species} ${morphs[a.id] ?? ''}`.toLowerCase().includes(w)));
  return (<View style={{ marginTop: 4 }}>
    {many && <Input placeholder={`Search ${label.toLowerCase()}s by ID, species or gene`} value={q} onChangeText={setQ} accessibilityLabel={`Search ${label.toLowerCase()}s`} />}
    {shown.map(a => { const on = a.id === value;
      return <Pressable key={a.id} onPress={() => onChange(a.id)} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on}
        accessibilityLabel={`${labels.get(a.id) ?? a.name}, ${[morphs[a.id], a.species].filter(Boolean).join(', ')}`}
        style={[s.card, { marginTop: 6, marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }, on && { backgroundColor: C.ink, borderColor: C.ink }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: on ? C.bg : C.ink, fontWeight: '700' }}>{labels.get(a.id) ?? a.name}{a.status === 'Sold' ? ' (sold)' : ''}</Text>
          {morphs[a.id] ? <Text style={{ color: on ? C.bg : C.ink }}>{morphs[a.id]}</Text> : null}
          <Text style={{ color: on ? C.bg : C.mu, fontSize: 13 }}>{a.species}{a.dob ? ` · hatched ${fmt(a.dob)}` : ''}</Text></View>
        {on && <Text style={{ color: C.bg, fontWeight: '700' }}>✓</Text>}
      </Pressable>; })}
    {many && !shown.length && <Text style={[s.mu, { marginTop: 6 }]}>No {label.toLowerCase()}s match "{q.trim()}".</Text>}
  </View>);
}
