// Test helper: sign up a throwaway account and sign it in. With "Confirm email" on, set SUPABASE_SECRET_KEY (the
// project's secret key, for tests only, never in the app) and the account is created already confirmed instead.
// Same result shape as supabase.auth.signUp: { data: { user, session }, error }.
import { createClient } from '@supabase/supabase-js';
export async function signUp(client, { email, password }) {
  const sk = process.env.SUPABASE_SECRET_KEY;
  if (!sk) return client.auth.signUp({ email, password });
  const admin = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, sk, { auth: { persistSession: false } });
  const a = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (a.error) return { data: { user: null, session: null }, error: a.error };
  return client.auth.signInWithPassword({ email, password });
}
