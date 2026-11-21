import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { SUPABASE_ANON_KEY as key, SUPABASE_URL as url } from './config';

export const supabase = createClient(url, key, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Only refresh the session while the app is in the foreground (Supabase's recommended setup for React Native).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', st => st === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh());
}
