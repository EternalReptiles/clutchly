// Offline-first data store.
// - The user's rows (animals, events, pairings, season_settings) are kept in memory and on the phone, so every screen
//   reads locally and works without signal.
// - Every change is applied locally at once and queued. The queue is sent in order whenever the server can be reached.
// - New rows get ids made on the phone, so a retried insert can never create a duplicate.
// - Pull: rows the server changed since the last sync (synced_at), plus deletions recorded in deleted_rows.
// - Conflicts: last write wins by the row's updated_at (enforced on the server; see migration 005 and the README).
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { setDateFormat } from './logic';

export type Table = 'animals' | 'events' | 'pairings' | 'season_settings' | 'animal_photos';
export const TABLES: Table[] = ['animals', 'events', 'pairings', 'season_settings', 'animal_photos'];
export type Row = Record<string, any>;
type Op = 'insert' | 'update' | 'upsert' | 'delete';
type Mutation = { mid: string; table: Table; op: Op; key: string; row?: Row };
export type SyncStatus = 'idle' | 'syncing' | 'offline';
export type State = {
  uid: string | null; ready: boolean;
  animals: Row[]; events: Row[]; pairings: Row[]; season_settings: Row[]; animal_photos: Row[];
  queue: Mutation[]; lastSync: string | null; lastDeleteId: number;
  status: SyncStatus; error: string | null; dateFormat: string;
};

const keyCol = (t: Table) => (t === 'season_settings' ? 'species' : 'id');
const keyOf = (t: Table, r: Row) => String(r[keyCol(t)]);
const empty = (): State => ({ uid: null, ready: false, animals: [], events: [], pairings: [], season_settings: [], animal_photos: [], queue: [],
  lastSync: null, lastDeleteId: 0, status: 'idle', error: null, dateFormat: 'auto' });

let state: State = empty();
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach(l => l()); };
export const getState = () => state;
export const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
/** Re-renders when the store changes. Derive lists with useMemo on the returned arrays. */
export const useStore = () => useSyncExternalStore(subscribe, getState, getState);

