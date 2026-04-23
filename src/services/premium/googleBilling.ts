import { Platform } from 'react-native';
import { usePremiumStore, PremiumPlan } from '../../store/premiumStore';
import { apiPost } from '../api/apiClient';
import { API_ENDPOINTS } from '../../config/api';

let IAP: any = null;
let isInitialized = false;

function getIap(): any {
  if (!IAP) {
    try {
      IAP = require('expo-iap');
    } catch {
      return null;
    }
  }
  return IAP;
}

// Google Play product IDs (must match Google Play Console products)
export const PRODUCT_IDS = {
  monthly: 'fittrack_premium_monthly',
  quarterly: 'fittrack_premium_quarterly',
  yearly: 'fittrack_premium_yearly',
} as const;

const ALL_PRODUCT_IDS = [PRODUCT_IDS.monthly, PRODUCT_IDS.quarterly, PRODUCT_IDS.yearly];

/**
 * Initialize Google Play Billing connection.
 * Call once at app startup (App.tsx).
 */
export async function initializeBilling(): Promise<void> {
  if (Platform.OS !== 'android' || isInitialized) return;

  const iap = getIap();
  if (!iap) {
    if (__DEV__) console.log('GoogleBilling: expo-iap not available');
    return;
  }

  try {
    await iap.initConnection();
    isInitialized = true;
    if (__DEV__) console.log('GoogleBilling: Connected successfully');
  } catch (e) {
    if (__DEV__) console.warn('GoogleBilling: Connection failed', e);
  }
}

/**
 * Check if billing is properly initialized.
 */
export function isBillingConfigured(): boolean {
  return isInitialized && Platform.OS === 'android';
}

/**
 * Get available subscription products from Google Play.
 */
export async function getSubscriptions(): Promise<any[]> {
  const iap = getIap();
  if (!iap || !isInitialized) return [];

  try {
    const subscriptions = await iap.fetchProducts({ skus: ALL_PRODUCT_IDS, type: 'subs' });
    return subscriptions || [];
  } catch (e) {
    if (__DEV__) console.warn('GoogleBilling: Failed to get subscriptions', e);
    return [];
  }
}

/**
 * Purchase a subscription by product ID.
 * Returns the purchase token if successful (needed for server-side verification).
 */
export async function purchaseSubscription(productId: string): Promise<string | null> {
  const iap = getIap();
  if (!iap || !isInitialized) return null;

  try {
    const purchase = await iap.requestPurchase({
      request: { android: { skus: [productId] } },
      type: 'subs',
    });

    if (purchase) {
      const purchaseData = Array.isArray(purchase) ? purchase[0] : purchase;
      const purchaseToken = purchaseData.purchaseToken || purchaseData.transactionId;

      // Acknowledge the purchase
      if (purchaseData.purchaseToken) {
        await iap.finishTransaction({ purchase: purchaseData, isConsumable: false });
      }

      // Verify purchase on server and grant premium in Redis
      try {
        const verifyResult = await apiPost<{ success: boolean; plan: string; expiresAt: number }>(
          API_ENDPOINTS.verifyPurchase,
          { purchaseToken, productId }
        );
        if (verifyResult.success) {
          usePremiumStore.getState().setPremium(
            verifyResult.plan as PremiumPlan,
            verifyResult.expiresAt
          );
        }
      } catch {
        // Fallback: grant locally even if server verification fails
        const plan = getPlanFromProductId(productId);
        const expiresAt = Date.now() + getDurationDays(plan) * 24 * 60 * 60 * 1000;
        usePremiumStore.getState().setPremium(plan, expiresAt);
      }

      return purchaseToken;
    }

    return null;
  } catch (e: any) {
    if (e.code === 'E_USER_CANCELLED') {
      // User cancelled — not an error
      return null;
    }
    if (__DEV__) console.warn('GoogleBilling: Purchase failed', e);
    throw e;
  }
}

/**
 * IAP-backed plan types — the ones that come from Google Play.
 * Non-IAP plans ('promo', 'trial', 'referral') must never be overwritten
 * or cleared by Play Billing logic, because the Play Store has no record
 * of them.
 */
const IAP_PLANS: readonly string[] = ['monthly', 'quarterly', 'yearly'];

/**
 * Restore previous purchases — SAFE VERSION (CRITICAL, used on app startup).
 *
 * This function NEVER clears premium, because:
 *   - A promo / trial / referral user has no Google Play purchase, so
 *     `getAvailablePurchases()` returns empty for them. Clearing in that
 *     case wipes the user's legit premium every app launch.
 *   - Even paid users can see transient empty responses (Play Store cache
 *     sync delay, offline startup, network flake). Downgrading them to
 *     free on a false negative is unacceptable.
 *
 * Behaviour:
 *   - If we find an active IAP subscription → refresh local premium state
 *     with it (overwrites any non-IAP plan; IAP is more authoritative).
 *   - Otherwise → leave state untouched.
 *
 * Returns true only when an IAP subscription was found and applied.
 */
