import { db } from './admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Verify premium status server-side using Firestore cache.
 * Premium is granted by /verifyPurchase or /promo endpoints.
 * Fail-closed: returns false on any error.
 */
export async function verifyPremiumStatus(deviceId: string): Promise<boolean> {
  try {
    // 1. Check promo-granted premium
    const promoDoc = await db.collection('promo_premium').doc(deviceId).get();
    if (promoDoc.exists) {
      const expiresAt: number = promoDoc.data()?.expiresAt ?? 0;
      if (expiresAt > Date.now()) return true;
    }

    // 2. Check purchase-granted premium
    const premiumDoc = await db.collection('premium_status').doc(deviceId).get();
    if (premiumDoc.exists) {
      const data = premiumDoc.data();
      if (data?.isPremium && data?.expiresAt?.toMillis?.() > Date.now()) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Premium verification failed:', error);
    return false;
  }
}

/**
 * Grant premium status after successful Google Play purchase verification.
 */
export async function grantPremiumStatus(
  deviceId: string,
  plan: string,
  expiresAtMs: number
): Promise<void> {
  const expiresAt = new Date(expiresAtMs);
  await db.collection('premium_status').doc(deviceId).set({
    isPremium: true,
    plan,
    expiresAt,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
