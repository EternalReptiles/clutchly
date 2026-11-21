// Push notifications on this device: permission, Expo push token, and keeping device_tokens in step.
import { APP_NAME } from './brand';
// The daily-digest Edge Function sends the notifications; this file only registers and unregisters the phone.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

const TOKEN_KEY = 'clutchly.pushToken';
export const pushSupported = Platform.OS === 'ios' || Platform.OS === 'android';
const projectId: string | undefined = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const deviceTimeZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };

if (pushSupported) {
  // Show notifications that arrive while the app is open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export type PushResult = { ok: true } | { ok: false; reason: string };

/** Asks for permission (only when the user chooses to turn notifications on) and registers this phone. */
export async function enablePush(): Promise<PushResult> {
  if (!pushSupported) return { ok: false, reason: `Notifications work in the ${APP_NAME} phone app, not in a web browser.` };
  if (!projectId) return { ok: false, reason: `This build of ${APP_NAME} is not linked to an Expo (EAS) project yet, so it cannot get a push token. See "Push notifications" in the README.` };
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Reminders', importance: Notifications.AndroidImportance.DEFAULT });
  }
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: `Notifications are turned off for ${APP_NAME} in your phone's Settings. Turn them on there, then try again.` };
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('register_device_token', { p_token: token, p_platform: Platform.OS });
    if (error) return { ok: false, reason: error.message };
    await AsyncStorage.setItem(TOKEN_KEY, token);
    // Make sure the user has settings, starting in this phone's timezone. Existing settings are kept.
    await supabase.from('notification_settings').upsert({ timezone: deviceTimeZone() }, { onConflict: 'user_id', ignoreDuplicates: true });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: inExpoGo ? `Push notifications don't work inside Expo Go. They need a development or store build of ${APP_NAME}.` : e?.message ?? String(e) };
  }
}

export const pushEnabledHere = async () => pushSupported && !!(await AsyncStorage.getItem(TOKEN_KEY).catch(() => null));

/** Stops notifications to this phone (the user's other phones keep theirs). */
export async function disablePushHere() {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (token) await supabase.from('device_tokens').delete().eq('token', token);
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
}

/** Re-registers on app start, because Expo push tokens can change. Silent; never asks for permission. */
export async function refreshPushToken() {
  if (!(await pushEnabledHere()) || !projectId) return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return disablePushHere();
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const old = await AsyncStorage.getItem(TOKEN_KEY);
    if (token !== old) { if (old) await supabase.from('device_tokens').delete().eq('token', old); await AsyncStorage.setItem(TOKEN_KEY, token); }
    await supabase.rpc('register_device_token', { p_token: token, p_platform: Platform.OS });
  } catch { /* offline or no push service: try again next launch */ }
}

/** Sign out: remove this phone's token first so it stops getting this account's notifications. */
export async function signOutAndForgetDevice() {
  try { await disablePushHere(); } catch { /* offline: the token is cleaned up when Expo reports it dead */ }
  return supabase.auth.signOut();
}
