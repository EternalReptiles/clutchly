// Supabase project URL and anon / publishable key. Never put the service_role / secret key here.
// These are public by design: they ship inside every copy of the app, and row-level security protects the data.
// A .env file with EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY overrides them (e.g. for a test project).
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://xtjoypcgzfotjzskmggw.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_uLPXELAspUu1WWtrH--hmA_byL-ZVJ9';