/** Random v4 UUID (ids made on the phone, so queued inserts never clash). */
export function uuid(): string {
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---------- persistence: each table in chunks (Android limits the size of one stored value) ----------
const CHUNK = 400;
const prefix = (uid: string) => `clutchly.v1.${uid}`;
const dirty = new Set<Table | 'meta'>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(...what: (Table | 'meta')[]) {
  what.forEach(w => dirty.add(w)); dirty.add('meta');
  if (persistTimer) return;
  persistTimer = setTimeout(persistNow, 400);
}
async function persistNow() {
  persistTimer = null; const s = state; if (!s.uid) return;
  const p = prefix(s.uid); const writes: [string, string][] = []; const meta: Row = { lastSync: s.lastSync, lastDeleteId: s.lastDeleteId, queue: s.queue, chunks: {} };
  const prevMeta = JSON.parse((await AsyncStorage.getItem(`${p}.meta`).catch(() => null)) || '{}');
  for (const t of TABLES) {
    const n = Math.ceil(s[t].length / CHUNK); meta.chunks[t] = n;
    if (dirty.has(t)) for (let i = 0; i < n; i++) writes.push([`${p}.${t}.${i}`, JSON.stringify(s[t].slice(i * CHUNK, (i + 1) * CHUNK))]);
    else meta.chunks[t] = prevMeta.chunks?.[t] ?? n;
  }
  writes.push([`${p}.meta`, JSON.stringify(meta)]);
  const stale: string[] = [];
  for (const t of TABLES) if (dirty.has(t)) for (let i = meta.chunks[t]; i < (prevMeta.chunks?.[t] ?? 0); i++) stale.push(`${p}.${t}.${i}`);
  dirty.clear();
  try { await AsyncStorage.multiSet(writes); if (stale.length) await AsyncStorage.multiRemove(stale); } catch { /* storage full: keep going in memory */ }
}
async function loadCache(uid: string): Promise<Partial<State>> {
  try {
    const p = prefix(uid); const meta = JSON.parse((await AsyncStorage.getItem(`${p}.meta`)) || 'null');
    if (!meta) return {};
    const out: Partial<State> = { lastSync: meta.lastSync ?? null, lastDeleteId: meta.lastDeleteId ?? 0, queue: meta.queue ?? [] };
    for (const t of TABLES) {
      const keys = Array.from({ length: meta.chunks?.[t] ?? 0 }, (_, i) => `${p}.${t}.${i}`);
      const vals = keys.length ? await AsyncStorage.multiGet(keys) : [];
      (out as any)[t] = vals.flatMap(([, v]) => (v ? JSON.parse(v) : []));
    }
    return out;
  } catch { return {}; }
}
export async function clearCache(uid: string) {
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter(k => k.startsWith(prefix(uid) + '.'));
  if (keys.length) await AsyncStorage.multiRemove(keys).catch(() => {});
}

// ---------- local changes ----------
const now = () => new Date().toISOString();
function applyLocal(t: Table, op: Op, key: string, row?: Row) {
  const k = keyCol(t);
  let rows = state[t];
  if (op === 'delete') {
    rows = rows.filter(r => String(r[k]) !== key);
    const extra: Partial<State> = {};
    if (t === 'animals') { // mirror the database's cascades
      extra.events = state.events.filter(e => e.animal_id !== key);
      extra.pairings = state.pairings.filter(p => p.female_id !== key && p.male_id !== key);
      extra.animal_photos = state.animal_photos.filter(p => p.animal_id !== key);
      schedulePersist('events', 'pairings', 'animal_photos');
    }
    set({ [t]: rows, ...extra } as Partial<State>);
  } else {
    const i = rows.findIndex(r => String(r[k]) === key);
    rows = i >= 0 ? rows.map((r, j) => (j === i ? { ...r, ...row } : r)) : [...rows, { ...row }];
    set({ [t]: rows } as Partial<State>);
  }
  schedulePersist(t);
}
function enqueue(m: Omit<Mutation, 'mid'>) {
  set({ queue: [...state.queue, { ...m, mid: uuid() }] }); schedulePersist('meta'); kick();
}
/** Adds a row. Returns it (with its new id). */
export function insert(t: Exclude<Table, 'season_settings'>, data: Row): Row {
  const row = { id: uuid(), created_at: now(), ...data, updated_at: now() };
  applyLocal(t, 'insert', row.id, row); enqueue({ table: t, op: 'insert', key: row.id, row: stripLocal(row) });
  return row;
}
export function insertMany(t: Exclude<Table, 'season_settings'>, data: Row[]): Row[] { return data.map(d => insert(t, d)); }
export function update(t: Exclude<Table, 'season_settings'>, id: string, patch: Row) {
  const row = { ...patch, updated_at: now() };
  applyLocal(t, 'update', id, row); enqueue({ table: t, op: 'update', key: id, row: stripLocal(row) });
}
export function remove(t: Table, key: string) { applyLocal(t, 'delete', key); enqueue({ table: t, op: 'delete', key }); }
/** season_settings is keyed by species: save the whole row. */
export function saveSeason(row: Row) {
  const r: Row = { ...row, updated_at: now() };
  applyLocal('season_settings', 'upsert', r.species, r); enqueue({ table: 'season_settings', op: 'upsert', key: r.species, row: stripLocal(r) });
}
// Columns the server owns; never sent.
const stripLocal = (r: Row) => { const { synced_at, user_id, ...rest } = r; return rest; };

// ---------- sync ----------
const isNetworkError = (e: any, status?: number) =>
  !status || status >= 500 || status === 401 || /fetch|network|timed? ?out|abort/i.test(String(e?.message ?? e));
async function send(m: Mutation): Promise<{ ok: true } | { ok: false; retry: boolean; message: string }> {
  const q = supabase.from(m.table); const k = keyCol(m.table);
  try {
    const res = m.op === 'insert' ? await q.upsert(m.row!, { onConflict: 'id', ignoreDuplicates: true })
      : m.op === 'upsert' ? await q.upsert(m.row!, { onConflict: 'user_id,species' })
      : m.op === 'update' ? await q.update(m.row!).eq(k, m.key)
      : await q.delete().eq(k, m.key);
    if (!res.error) return { ok: true };
    return { ok: false, retry: isNetworkError(res.error, res.status), message: res.error.message };
  } catch (e: any) { return { ok: false, retry: true, message: String(e?.message ?? e) }; }
}
async function flush(): Promise<boolean> {
  while (state.queue.length) {
    const m = state.queue[0];
    const r = await send(m);
    if (!r.ok && r.retry) return false; // offline: keep the queue
    if (!r.ok) { console.warn('[sync] change rejected', m.table, m.op, r.message); set({ error: `A change couldn't be saved (${r.message}). It has been undone.` }); } // rejected: drop it
    set({ queue: state.queue.filter(x => x.mid !== m.mid) }); schedulePersist('meta');
    if (!r.ok) set({ lastSync: null }); // reload everything to undo the rejected change locally
  }
  return true;
}
async function pullTable(t: Table, since: string | null): Promise<string | null> {
  let max = since; const k = keyCol(t);
  const pending = new Set(state.queue.filter(m => m.table === t).map(m => m.key));
  const incoming: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(t).select('*').order('synced_at').range(from, from + 999);
    if (since) q = q.gt('synced_at', since);
    const { data, error, status } = await q;
    if (error) throw Object.assign(new Error(error.message), { retry: isNetworkError(error, status) });
    incoming.push(...data);
    if (data.length < 1000) break;
  }
  if (!since) { // full load: replace everything except rows with unsent changes
    const keep = state[t].filter(r => pending.has(String(r[k])));
    set({ [t]: [...incoming.filter(r => !pending.has(String(r[k]))), ...keep] } as Partial<State>);
  } else if (incoming.length) {
    const map = new Map(state[t].map(r => [String(r[k]), r]));
    for (const r of incoming) if (!pending.has(String(r[k]))) map.set(String(r[k]), r);
    set({ [t]: [...map.values()] } as Partial<State>);
  }
  for (const r of incoming) if (!max || r.synced_at > max) max = r.synced_at;
  if (incoming.length || !since) schedulePersist(t);
  return max;
}
async function pull() {
  const since = state.lastSync ? new Date(new Date(state.lastSync).getTime() - 30_000).toISOString() : null; // small overlap; merging is idempotent
  const fresh = !since;
  // Deletions first, so a full reload doesn't need them.
  const del = await supabase.from('deleted_rows').select('id,table_name,row_key').gt('id', state.lastDeleteId).order('id').limit(5000);
  if (del.error) throw Object.assign(new Error(del.error.message), { retry: isNetworkError(del.error, del.status) });
  let lastDeleteId = state.lastDeleteId;
  if (!fresh) for (const d of del.data) {
    const t = d.table_name as Table; if (!TABLES.includes(t)) continue;
    if (state.queue.some(m => m.table === t && m.key === d.row_key)) continue;
    set({ [t]: state[t].filter(r => String(r[keyCol(t)]) !== d.row_key) } as Partial<State>); schedulePersist(t);
  }
  for (const d of del.data) lastDeleteId = Math.max(lastDeleteId, d.id);
  let max: string | null = state.lastSync;
  for (const t of TABLES) { const m = await pullTable(t, since); if (m && (!max || m > max)) max = m; }
  set({ lastSync: max ?? new Date(0).toISOString(), lastDeleteId }); schedulePersist('meta');
}

