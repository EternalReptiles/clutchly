// Handing an animal over to its buyer (migration 015_transfers.sql). The seller makes a one-time link; the buyer
// opens it, signs in and accepts, and gets their own copy of the animal and its history. These need a connection:
// the copy is made on the server.
import { Platform, Share } from 'react-native';
import brand from '../brand.json';
import { supabase } from './supabase';
import { getState } from './store';
import { fmt } from './logic';

export type Licence = { full_name?: string | null; licence_no?: string | null; region?: string | null; licence_class?: string | null;
  expires?: string | null; address?: string | null; phone?: string | null };
export type Transfer = { code: string; animal_id: string | null; new_animal_id: string | null; seller_id: string | null; accepted_by: string | null;
  from_name: string | null; include_notes: boolean; share_seller_licence: boolean; animal_name: string | null; species: string | null;
  created_at: string; expires_at: string; accepted_at: string | null; seller_licence: Licence | null; buyer_licence: Licence | null };
export type Preview = { code: string; from_name: string | null; expires_at: string; accepted: boolean; mine: boolean;
  name: string; species: string; sex: string; dob: string | null; feeds: number; sheds: number; weights: number;
  genes: { name: string; state: string; het_pct: number | null }[]; seller_licence: boolean };

export const PENDING_KEY = 'clutchly.pendingClaim';
export const FROM_KEY = 'clutchly.handoverFrom';

/** The code as typed or pasted (whole link, any case, with or without the dash) → 'K7QXM3PAZ9'. */
export const cleanCode = (s: string) => (s.trim().split('/').pop() ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();
export const showCode = (c: string) => c.length === 10 ? `${c.slice(0, 5)}-${c.slice(5)}` : c;
export const claimLink = (c: string) => `${brand.siteUrl.replace(/\/+$/, '')}/app/claim/${showCode(c)}`;

/** An animal's handovers: the newest one out (as seller) and the one it arrived with (as buyer). Undefined when offline. */
export async function handoversOf(animalId: string): Promise<{ out: Transfer | null; in: Transfer | null } | undefined> {
  const r = await supabase.from('transfers').select('*').or(`animal_id.eq.${animalId},new_animal_id.eq.${animalId}`).order('created_at', { ascending: false });
  if (r.error) return undefined;
  const rows = r.data as Transfer[];
  return { out: rows.find(t => t.animal_id === animalId) ?? null, in: rows.find(t => t.new_animal_id === animalId) ?? null };
}
/** Every handover this user was part of, either side, newest first (accepted ones are the sales and purchases record). */
export async function allTransfers(): Promise<Transfer[]> {
  const r = await supabase.from('transfers').select('*').not('accepted_at', 'is', null).order('accepted_at', { ascending: false });
  if (r.error) throw new Error(friendly(r.error.message));
  return r.data as Transfer[];
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
  if (/seller_licence_missing/.test(m)) return 'The seller\'s licence details are incomplete. Ask them to finish them (Account > Wildlife licence), then try again.';
  if (/licence_required/.test(m)) return 'Add your full name, wildlife licence number and address first (Account > Wildlife licence). They\'re swapped with the other person in every handover.';
  if (/fetch|network/i.test(m)) return 'No connection. Handovers need the internet; try again when you\'re online.';
  return m;
}

/** Share sheet on phones; the browser's share, or copy to the clipboard, on the web. 'cancelled' when the person
 * closed the share sheet; 'failed' when neither worked (the link is on screen to copy by hand). */
export async function shareLink(name: string, code: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const link = claimLink(code);
  const message = `Here are the records for ${name}: feeding, sheds, weights and genes. Open this link to add them to your free ${brand.name} account: ${link}`;
  if (Platform.OS !== 'web') { try { await Share.share({ message }); return 'shared'; } catch { return 'failed'; } }
  const nav = globalThis.navigator as any;
  if (nav?.share) {
    try { await nav.share({ text: message }); return 'shared'; } catch (e: any) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  try { await nav.clipboard.writeText(link); return 'copied'; } catch { return 'failed'; }
}

// Wildlife licence (table licences, one row per user; Account > Wildlife licence).
export const REGIONS = ['QLD', 'NSW', 'VIC', 'SA', 'WA', 'TAS', 'NT', 'ACT', 'Other'];
export async function getLicence(): Promise<Licence | null> {
  const r = await supabase.from('licences').select('full_name,licence_no,region,licence_class,expires,address,phone').maybeSingle();
  if (r.error) throw new Error(friendly(r.error.message));
  return r.data;
}
export async function saveLicence(l: Licence) {
  const { data } = await supabase.auth.getSession(); const uid = data.session?.user.id; if (!uid) throw new Error('Sign in first.');
  const r = await supabase.from('licences').upsert({ user_id: uid, ...l, updated_at: new Date().toISOString() });
  if (r.error) throw new Error(friendly(r.error.message));
}
export const hasLicence = (l?: Licence | null) => !!(l && (l.licence_no?.trim() || l.full_name?.trim()));
/** What every handover needs from both people (the server checks the same). */
export const licenceComplete = (l?: Licence | null) => !!(l?.full_name?.trim() && l.licence_no?.trim() && l.address?.trim());
export const SWAP_TEXT = 'Your full name, wildlife licence number and address go to the other person, and theirs come to you, so you both have them for your records.';
/** Licence details as lines of text, for showing and for sharing a record. */
export const licenceLines = (l: Licence) => [l.full_name, [l.licence_no && `Licence ${l.licence_no}`, l.region, l.licence_class].filter(Boolean).join(' · '),
  l.expires && `Expires ${fmt(l.expires)}`, l.address, l.phone].filter(Boolean) as string[];
