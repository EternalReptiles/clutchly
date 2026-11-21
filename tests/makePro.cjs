// Test helper: make a throwaway user Pro by sending the webhook the event RevenueCat would send (needs RC_AUTH).
module.exports = async function makePro(userId, x = {}) {
  const r = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/revenuecat-webhook`, { method: 'POST',
    headers: { Authorization: process.env.RC_AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_version: '1.0', event: { type: 'INITIAL_PURCHASE', app_user_id: userId, entitlement_ids: ['pro'], product_id: 'clutchly_pro_yearly',
      store: 'APP_STORE', environment: 'SANDBOX', event_timestamp_ms: Date.now(), expiration_at_ms: Date.now() + 365 * 864e5, ...x } }) });
  if (!r.ok) throw new Error('makePro failed: ' + r.status);
};
