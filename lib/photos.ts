// Animal photos: pick or take, shrink to 1200 px on the long edge, upload to the private bucket, show via signed URLs.
// Files live at <user id>/<animal id>/<photo id>.jpg; storage policies only let a user reach their own folder.
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File as FSFile } from 'expo-file-system';
import { supabase } from './supabase';
import { getState, insert, remove, update, uuid, type Row } from './store';

const BUCKET = 'animal-photos';
const LONG_EDGE = 1200;
export type Photo = { id: string; animal_id: string; path: string; is_cover: boolean; created_at?: string };

/** Adds a photo to an animal. Returns an error message, or null when done or cancelled. */
export async function addPhoto(animalId: string, source: 'library' | 'camera'): Promise<string | null> {
  const uid = getState().uid; if (!uid) return 'Not signed in.';
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return "Camera access is off for Clutchly. Turn it on in your phone's Settings.";
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  try {
    // Resize (only if larger) and re-encode as JPEG, which also drops location data from the original.
    const ctx = ImageManipulator.manipulate(a.uri);
    if (Math.max(a.width, a.height) > LONG_EDGE) ctx.resize(a.width >= a.height ? { width: LONG_EDGE } : { height: LONG_EDGE });
    const out = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    const body = Platform.OS === 'web' ? await (await fetch(out.uri)).blob() : await new FSFile(out.uri).arrayBuffer();
    const id = uuid(); const path = `${uid}/${animalId}/${id}.jpg`;
    const up = await supabase.storage.from(BUCKET).upload(path, body, { contentType: 'image/jpeg', upsert: false });
    if (up.error) return /fetch|network|timed out/i.test(up.error.message) ? 'Adding photos needs a connection. Try again when you have signal.' : up.error.message;
    const first = !getState().animal_photos.some(p => p.animal_id === animalId);
    insert('animal_photos', { id, animal_id: animalId, path, is_cover: first });
    return null;
  } catch (e: any) {
    return /fetch|network/i.test(String(e?.message)) ? 'Adding photos needs a connection. Try again when you have signal.' : String(e?.message ?? e);
  }
}

/** Makes this photo the animal's cover (shown on the Animals list). */
export function setCover(p: Photo) {
  for (const o of getState().animal_photos.filter(x => x.animal_id === p.animal_id)) {
    if (o.id === p.id && !o.is_cover) update('animal_photos', o.id, { is_cover: true });
    else if (o.id !== p.id && o.is_cover) update('animal_photos', o.id, { is_cover: false });
  }
}
/** Deletes a photo. The file is removed now if online; otherwise the server removes it within the hour. */
export function deletePhoto(p: Photo) {
  const rest = getState().animal_photos.filter(x => x.animal_id === p.animal_id && x.id !== p.id);
  remove('animal_photos', p.id);
  if (p.is_cover && rest.length) setCover(rest.sort(byNewest)[0] as Photo);
  supabase.storage.from(BUCKET).remove([p.path]).catch(() => {});
  urlCache.delete(p.path);
}
export const byNewest = (a: Row, b: Row) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
export const coverOf = (photos: Row[], animalId: string) => {
  const mine = photos.filter(p => p.animal_id === animalId);
  return (mine.find(p => p.is_cover) ?? mine.sort(byNewest)[0]) as Photo | undefined;
};

// Signed URLs last an hour; reuse them so images don't reload on every screen.
const urlCache = new Map<string, { url: string; exp: number }>();
const fromCache = (paths: string[]) => Object.fromEntries(paths.flatMap(p => { const c = urlCache.get(p); return c ? [[p, c.url]] : []; }));
/** Signed URLs for the given file paths (empty until loaded, or while offline). */
export function useSignedUrls(paths: string[]): Record<string, string> {
  const key = paths.join('|');
  const [urls, setUrls] = useState<Record<string, string>>(() => fromCache(paths));
  useEffect(() => {
    let off = false;
    const need = paths.filter(p => (urlCache.get(p)?.exp ?? 0) < Date.now() + 5 * 60_000);
    if (!need.length) { setUrls(fromCache(paths)); return; }
    supabase.storage.from(BUCKET).createSignedUrls(need, 3600).then(({ data }) => {
      for (const d of data ?? []) if (d.signedUrl && d.path) urlCache.set(d.path, { url: d.signedUrl, exp: Date.now() + 3600_000 });
      if (!off) setUrls(fromCache(paths));
    }, () => {});
    return () => { off = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return urls;
}
