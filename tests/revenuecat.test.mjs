// Unit tests for the webhook rules. Run: node --experimental-strip-types tests/revenuecat.test.mjs
import { rowFor, userIds, concernsPro } from '../supabase/functions/revenuecat-webhook/status.ts';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const U = '11111111-2222-4333-8444-555555555555', now = Date.parse('2026-11-21T00:00:00Z'), day = 864e5;
const ev = (type, x = {}) => ({ type, app_user_id: U, entitlement_ids: ['pro'], product_id: 'pro_yearly', event_timestamp_ms: now - 1000, expiration_at_ms: now + 365 * day, store: 'APP_STORE', environment: 'SANDBOX', ...x });
let r = rowFor(ev('INITIAL_PURCHASE'), U, null, now); ok(r.active && r.expires_at === new Date(now + 365 * day).toISOString(), 'purchase: active until expiry');
ok(rowFor(ev('RENEWAL'), U, null, now).active, 'renewal: active');
ok(rowFor(ev('CANCELLATION'), U, null, now).active, 'cancellation: still Pro until the paid period ends');
ok(rowFor(ev('BILLING_ISSUE'), U, null, now).active, 'billing issue: still Pro during grace');
ok(!rowFor(ev('EXPIRATION', { expiration_at_ms: now - day }), U, null, now).active, 'expiration: not Pro');
r = rowFor(ev('NON_RENEWING_PURCHASE', { product_id: 'pro_lifetime', expiration_at_ms: null }), U, null, now); ok(r.active && r.expires_at === null, 'lifetime unlock (code): Pro with no expiry');
ok(!rowFor(ev('RENEWAL', { expiration_at_ms: now - 1 }), U, null, now).active, 'event with past expiry: not Pro');
ok(rowFor(ev('RENEWAL', { event_timestamp_ms: now - 10 * day }), U, { last_event_at: new Date(now - day).toISOString() }, now) === null, 'older event ignored (out of order)');
ok(rowFor(ev('INITIAL_PURCHASE', { entitlement_ids: ['other'] }), U, null, now) === null, 'other entitlement ignored');
ok(rowFor(ev('TEST'), U, null, now) === null, 'TEST event ignored');
ok(userIds(ev('X', { app_user_id: '$RCAnonymousID:abc', aliases: [U] })).join() === U, 'anonymous ids skipped, alias used');
ok(concernsPro({ type: 'X', entitlement_id: 'pro' }), 'old single entitlement_id field');
process.exit(fails ? 1 : 0);
