// In-app purchases through RevenueCat (react-native-purchases). The app only starts purchases and shows prices;
// whether a user is Pro is decided on the server (revenuecat-webhook -> subscriptions table), never by the app.
import { Linking, Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type PurchasesPackage } from 'react-native-purchases';
import brand from '../brand.json';

const key = Platform.OS === 'ios' ? brand.revenuecat.iosApiKey : Platform.OS === 'android' ? brand.revenuecat.androidApiKey : '';
/** False on the web and until real RevenueCat keys are put in brand.json. */
export const purchasesAvailable = !!key && !key.includes('REPLACE_ME');
let configured = false;
function ensure() {
  if (!purchasesAvailable || configured) return purchasesAvailable;
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN).catch(() => {});
  Purchases.configure({ apiKey: key }); configured = true; return true;
}
/** Link purchases to the Supabase account, so the webhook knows whose subscription it is. */
export async function purchasesLogIn(uid: string) { if (ensure()) await Purchases.logIn(uid).catch(() => {}); }
export async function purchasesLogOut() { if (configured) await Purchases.logOut().catch(() => {}); }

/** The yearly package shown on the paywall (the lifetime product is only reachable with a code). */
export async function yearlyPackage(): Promise<PurchasesPackage | null> {
  if (!ensure()) return null;
  const o = await Purchases.getOfferings();
  const pkgs = o.current?.availablePackages ?? [];
  return o.current?.annual ?? pkgs.find(p => p.product.identifier === brand.revenuecat.products.yearly) ?? null;
}
export type BuyResult = 'purchased' | 'cancelled' | { error: string };
export async function buy(pkg: PurchasesPackage): Promise<BuyResult> {
  try { await Purchases.purchasePackage(pkg); return 'purchased'; }
  catch (e: any) { return e?.userCancelled ? 'cancelled' : { error: e?.message ?? String(e) }; }
}
export async function restore(): Promise<{ hasPro: boolean } | { error: string }> {
  if (!ensure()) return { error: 'Purchases are not available here.' };
  try { const info = await Purchases.restorePurchases(); return { hasPro: !!info.entitlements.active[brand.revenuecat.entitlement] }; }
  catch (e: any) { return { error: e?.message ?? String(e) }; }
}
/** Free codes: Apple shows its redeem sheet; on Android codes are redeemed in the Play Store. */
export async function redeemCode() {
  if (Platform.OS === 'ios' && ensure()) return Purchases.presentCodeRedemptionSheet().catch(() => {});
  return Linking.openURL('https://play.google.com/redeem').catch(() => {});
}
export const manageSubscriptionsUrl = Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions';