export async function restorePurchases(): Promise<boolean> {
  const iap = getIap();
  if (!iap || !isInitialized) return false;

  try {
    const purchases = await iap.getAvailablePurchases();

    if (purchases && purchases.length > 0) {
      const activeSub = purchases.find((p: any) =>
        ALL_PRODUCT_IDS.includes(p.productId),
      );

      if (activeSub) {
        const plan = getPlanFromProductId(activeSub.productId);
        const expiresAt = Date.now() + getDurationDays(plan) * 24 * 60 * 60 * 1000;
        await usePremiumStore.getState().setPremium(plan, expiresAt);
        return true;
      }
    }

    // DO NOT clear here. The user may legitimately be on a non-IAP plan
    // (promo/trial/referral), or Play Store may have returned empty due
    // to a transient sync issue. Silently return false.
    return false;
  } catch (e) {
    if (__DEV__) console.warn('GoogleBilling: Restore failed', e);
    return false;
  }
}

/**
 * Explicit user-initiated restore — called when the user taps "Restore
 * Purchases" in the paywall. Same safety rule as above: we NEVER clear a
 * non-IAP plan. We return a structured result so the UI can tell the user
 * whether anything was actually restored.
 */
export async function restorePurchasesInteractive(): Promise<{
  restored: boolean;
  reason?: 'no-billing' | 'no-purchases' | 'error';
}> {
  const iap = getIap();
  if (!iap || !isInitialized) return { restored: false, reason: 'no-billing' };

  try {
    const purchases = await iap.getAvailablePurchases();
    const activeSub = (purchases || []).find((p: any) =>
      ALL_PRODUCT_IDS.includes(p.productId),
    );

    if (activeSub) {
      const plan = getPlanFromProductId(activeSub.productId);
      const expiresAt = Date.now() + getDurationDays(plan) * 24 * 60 * 60 * 1000;
      await usePremiumStore.getState().setPremium(plan, expiresAt);
      return { restored: true };
    }

    // No active IAP found. Check if the user currently has an IAP plan
    // locally cached — if so, Play Store now says they don't, which
    // usually means the subscription was cancelled & grace period ended.
    // Only in that narrow case do we clear; never touch non-IAP plans.
    const current = usePremiumStore.getState();
    if (current.isPremium && IAP_PLANS.includes(current.plan)) {
      await usePremiumStore.getState().clearPremium();
    }
    return { restored: false, reason: 'no-purchases' };
  } catch (e) {
    if (__DEV__) console.warn('GoogleBilling: Interactive restore failed', e);
    return { restored: false, reason: 'error' };
  }
}

/**
 * Check current subscription status on app launch.
 *
 * IMPORTANT: this is the silent/background sync path. It MUST NOT clear
 * premium under any circumstance — transient Play Store responses (empty
 * result on cold start, offline launch) used to wipe promo / trial /
 * referral premium on every restart.
 */
export async function checkSubscriptionStatus(): Promise<boolean> {
  return restorePurchases();
}

/**
 * Clean up billing connection on app close.
 */
export async function endBillingConnection(): Promise<void> {
  const iap = getIap();
  if (!iap || !isInitialized) return;

  try {
    await iap.endConnection();
    isInitialized = false;
  } catch {
    // ignore
  }
}

/**
 * Listen for purchase updates (call in App.tsx useEffect).
 * Returns a cleanup function.
 */
export function setupPurchaseListener(): () => void {
  const iap = getIap();
  if (!iap) return () => {};

  const purchaseUpdateSubscription = iap.purchaseUpdatedListener?.(
    async (purchase: any) => {
      if (purchase.purchaseToken) {
        try {
          await iap.finishTransaction({ purchase, isConsumable: false });
        } catch {
          // ignore
        }
      }

      const plan = getPlanFromProductId(purchase.productId);
      const expiresAt = Date.now() + getDurationDays(plan) * 24 * 60 * 60 * 1000;
      usePremiumStore.getState().setPremium(plan, expiresAt);
    }
  );

  const purchaseErrorSubscription = iap.purchaseErrorListener?.(
    (error: any) => {
      if (__DEV__) console.warn('GoogleBilling: Purchase error', error);
    }
  );

  return () => {
    purchaseUpdateSubscription?.remove?.();
    purchaseErrorSubscription?.remove?.();
  };
}

// ── Helpers ──

function getPlanFromProductId(productId: string): PremiumPlan {
  if (productId.includes('yearly') || productId.includes('annual')) return 'yearly';
  if (productId.includes('quarterly') || productId.includes('3month')) return 'quarterly';
  return 'monthly';
}

function getDurationDays(plan: PremiumPlan): number {
  switch (plan) {
    case 'yearly': return 365;
    case 'quarterly': return 90;
    default: return 30;
  }
}
