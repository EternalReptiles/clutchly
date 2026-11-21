import { router } from 'expo-router';
/** Opens the Pro screen, explaining why (e.g. the free animal limit). */
export const goPro = (reason?: string) => router.push({ pathname: '/paywall', params: reason ? { reason } : {} });
