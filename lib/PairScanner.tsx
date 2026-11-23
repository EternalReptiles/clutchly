// Scan two labels to choose a pairing's female and male: each label fills whichever one it is (by the animal's sex),
// and the camera closes once both are chosen. Used on the new pairing screen.
import { useRef, useState } from 'react';
import { Modal, Platform, Text, View } from 'react-native';
import { SafeAreaView } from './ModalSafeArea';
import { LabelScanner } from './LabelScanner';
import { Btn, C, s } from './ui';

type A = { id: string; name: string; sex: string; status: string };
export function PairScanner({ open, onClose, animals, female, male, onPick }: { open: boolean; onClose: () => void; animals: A[];
  female?: string | null; male?: string | null; onPick: (role: 'female_id' | 'male_id', id: string) => void }) {
  const [msg, setMsg] = useState('');
  // The camera reads the same label many times a second: act on each label once, until the next one.
  const last = useRef(''); const picked = useRef<{ f?: string | null; m?: string | null }>({});
  if (!open) return null;
  picked.current = { f: picked.current.f ?? female, m: picked.current.m ?? male };
  const name = (id?: string | null) => animals.find(a => a.id === id)?.name;
  const got = (id: string) => {
    if (id === last.current) return; last.current = id;
    const a = animals.find(x => x.id === id);
    if (!a) return setMsg('That label is for an animal that isn\'t in your collection.');
    if (a.status === 'Sold') return setMsg(`${a.name} is marked Sold.`);
    if (a.sex !== 'Female' && a.sex !== 'Male') return setMsg(`${a.name}'s sex isn't set. Set it on its page first.`);
    const role = a.sex === 'Female' ? 'female_id' : 'male_id';
    onPick(role, a.id); picked.current = { ...picked.current, [role === 'female_id' ? 'f' : 'm']: a.id };
    const { f, m } = picked.current;
    if (f && m) { close(); return; }
    setMsg(`${a.sex}: ${a.name} ✓. Now scan the ${a.sex === 'Female' ? 'male' : 'female'}.`);
  };
  const close = () => { last.current = ''; picked.current = {}; setMsg(''); onClose(); };
  const hint = msg || (female || male ? `${female ? `Female: ${name(female)}` : `Male: ${name(male)}`}. Scan the ${female ? 'male' : 'female'}.` : 'Scan the female\'s and the male\'s labels, in either order.');
  return (<Modal visible animationType={Platform.OS === 'web' ? 'none' : 'slide'} onRequestClose={close}>
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[s.row, { padding: 14, paddingBottom: 8 }]}><Text style={[s.h, { flex: 1 }]}>Scan labels</Text><Btn t="Done" onPress={close} /></View>
      <View style={{ flex: 1 }}><LabelScanner onAnimal={got} onOther={() => setMsg('That QR code isn\'t a Clutchly label.')} hint={hint} /></View>
    </SafeAreaView>
  </Modal>);
}
