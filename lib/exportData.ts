// "Download my data": everything the user has entered, as one JSON file. Free for every plan.
import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { File as FSFile, Paths } from 'expo-file-system';
import { supabase } from './supabase';
import { APP_NAME } from './brand';
import { today } from './logic';
import { getState, sync } from './store';

const strip = (rows: Record<string, any>[]) => rows.map(({ user_id, synced_at, ...r }) => r);

/** Builds the export (from the phone's copy, refreshed first when online). */
export async function buildExport() {
  await Promise.race([sync(), new Promise(r => setTimeout(r, 8000))]); // best effort: offline still exports the local copy
  const st = getState();
  const { data: auth } = await supabase.auth.getSession();
  const u = auth.session?.user;
  const [ns, urls, licence, handovers] = await Promise.all([
    supabase.from('notification_settings').select('feed_due,lay_soon,pairing_soon,notify_hour,timezone').maybeSingle().then(r => r.data, () => null),
    st.animal_photos.length ? supabase.storage.from('animal-photos').createSignedUrls(st.animal_photos.map(p => p.path), 7 * 24 * 3600).then(r => r.data ?? [], () => []) : Promise.resolve([]),
    supabase.from('licences').select('full_name,licence_no,region,licence_class,expires,address,phone').maybeSingle().then(r => r.data, () => null),
    supabase.from('transfers').select('code,animal_name,species,from_name,created_at,accepted_at,seller_licence,buyer_licence,seller_id,accepted_by')
      .then(r => (r.data ?? []).map(({ seller_id, accepted_by, ...t }) => ({ ...t, direction: seller_id === u?.id ? 'handed over' : 'received' })), () => []),
  ]);
  const urlOf = new Map((urls as { path: string | null; signedUrl: string }[]).map(x => [x.path, x.signedUrl]));
  return {
    exported_from: APP_NAME, exported_at: new Date().toISOString(), format_version: 1,
    account: { email: u?.email, created_at: u?.created_at, preferences: u?.user_metadata ?? {} },
    notification_settings: ns, wildlife_licence: licence, handovers,
    animals: strip(st.animals), events: strip(st.events), pairings: strip(st.pairings), season_settings: strip(st.season_settings),
    genes: strip(st.animal_genes), my_genes: strip(st.user_genes), incubation_logs: strip(st.incubation_logs),
    photos: strip(st.animal_photos).map(p => ({ ...p, download_url_valid_7_days: urlOf.get(p.path) ?? null })),
  };
}

/** Saves the export: a download on the web, the share sheet (save to Files, email, ...) on phones. */
export async function downloadMyData(): Promise<string | null> {
  try {
    const json = JSON.stringify(await buildExport(), null, 2);
    const name = `${APP_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-data-${today()}.json`;
    if (Platform.OS === 'web') {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); return null;
    }
    const f = new FSFile(Paths.cache, name);
    if (f.exists) f.delete();
    f.create(); await f.write(json);
    if (!(await Sharing.isAvailableAsync())) return 'Sharing is not available on this device.';
    await Sharing.shareAsync(f.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save your data' });
    return null;
  } catch (e: any) { return String(e?.message ?? e); }
}
