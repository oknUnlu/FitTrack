import { getRedis } from './redis';

const CACHE_TTL_SECONDS = 3600; // 1 hour

interface PremiumStatus {
  isPremium: boolean;
  plan: string | null;
  expiresAt: number | null;
}

/**
 * Verify premium status server-side.
 * Checks in this order:
 *   1. Promo-granted premium (set by /api/promo, stored in Redis)
 *   2. Cached premium status in Redis
 *   3. Google Play purchase verification via /api/verify-purchase
 *
 * The client calls /api/verify-purchase after a successful Google Play purchase,
 * which stores the verified status in Redis. This function reads from that cache.
 *
 * Fail-closed: returns false on any error to prevent cost exposure.
 */
export async function verifyPremiumStatus(deviceId: string): Promise<boolean> {
  try {
    const redis = getRedis();

    // 1. Check promo-granted premium first (set by /api/promo)
    const promoKey = `promo_premium:${deviceId}`;
    const promoExpiry = await redis.get<number>(promoKey);
    if (promoExpiry && promoExpiry > Date.now()) {
      return true;
    }

    // 2. Check cached premium status (set by /api/verify-purchase)
    const cacheKey = `premium:${deviceId}`;
    const cached = await redis.get<PremiumStatus>(cacheKey);
    if (cached !== null) {
      // Check if premium hasn't expired
      if (cached.isPremium && cached.expiresAt && cached.expiresAt > Date.now()) {
        return true;
      }
      // Expired or not premium
      return false;
    }

    // 3. No cached status found — user is not premium
    return false;
  } catch (error) {
    console.error('Premium verification failed:', error);
    // Fail-closed: deny premium on any error
    return false;
  }
}

/**
 * Grant premium status for a device (called after successful purchase verification).
 */
export async function grantPremiumStatus(
  deviceId: string,
  plan: string,
  expiresAt: number
): Promise<void> {
  const redis = getRedis();
  const cacheKey = `premium:${deviceId}`;
  const ttl = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));

  const status: PremiumStatus = { isPremium: true, plan, expiresAt };
  await redis.set(cacheKey, status, { ex: ttl });
}
