import { Platform } from 'react-native';
import { usePremiumStore, PremiumPlan } from '../../store/premiumStore';
import { apiPost } from '../api/apiClient';
import { API_ENDPOINTS } from '../../config/api';

let RNIap: any = null;
let isInitialized = false;

function getIap(): any {
  if (!RNIap) {
    try {
      RNIap = require('react-native-iap');
    } catch {
      return null;
    }
  }
  return RNIap;
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
    if (__DEV__) console.log('GoogleBilling: react-native-iap not available');
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
    const subscriptions = await iap.getSubscriptions({ skus: ALL_PRODUCT_IDS });
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
    const purchase = await iap.requestSubscription({
      sku: productId,
      subscriptionOffers: [{ sku: productId, offerToken: '' }],
    });

    if (purchase) {
      const purchaseData = Array.isArray(purchase) ? purchase[0] : purchase;
      const purchaseToken = purchaseData.purchaseToken || purchaseData.transactionId;

      // Acknowledge the purchase
      if (purchaseData.purchaseToken) {
        await iap.acknowledgePurchaseAndroid({ token: purchaseData.purchaseToken });
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
 * Restore previous purchases.
 * Returns true if premium was restored.
 */
export async function restorePurchases(): Promise<boolean> {
  const iap = getIap();
  if (!iap || !isInitialized) return false;

  try {
    const purchases = await iap.getAvailablePurchases();

    if (purchases && purchases.length > 0) {
      // Find the most recent active subscription
      const activeSub = purchases.find((p: any) =>
        ALL_PRODUCT_IDS.includes(p.productId)
      );

      if (activeSub) {
        const plan = getPlanFromProductId(activeSub.productId);
        const expiresAt = Date.now() + getDurationDays(plan) * 24 * 60 * 60 * 1000;
        usePremiumStore.getState().setPremium(plan, expiresAt);
        return true;
      }
    }

    usePremiumStore.getState().clearPremium();
    return false;
  } catch (e) {
    if (__DEV__) console.warn('GoogleBilling: Restore failed', e);
    return false;
  }
}

/**
 * Check current subscription status.
 * Call on app launch to sync.
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
          await iap.acknowledgePurchaseAndroid({ token: purchase.purchaseToken });
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
