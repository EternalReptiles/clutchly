import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Where the reset email sends people back to. Supabase only allows addresses on its Redirect URLs list:
//   app build: clutchly://reset-password   Expo Go: exp://<your-computer>:8081/--/reset-password   web: <site>/reset-password
export const resetRedirectUrl = () => Platform.OS === 'web' && typeof window !== 'undefined'
  ? `${window.location.origin}${(Constants.expoConfig?.experiments as any)?.baseUrl ?? ''}/reset-password`   // web app may live under /app
  : Linking.createURL('/reset-password');

// Supabase puts the result in the link's #fragment (implicit flow) or ?query (PKCE / errors).
export function parseAuthParams(url: string | null): Record<string, string> {
  if (!url) return {};
  const out: Record<string, string> = {};
  const add = (part?: string) => part?.split('&').forEach(kv => {
    const [k, v = ''] = kv.split('='); if (k) out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
  });
  const [beforeHash, hash] = url.split('#');
  add(beforeHash.split('?')[1]); add(hash);
  return out;
}
