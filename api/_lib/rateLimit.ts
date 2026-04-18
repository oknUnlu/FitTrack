import type { RateLimitConfig } from './types';
import { getRedis } from './redis';

const LIMITS: Record<string, { free: number; premium: number }> = {
  ai_coach: { free: 10, premium: 250 },
  food_recognition: { free: 3, premium: 999999 },
  plan: { free: 10, premium: 250 },
};

function getTodayKey(deviceId: string, feature: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `ratelimit:${deviceId}:${feature}:${today}`;
}

function getSecondsUntilMidnightUTC(): number {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.ceil((tomorrow.getTime() - now.getTime()) / 1000);
}

export async function checkRateLimit(config: RateLimitConfig): Promise<{ allowed: boolean; remaining: number }> {
  const { feature, isPremium, deviceId } = config;
  const limits = LIMITS[feature];
  if (!limits) return { allowed: true, remaining: 999 };

  const maxRequests = isPremium ? limits.premium : limits.free;
  const key = getTodayKey(deviceId, feature);

  try {
    const redis = getRedis();

    // Atomically increment counter
    const count = await redis.incr(key);

    // Set expiry on first increment (key didn't exist before)
    if (count === 1) {
      await redis.expire(key, getSecondsUntilMidnightUTC());
    }

    if (count > maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    return { allowed: true, remaining: maxRequests - count };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // SECURITY: Fail-closed. A Redis outage must not let us expose the
    // expensive Gemini API quota to abuse. If the limiter cannot operate,
    // reject the request so the client retries later.
    return { allowed: false, remaining: 0 };
  }
}
