import { Platform } from 'react-native';
import { usePremiumStore, PremiumPlan } from '../../store/premiumStore';

let Purchases: any = null;

function getRC(): any {
  if (!Purchases) {
    try {
      const module = require('react-native-purchases');
      Purchases = module.default || module.Purchases;
    } catch {
      return null;
    }
  }
  return Purchases;
}

// RevenueCat API keys
const RC_API_KEY_IOS = 'test_neaZQKbwoUMUdsECbtmpqSvWAMj';
const RC_API_KEY_ANDROID = 'test_neaZQKbwoUMUdsECbtmpqSvWAMj';

// RevenueCat product identifiers (must match your App Store / Play Store products)
export const PRODUCT_IDS = {
  monthly: 'fittrack_premium_monthly',
  quarterly: 'fittrack_premium_quarterly',
  yearly: 'fittrack_premium_yearly',
} as const;

// Entitlement identifier in RevenueCat dashboard
const ENTITLEMENT_ID = 'premium';

let isConfigured = false;

/**
 * Initialize RevenueCat SDK.
 * Call this once at app startup (App.tsx).
 */
export async function configureRevenueCat(): Promise<void> {
  const rc = getRC();
  if (!rc || isConfigured) return;

  const apiKey = Platform.OS === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
  if (!apiKey) {
    if (__DEV__) console.log('RevenueCat: No API key configured, running in mock mode');
    return;
  }

  try {
    rc.configure({ apiKey });
    isConfigured = true;
    if (__DEV__) console.log('RevenueCat: Configured successfully');
  } catch (e) {
    if (__DEV__) console.warn('RevenueCat: Configuration failed', e);
  }
}

/**
 * Check if RevenueCat is properly configured (has API keys).
 */
export function isRevenueCatConfigured(): boolean {
  const apiKey = Platform.OS === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
  return isConfigured && !!apiKey;
}

/**
 * Get available packages/offerings from RevenueCat.
 */
export async function getOfferings(): Promise<any | null> {
  const rc = getRC();
  if (!rc || !isConfigured) return null;

  try {
    const offerings = await rc.getOfferings();
    return offerings?.current || null;
  } catch (e) {
    if (__DEV__) console.warn('RevenueCat: Failed to get offerings', e);
    return null;
  }
}

/**
 * Purchase a specific package.
 * Returns true if purchase was successful.
 */
export async function purchasePackage(packageToPurchase: any): Promise<boolean> {
  const rc = getRC();
  if (!rc || !isConfigured) return false;

  try {
    const { customerInfo } = await rc.purchasePackage(packageToPurchase);
    return checkAndUpdatePremiumStatus(customerInfo);
  } catch (e: any) {
    if (e.userCancelled) {
      // User cancelled — not an error
      return false;
    }
    if (__DEV__) console.warn('RevenueCat: Purchase failed', e);
    throw e;
  }
}

/**
 * Purchase by product identifier (used when offerings aren't available).
 */
export async function purchaseProduct(productId: string): Promise<boolean> {
  const rc = getRC();
  if (!rc || !isConfigured) return false;

  try {
    const { customerInfo } = await rc.purchaseStoreProduct(
      Platform.OS === 'ios'
        ? { productIdentifier: productId }
        : { productId }
    );
    return checkAndUpdatePremiumStatus(customerInfo);
  } catch (e: any) {
    if (e.userCancelled) return false;
    if (__DEV__) console.warn('RevenueCat: Purchase failed', e);
    throw e;
  }
}

/**
 * Restore previous purchases.
 * Returns true if premium was restored.
 */
export async function restorePurchases(): Promise<boolean> {
  const rc = getRC();
  if (!rc || !isConfigured) return false;

  try {
    const customerInfo = await rc.restorePurchases();
    return checkAndUpdatePremiumStatus(customerInfo);
  } catch (e) {
    if (__DEV__) console.warn('RevenueCat: Restore failed', e);
    return false;
  }
}

/**
 * Check current subscription status from RevenueCat.
 * Call this on app launch to sync status.
 */
export async function checkSubscriptionStatus(): Promise<boolean> {
  const rc = getRC();
  if (!rc || !isConfigured) return false;

  try {
    const customerInfo = await rc.getCustomerInfo();
    return checkAndUpdatePremiumStatus(customerInfo);
  } catch (e) {
    if (__DEV__) console.warn('RevenueCat: Status check failed', e);
    return false;
  }
}

/**
 * Internal: Check customerInfo for active entitlements and update store.
 */
function checkAndUpdatePremiumStatus(customerInfo: any): boolean {
  const entitlement = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];

  if (entitlement) {
    // Determine plan type from product identifier
    let plan: PremiumPlan = 'monthly';
    const productId = entitlement.productIdentifier || '';

    if (productId.includes('yearly') || productId.includes('annual')) {
      plan = 'yearly';
    } else if (productId.includes('quarterly') || productId.includes('3month')) {
      plan = 'quarterly';
    } else {
      plan = 'monthly';
    }

    // Get expiration date
    const expiresAt = entitlement.expirationDate
      ? new Date(entitlement.expirationDate).getTime()
      : null;

    usePremiumStore.getState().setPremium(plan, expiresAt);
    return true;
  } else {
    // No active entitlement
    usePremiumStore.getState().clearPremium();
    return false;
  }
}
