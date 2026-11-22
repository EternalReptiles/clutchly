// Scan a Clutchly QR label to open that animal (phones; on the web, labels open through the phone's camera app).
import { useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useStore } from '../lib/store';
import { animalIdFrom } from '../lib/labels';
import { Btn, C, s } from '../lib/ui';

export default function Scan() {
  const r = useRouter(); const [perm, ask] = useCameraPermissions(); const { animals } = useStore();
  const [msg, setMsg] = useState(''); const busy = useRef(false);
  if (Platform.OS === 'web') return <View style={s.page}><Text style={s.mu}>Scan labels with your phone: in the Clutchly app, tap Scan on the Animals tab, or point your phone's camera app at the label.</Text></View>;
  if (!perm) return <View style={s.page} />;
  if (!perm.granted) return <View style={s.page}>
    <Text style={s.mu}>Clutchly needs the camera to read the QR code on a label.</Text>
    <View style={{ marginTop: 10 }}><Btn solid t={perm.canAskAgain ? 'Allow camera' : 'Open settings to allow the camera'} onPress={ask} /></View></View>;
  const onScan = ({ data }: { data: string }) => {
    if (busy.current) return;
    const id = animalIdFrom(data);
    if (!id) return setMsg('That QR code isn\'t a Clutchly label.');
    if (!animals.some(a => a.id === id)) return setMsg('That label is for an animal that isn\'t in your collection.');
    busy.current = true; r.replace(`/animal/${id}`);
  };
  return (<View style={{ flex: 1, backgroundColor: '#000' }}>
    <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScan} />
    <View style={{ position: 'absolute', left: 16, right: 16, bottom: 40, backgroundColor: C.bg, borderRadius: 12, padding: 12 }}>
      <Text style={{ color: C.ink, textAlign: 'center' }}>{msg || 'Point the camera at an animal\'s label.'}</Text></View>
  </View>);
}
