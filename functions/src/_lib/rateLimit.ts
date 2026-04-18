import { db } from './admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { RateLimitConfig } from './types';

const LIMITS: Record<string, { free: number; premium: number }> = {
  ai_coach: { free: 10, premium: 250 },
  food_recognition: { free: 3, premium: 999999 },
  plan: { free: 10, premium: 250 },
};

function getSecondsUntilMidnightUTC(): number {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.ceil((tomorrow.getTime() - now.getTime()) / 1000);
}

export async function checkRateLimit(
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number }> {
  const { feature, isPremium, deviceId } = config;
  const limits = LIMITS[feature];
  if (!limits) return { allowed: true, remaining: 999 };

  const maxRequests = isPremium ? limits.premium : limits.free;
  const today = new Date().toISOString().split('T')[0];
  const docId = `${deviceId}:${feature}:${today}`;
  const docRef = db.collection('rate_limits').doc(docId);

  try {
    const result = await db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      const now = Date.now();

      if (!doc.exists || (doc.data()?.expiresAt?.toMillis?.() ?? 0) < now) {
        const expiresAt = new Date(now + getSecondsUntilMidnightUTC() * 1000);
        tx.set(docRef, { count: 1, expiresAt });
        return { allowed: true, remaining: maxRequests - 1 };
      }

      const count: number = doc.data()?.count ?? 0;
      if (count >= maxRequests) {
        return { allowed: false, remaining: 0 };
      }

      tx.update(docRef, { count: FieldValue.increment(1) });
      return { allowed: true, remaining: maxRequests - count - 1 };
    });

    return result;
  } catch (error) {
    // Fail-closed: when Firestore is unreachable we must not hand out free
    // requests, otherwise a simulated outage becomes a trivial rate-limit
    // bypass. Prefer a short hiccup over granting unlimited AI usage.
    console.error('Rate limit check failed:', error);
    return { allowed: false, remaining: 0 };
  }
}
