// Scan a Clutchly QR label to open that animal. Phones use expo-camera; the web app uses the browser's camera
// (lib/WebScanner.tsx). Any phone's Camera app also opens a label, as a link to the web app.
import { useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useStore } from '../lib/store';
import { animalIdFrom } from '../lib/labels';
import { WebScanner, webCameraAvailable } from '../lib/WebScanner';
import { Btn, C, s } from '../lib/ui';

export default function Scan() {
  const r = useRouter(); const [perm, ask] = useCameraPermissions(); const { animals } = useStore();
  const [msg, setMsg] = useState(''); const busy = useRef(false);
  const handle = (data: string) => {
    if (busy.current) return;
    const id = animalIdFrom(data);
    if (!id) return setMsg('That QR code isn\'t a Clutchly label.');
    if (!animals.some(a => a.id === id)) return setMsg('That label is for an animal that isn\'t in your collection.');
    busy.current = true; r.replace(`/animal/${id}`);
  };
  const hint = msg || 'Point the camera at an animal\'s label.';
  if (Platform.OS === 'web') return webCameraAvailable() ? <WebScanner onCode={handle} hint={hint} />
    : <View style={s.page}><Text style={s.mu}>This browser can't use the camera. Point your phone's Camera app at the label instead: it opens the animal's page.</Text></View>;
  if (!perm) return <View style={s.page} />;
  if (!perm.granted) return <View style={s.page}>
    <Text style={s.mu}>Clutchly needs the camera to read the QR code on a label.</Text>
    <View style={{ marginTop: 10 }}><Btn solid t={perm.canAskAgain ? 'Allow camera' : 'Open settings to allow the camera'} onPress={ask} /></View></View>;
  return (<View style={{ flex: 1, backgroundColor: '#000' }}>
    <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => handle(data)} />
    <View style={{ position: 'absolute', left: 16, right: 16, bottom: 40, backgroundColor: C.bg, borderRadius: 12, padding: 12 }}>
      <Text style={{ color: C.ink, textAlign: 'center' }}>{hint}</Text></View>
  </View>);
}
