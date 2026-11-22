// QR scanning in the web app: the browser's camera (getUserMedia) and jsQR to read the code, so it works in every
// browser including iPhone Safari (which has no built-in barcode reader). Web only; phones use expo-camera.
import { createElement, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import jsQR from 'jsqr';
import { C, s } from './ui';

export const webCameraAvailable = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/** Calls onCode with each QR code's text (keeps scanning until the page leaves). */
export function WebScanner({ onCode, hint }: { onCode: (text: string) => void; hint: string }) {
  const video = useRef<HTMLVideoElement | null>(null); const [err, setErr] = useState('');
  const cb = useRef(onCode); cb.current = onCode;
  useEffect(() => {
    let stream: MediaStream | null = null, timer: ReturnType<typeof setTimeout> | null = null, stopped = false;
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const tick = () => {
      if (stopped) return;
      const v = video.current;
      if (v && v.readyState >= 2 && v.videoWidth) {
        const scale = Math.min(1, 800 / Math.max(v.videoWidth, v.videoHeight)); // smaller frames decode faster
        canvas.width = Math.round(v.videoWidth * scale); canvas.height = Math.round(v.videoHeight * scale);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) cb.current(code.data);
      }
      timer = setTimeout(tick, 150);
    };
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then(st => {
      if (stopped) { st.getTracks().forEach(t => t.stop()); return; }
      stream = st; const v = video.current!; v.srcObject = st; v.play().catch(() => {}); tick();
    }, (e: any) => setErr(/NotAllowed|Permission/i.test(String(e?.name ?? e)) ? 'The browser wasn\'t allowed to use the camera. Allow it for clutchly.com.au (on iPhone: Settings > Apps > Safari > Camera) and try again.'
      : /NotFound|Overconstrained/i.test(String(e?.name ?? e)) ? 'No camera found on this device.' : `Couldn't start the camera (${e?.message ?? e}).`));
    return () => { stopped = true; if (timer) clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()); };
  }, []);
  if (err) return <View style={s.page}><Text style={{ color: C.ink }}>{err}</Text>
    <Text style={[s.mu, { marginTop: 8 }]}>You can also point your phone's Camera app at the label: it opens the animal's page.</Text></View>;
  return (<View style={{ flex: 1, backgroundColor: '#000' }}>
    {createElement('video', { ref: video, playsInline: true, muted: true, autoPlay: true, 'aria-label': 'Camera',
      style: { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 } })}
    <View style={{ position: 'absolute', left: 16, right: 16, bottom: 40, backgroundColor: C.bg, borderRadius: 12, padding: 12 }}>
      <Text style={{ color: C.ink, textAlign: 'center' }}>{hint}</Text></View>
  </View>);
}
