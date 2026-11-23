// Scan a Clutchly QR label to open that animal (lib/LabelScanner.tsx). Any phone's Camera app also opens a label, as a
// link to the web app.
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useStore } from '../lib/store';
import { LabelScanner } from '../lib/LabelScanner';

export default function Scan() {
  const r = useRouter(); const { animals } = useStore(); const [msg, setMsg] = useState(''); const busy = useRef(false);
  const open = (id: string) => {
    if (busy.current) return;
    if (!animals.some(a => a.id === id)) return setMsg('That label is for an animal that isn\'t in your collection.');
    busy.current = true; r.replace(`/animal/${id}`);
  };
  return <LabelScanner onAnimal={open} onOther={() => setMsg('That QR code isn\'t a Clutchly label.')} hint={msg || 'Point the camera at an animal\'s label.'} />;
}
