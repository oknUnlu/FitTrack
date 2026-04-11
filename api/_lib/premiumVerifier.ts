import { getRedis } from './redis';

const CACHE_TTL_SECONDS = 3600; // 1 hour

interface PremiumStatus {
  isPremium: boolean;
  plan: string | null;
  expiresAt: number | null;
}

/**
 * Verify premium status server-side via RevenueCat REST API.
 * Results are cached in Redis for 1 hour to avoid excessive API calls.
 * Falls back to checking promo-granted premium in Redis.
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

    // 2. Check cached premium status
    const cacheKey = `premium:${deviceId}`;
    const cached = await redis.get<PremiumStatus>(cacheKey);
    if (cached !== null) {
      return cached.isPremium;
    }

    // 3. Query RevenueCat REST API
    const rcApiKey = process.env.REVENUECAT_API_KEY;
    if (!rcApiKey) {
      // RevenueCat not configured — deny premium (fail-closed)
      return false;
    }

    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(deviceId)}`,
      {
        headers: {
          Authorization: `Bearer ${rcApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      // API error — deny premium (fail-closed), cache briefly to avoid hammering
      await redis.set(cacheKey, { isPremium: false, plan: null, expiresAt: null }, { ex: 300 });
      return false;
    }

    const data = await response.json();
    const entitlements = data?.subscriber?.entitlements;
    const premiumEntitlement = entitlements?.premium;

    if (premiumEntitlement && premiumEntitlement.expires_date) {
      const expiresAt = new Date(premiumEntitlement.expires_date).getTime();
      const isPremium = expiresAt > Date.now();
      const plan = premiumEntitlement.product_identifier || null;

      const status: PremiumStatus = { isPremium, plan, expiresAt };
      await redis.set(cacheKey, status, { ex: CACHE_TTL_SECONDS });
      return isPremium;
    }

    // No premium entitlement found
    await redis.set(cacheKey, { isPremium: false, plan: null, expiresAt: null }, { ex: CACHE_TTL_SECONDS });
    return false;
  } catch (error) {
    console.error('Premium verification failed:', error);
    // Fail-closed: deny premium on any error
    return false;
  }
}
