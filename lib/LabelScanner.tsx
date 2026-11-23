// The camera reading Clutchly QR labels: expo-camera on phones, the browser's camera on the web (lib/WebScanner.tsx).
// Calls onAnimal with the animal id from each label it reads (the caller decides what to do with it).
import { Platform, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { animalIdFrom } from './labels';
import { WebScanner, webCameraAvailable } from './WebScanner';
import { Btn, C, s } from './ui';

export const scanAvailable = () => Platform.OS !== 'web' || webCameraAvailable();

export function LabelScanner({ onAnimal, onOther, hint }: { onAnimal: (id: string) => void; onOther: () => void; hint: string }) {
  const [perm, ask] = useCameraPermissions();
  const handle = (data: string) => { const id = animalIdFrom(data); if (id) onAnimal(id); else onOther(); };
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
