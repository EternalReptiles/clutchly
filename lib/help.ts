// Help questions (help.json, shared with the website's support page) and contacting support.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import help from '../help.json';
import brand from '../brand.json';
import { supabase } from './supabase';
import { getState } from './store';

export type HelpItem = { q: string; a: string };
export type HelpSection = { title: string; items: HelpItem[] };
const fill = (s: string) => s.replaceAll('{{APP_NAME}}', brand.name).replaceAll('{{SUPPORT_EMAIL}}', brand.supportEmail);
export const SECTIONS: HelpSection[] = help.sections.map(sec => ({ title: sec.title, items: sec.items.map(i => ({ q: fill(i.q), a: fill(i.a) })) }));

/** Sections with only the questions matching every word of the search (in the question or answer). */
export function searchHelp(query: string): HelpSection[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return SECTIONS;
  return SECTIONS.map(sec => ({ ...sec, items: sec.items.filter(i => { const t = `${sec.title} ${i.q} ${i.a}`.toLowerCase(); return words.every(w => t.includes(w)); }) }))
    .filter(sec => sec.items.length);
}

/** An answer split into paragraphs of plain and **bold** pieces. */
export const answerParts = (a: string) => a.split(/\n\s*\n/).map(p => p.split(/(\*\*[^*]+\*\*)/).filter(Boolean)
  .map(x => x.startsWith('**') ? { bold: true, text: x.slice(2, -2) } : { bold: false, text: x }));

export const TOPICS = ['Question', 'Problem or bug', 'Account or sign-in', 'Pro or payments', 'Handover', 'Idea or feedback'];

/** What support needs to know, sent with a message (no records or animals' details). */
export function supportMeta(): Record<string, string> {
  const st = getState(); const nav = (globalThis as any).navigator;
  return {
    app_version: Constants.expoConfig?.version ?? brand.version,
    platform: Platform.OS === 'web' ? `web (${String(nav?.userAgent ?? '').slice(0, 200)})` : `${Platform.OS} ${Platform.Version}`,
    plan: st.uid ? (st.plan.active ? 'Pro' : 'Free') : 'signed out',
    ...(st.uid ? { animals: String(st.animals.length), unsynced_changes: String(st.queue.length) } : {}),
  };
}

export async function sendSupport(email: string, topic: string, message: string): Promise<{ emailed: boolean }> {
  const r = await supabase.functions.invoke('support-message', { body: { email, topic, message, meta: supportMeta() } });
  if (r.error) {
    let code = '';
    try { code = (await (r.error as any).context?.json())?.error ?? ''; } catch { /* network error: no body */ }
    throw new Error(code === 'bad_email' ? 'Check your email address: we need it to reply.'
      : code === 'too_many' ? 'You\'ve sent a few messages in a short time. Please wait a little and try again, or email us.'
      : code === 'bad_message' ? 'Write a message (up to 5,000 characters).'
      : `Couldn't send your message. Check your connection and try again, or email ${brand.supportEmail}.`);
  }
  return r.data;
}