let running: Promise<any> | null = null; let retryTimer: ReturnType<typeof setTimeout> | null = null;
/** Send queued changes, then fetch what changed on the server. Safe to call any time. */
export function sync(): Promise<void> {
  if (!state.uid) return Promise.resolve();
  if (running) return running;
  running = (async () => {
    set({ status: 'syncing' });
    let offline = false;
    try {
      const sent = await flush();
      if (!sent) offline = true;
      else await pull();
    } catch (e: any) { offline = e?.retry !== false; if (!offline) set({ error: String(e?.message ?? e) }); }
    set({ status: offline ? 'offline' : 'idle', ready: true });
    if (retryTimer) clearTimeout(retryTimer);
    if (offline) retryTimer = setTimeout(() => sync(), 15_000);
    return offline;
  })().then(offline => { running = null; if (!offline && state.queue.length) kick(); }, () => { running = null; });
  return running;
}
let kickTimer: ReturnType<typeof setTimeout> | null = null;
function kick() { if (kickTimer) return; kickTimer = setTimeout(() => { kickTimer = null; sync(); }, 300); }

let appStateSub: { remove(): void } | null = null; let interval: ReturnType<typeof setInterval> | null = null;
/** Called when a user signs in: load their cached data, then sync. */
export async function start(uid: string) {
  if (state.uid === uid) return;
  stop();
  set({ ...empty(), dateFormat: state.dateFormat, uid });
  const cached = await loadCache(uid);
  if (state.uid !== uid) return;
  set({ ...cached, ready: !!cached.lastSync });
  appStateSub = AppState.addEventListener('change', s => { if (s === 'active') sync(); });
  interval = setInterval(() => sync(), 120_000);
  await sync();
}
/** Called on sign out: stop syncing and forget the in-memory data. */
export function stop() {
  appStateSub?.remove(); appStateSub = null;
  if (interval) clearInterval(interval); interval = null;
  if (retryTimer) clearTimeout(retryTimer); retryTimer = null;
  set({ ...empty(), dateFormat: state.dateFormat });
}
export const dismissError = () => set({ error: null });
/** Date display preference; screens re-render when it changes. */
export function applyDateFormat(f?: string | null) { const v = f || 'auto'; setDateFormat(v); if (state.dateFormat !== v) set({ dateFormat: v }); }
