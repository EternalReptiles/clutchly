// Pure rules: what a RevenueCat webhook event means for one user's "pro" status. Unit-tested (tests/revenuecat.test.mjs).
export type RcEvent = {
  type: string; app_user_id?: string; original_app_user_id?: string; aliases?: string[];
  entitlement_ids?: string[] | null; entitlement_id?: string | null; product_id?: string; expiration_at_ms?: number | null;
  event_timestamp_ms?: number; store?: string; environment?: string; transferred_from?: string[]; transferred_to?: string[];
};
export type SubRow = { user_id: string; entitlement: 'pro'; active: boolean; expires_at: string | null; product_id: string | null;
  store: string | null; environment: string | null; last_event_type: string; last_event_at: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Our Supabase user ids mentioned by the event (the app logs in to RevenueCat with the Supabase user id). */
export const userIds = (e: RcEvent) => [...new Set([e.app_user_id, e.original_app_user_id, ...(e.aliases ?? [])].filter((x): x is string => !!x && UUID.test(x)))];

// Events after which the entitlement is in force until expiration_at_ms (null = no expiry, e.g. a lifetime unlock).
const GRANTS = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED', 'TEMPORARY_ENTITLEMENT_GRANT', 'CANCELLATION', 'BILLING_ISSUE', 'SUBSCRIPTION_PAUSED']);
// CANCELLATION / BILLING_ISSUE / PAUSED: auto-renew is off or payment is retrying, but the paid period still runs.

export const concernsPro = (e: RcEvent, entitlement = 'pro') =>
  (e.entitlement_ids ?? (e.entitlement_id ? [e.entitlement_id] : [])).includes(entitlement);

/** The row to write for this event, or null if the event should be ignored (or is older than what we have). */
export function rowFor(e: RcEvent, userId: string, current: { last_event_at: string | null } | null, now = Date.now()): SubRow | null {
  if (e.type === 'TEST' || !concernsPro(e)) return null;
  const at = new Date(e.event_timestamp_ms ?? now).toISOString();
  if (current?.last_event_at && at < current.last_event_at) return null; // out-of-order delivery: keep the newer state
  const base = { user_id: userId, entitlement: 'pro' as const, product_id: e.product_id ?? null, store: e.store ?? null,
    environment: e.environment ?? null, last_event_type: e.type, last_event_at: at };
  if (e.type === 'EXPIRATION') return { ...base, active: false, expires_at: e.expiration_at_ms ? new Date(e.expiration_at_ms).toISOString() : null };
  if (GRANTS.has(e.type)) {
    const exp = e.expiration_at_ms ? new Date(e.expiration_at_ms).toISOString() : null;
    return { ...base, active: exp === null || e.expiration_at_ms! > now, expires_at: exp };
  }
  return null;
}
