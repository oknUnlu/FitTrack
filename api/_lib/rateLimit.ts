import type { RateLimitConfig } from './types';

// In-memory rate limiting (works per serverless instance)
// For production, replace with Vercel KV (Upstash Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const LIMITS: Record<string, { free: number; premium: number }> = {
  ai_coach: { free: 10, premium: 250 },
  food_recognition: { free: 3, premium: 999999 },
  plan: { free: 10, premium: 250 },
};

function getKey(deviceId: string, feature: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `${deviceId}:${feature}:${today}`;
}

function getMidnightMs(): number {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return tomorrow.getTime();
}

export function checkRateLimit(config: RateLimitConfig): { allowed: boolean; remaining: number } {
  const { feature, isPremium, deviceId } = config;
  const limits = LIMITS[feature];
  if (!limits) return { allowed: true, remaining: 999 };

  const maxRequests = isPremium ? limits.premium : limits.free;
  const key = getKey(deviceId, feature);
  const now = Date.now();

  let entry = rateLimitStore.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: getMidnightMs() };
    rateLimitStore.set(key, entry);
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 60 * 1000); // Every hour
