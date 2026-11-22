// Handing an animal over to its buyer (migration 015_transfers.sql). The seller makes a one-time link; the buyer
// opens it, signs in and accepts, and gets their own copy of the animal and its history. These need a connection:
// the copy is made on the server.
import { Platform, Share } from 'react-native';
import brand from '../brand.json';
import { supabase } from './supabase';
import { getState } from './store';

export type Transfer = { code: string; animal_id: string; from_name: string | null; include_notes: boolean;
  created_at: string; expires_at: string; accepted_at: string | null };
export type Preview = { code: string; from_name: string | null; expires_at: string; accepted: boolean; mine: boolean;
  name: string; species: string; sex: string; dob: string | null; feeds: number; sheds: number; weights: number;
  genes: { name: string; state: string; het_pct: number | null }[] };

export const PENDING_KEY = 'clutchly.pendingClaim';
export const FROM_KEY = 'clutchly.handoverFrom';

/** The code as typed or pasted (whole link, any case, with or without the dash) → 'K7QXM3PAZ9'. */
export const cleanCode = (s: string) => (s.trim().split('/').pop() ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();
export const showCode = (c: string) => c.length === 10 ? `${c.slice(0, 5)}-${c.slice(5)}` : c;
export const claimLink = (c: string) => `${brand.siteUrl.replace(/\/+$/, '')}/app/claim/${showCode(c)}`;

/** The newest handover for an animal (null if none), or undefined when offline. */
export async function latestTransfer(animalId: string): Promise<Transfer | null | undefined> {
  const r = await supabase.from('transfers').select('*').eq('animal_id', animalId).order('created_at', { ascending: false }).limit(1);
  return r.error ? undefined : (r.data[0] as Transfer) ?? null;
}
export async function createTransfer(animalId: string, fromName: string, includeNotes: boolean) {
  const r = await supabase.rpc('create_transfer', { p_animal: animalId, p_from_name: fromName, p_include_notes: includeNotes });
  if (r.error) throw new Error(friendly(r.error.message));
  return r.data as string;
}
export async function cancelTransfer(code: string) { const r = await supabase.rpc('cancel_transfer', { p_code: code }); if (r.error) throw new Error(friendly(r.error.message)); }
export async function previewTransfer(code: string): Promise<Preview | null> {
  const r = await supabase.rpc('transfer_preview', { p_code: code });
  if (r.error) throw new Error(friendly(r.error.message));
  return r.data as Preview | null;
}
export async function acceptTransfer(code: string): Promise<string> {
  const r = await supabase.rpc('accept_transfer', { p_code: code });
  if (r.error) throw new Error(friendly(r.error.message));
  return r.data as string;
}

export function friendly(m: string) {
  if (/transfer_not_found/.test(m)) return 'This link has expired or was cancelled. Ask the seller for a new one.';
  if (/transfer_used/.test(m)) return 'This animal has already been added to a collection.';
  if (/transfer_own_animal/.test(m)) return 'This is your own animal. Send the link to the buyer.';
  if (/free_limit_reached/.test(m)) return `Free accounts can have up to ${getState().plan.freeAnimals} animals (Sold ones don't count). Go Pro, or mark an animal Sold, to add this one.`;
  if (/not_signed_in/.test(m)) return 'Sign in first.';
  if (/fetch|network/i.test(m)) return 'No connection. Handovers need the internet; try again when you\'re online.';
  return m;
}

/** Share sheet on phones; the browser's share, or copy to the clipboard, on the web. Returns 'copied' when it copied. */
export async function shareLink(name: string, code: string): Promise<'shared' | 'copied' | 'failed'> {
  const link = claimLink(code);
  const message = `Here are the records for ${name}: feeding, sheds, weights and genes. Open this link to add them to your free ${brand.name} account: ${link}`;
  try {
    if (Platform.OS !== 'web') { await Share.share({ message }); return 'shared'; }
    const nav = globalThis.navigator as any;
    if (nav?.share) { await nav.share({ text: message }); return 'shared'; }
    await nav.clipboard.writeText(link); return 'copied';
  } catch { return 'failed'; }
}
