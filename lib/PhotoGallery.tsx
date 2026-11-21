import { useMemo, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addPhoto, byNewest, deletePhoto, setCover, useSignedUrls, type Photo } from './photos';
import { useStore } from './store';
import { usePlan } from './plan';
import { goPro } from './goPro';
import { Btn, C, confirm, notify, s } from './ui';

/** Photos of one animal: thumbnails, add (library or camera), full-screen view with cover and delete. */
export function PhotoGallery({ animalId }: { animalId: string }) {
  const st = useStore();
  const photos = useMemo(() => (st.animal_photos.filter(p => p.animal_id === animalId) as Photo[]).sort(byNewest), [st.animal_photos, animalId]);
  const urls = useSignedUrls(photos.map(p => p.path));
  const [busy, setBusy] = useState(false); const [open, setOpen] = useState<Photo | null>(null);
  const plan = usePlan();
  const add = async (src: 'library' | 'camera') => { if (!plan.isPro) return goPro('Photos are part of Pro. Photos you added before stay visible.'); setBusy(true); const err = await addPhoto(animalId, src); setBusy(false); if (err) notify('Photo not added', err); };
  const del = (p: Photo) => confirm('Delete photo?', 'This cannot be undone.', 'Delete', () => { setOpen(null); deletePhoto(p); });
  return (<View style={{ marginTop: 14 }}>
    <Text style={s.h}>Photos</Text>
    {photos.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }} contentContainerStyle={{ gap: 8 }}>
      {photos.map(p => <Pressable key={p.id} onPress={() => setOpen(p)} accessibilityRole="imagebutton" accessibilityLabel={p.is_cover ? 'Cover photo' : 'Photo'}>
        <Thumb uri={urls[p.path]} size={96} />
        {p.is_cover && <Text style={[s.mu, { textAlign: 'center', marginTop: 2 }]}>Cover</Text>}</Pressable>)}
    </ScrollView>}
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
      <Btn disabled={busy} t={busy ? 'Uploading…' : plan.isPro ? 'Add photo' : 'Add photo (Pro)'} onPress={() => add('library')} />
      {Platform.OS !== 'web' && <Btn disabled={busy} t="Take photo" onPress={() => add('camera')} />}</View>
    <Modal visible={!!open} animationType={Platform.OS === 'web' ? 'none' : 'fade'} onRequestClose={() => setOpen(null)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        {open && <>
          <View style={{ flex: 1, padding: 14 }}>{urls[open.path]
            ? <Image source={{ uri: urls[open.path] }} style={{ flex: 1 }} resizeMode="contain" accessibilityLabel="Photo, full size" />
            : <Text style={s.mu}>Photo can't be shown offline.</Text>}</View>
          <View style={{ flexDirection: 'row', gap: 8, padding: 14, justifyContent: 'center' }}>
            {!open.is_cover && <Btn t="Set as cover" onPress={() => { setCover(open); setOpen(null); }} />}
            <Btn danger t="Delete" onPress={() => del(open)} /><Btn solid t="Close" onPress={() => setOpen(null)} /></View>
        </>}
      </SafeAreaView>
    </Modal>
  </View>);
}

/** Square photo, or an empty frame while loading / offline. */
export function Thumb({ uri, size, label }: { uri?: string; size: number; label?: string }) {
  const box = { width: size, height: size, borderRadius: 8, borderWidth: 1, borderColor: C.bd, backgroundColor: C.bg };
  return uri ? <Image source={{ uri }} style={box} resizeMode="cover" accessibilityLabel={label} />
    : <View style={[box, { alignItems: 'center', justifyContent: 'center' }]}><Text style={s.mu}>{label ? label[0] : ''}</Text></View>;
}
