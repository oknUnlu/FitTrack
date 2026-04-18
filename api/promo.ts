import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDeviceToken } from './_lib/auth';
import { getRedis } from './_lib/redis';

/**
 * Promo code validation endpoint.
 *
 * Promo codes are stored in the PROMO_CODES environment variable as JSON:
 * {
 *   "FITTRACK2024": { "plan": "yearly", "durationDays": 365 },
 *   "VIP30":        { "plan": "monthly", "durationDays": 30 },
 *   "LIFETIME":     { "plan": "yearly", "durationDays": 3650 }
 * }
 *
 * Each code can optionally have:
 *   - maxUses: number (default: unlimited)
 *
 * Usage tracking is persistent via Redis (shared across all serverless instances).
 */

interface PromoCodeEntry {
  plan: string;
  durationDays: number;
  maxUses?: number;
}

function getPromoCodes(): Record<string, PromoCodeEntry> | null {
  const raw = process.env.PROMO_CODES;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    console.error('Failed to parse PROMO_CODES env variable');
    return null;
  }
}

// CORS whitelist. Keep narrow — mobile app uses native fetch (no CORS),
// so only our own web origins ever need to hit this endpoint.
const CORS_ALLOW_LIST = new Set<string>([
  'https://fittrack-a958c.web.app',
  'https://fittrack-a958c.firebaseapp.com',
]);

function applyCors(req: VercelRequest, res: VercelResponse): void {
  const origin = (req.headers.origin as string | undefined) || '';
  if (origin && CORS_ALLOW_LIST.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Auth
  const deviceId = getDeviceToken(req);
  if (!deviceId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Body
  const { code } = (req.body || {}) as { code?: string };
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, message: 'Missing promo code' });
  }
  if (code.length > 64) {
    return res.status(400).json({ success: false, message: 'Invalid promo code' });
  }

  const normalizedCode = code.trim().toUpperCase();
  // Only allow alphanumeric + dash/underscore to prevent weird Redis key injection.
  if (!/^[A-Z0-9_-]{1,64}$/.test(normalizedCode)) {
    return res.status(400).json({ success: false, message: 'Invalid promo code' });
  }

  // Load codes
  const promoCodes = getPromoCodes();
  if (!promoCodes) {
    return res.status(500).json({ success: false, message: 'Promo system not configured' });
  }

  const entry = promoCodes[normalizedCode];
  if (!entry) {
    return res.status(404).json({ success: false, message: 'Invalid promo code' });
  }

  const redis = getRedis();

  // Check max uses (persistent via Redis)
  if (entry.maxUses) {
    const usageKey = `promo_usage:${normalizedCode}`;
    const currentUses = await redis.scard(usageKey);
    if (currentUses >= entry.maxUses) {
      return res.status(410).json({ success: false, message: 'Promo code expired' });
    }
    // Check if this device already used this code
    const alreadyUsed = await redis.sismember(usageKey, deviceId);
    if (alreadyUsed) {
      return res.status(409).json({ success: false, message: 'Promo code already used' });
    }
    // Track usage
    await redis.sadd(usageKey, deviceId);
  }

  // Calculate expiry
  const expiresAt = Date.now() + entry.durationDays * 24 * 60 * 60 * 1000;
  const ttlSeconds = entry.durationDays * 24 * 60 * 60;

  // Grant premium status in Redis (used by premiumVerifier.ts)
  const promoKey = `promo_premium:${deviceId}`;
  await redis.set(promoKey, expiresAt, { ex: ttlSeconds });

  return res.status(200).json({
    success: true,
    plan: entry.plan,
    durationDays: entry.durationDays,
    expiresAt,
  });
}
