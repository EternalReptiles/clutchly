// Browser-test helper. With "Confirm email" on, Create account doesn't sign straight in, so when SUPABASE_SECRET_KEY is
// set (tests only, never in the app) the account is made already confirmed and the test presses Sign in instead.
// Returns the button to press on the sign-in screen.
const { createClient } = require('@supabase/supabase-js');
module.exports = async function prepareAccount(email, password) {
  const sk = process.env.SUPABASE_SECRET_KEY;
  if (!sk) return 'Create account';
  const a = await createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, sk, { auth: { persistSession: false } }).auth.admin.createUser({ email, password, email_confirm: true });
  if (a.error) throw a.error;
  return 'Sign in';
};
