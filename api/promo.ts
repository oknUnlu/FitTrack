import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDeviceToken } from './_lib/auth';

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
 *   - usedBy: string[] (tracked in-memory per instance; for persistent tracking use a DB)
 */

interface PromoCodeEntry {
  plan: string;
  durationDays: number;
  maxUses?: number;
}

// In-memory usage tracking (per serverless instance)
// For production with high traffic, consider using Vercel KV / Upstash Redis
const usageStore = new Map<string, Set<string>>();

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
  const { code } = req.body as { code?: string };
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, message: 'Missing promo code' });
  }

  const normalizedCode = code.trim().toUpperCase();

  // Load codes
  const promoCodes = getPromoCodes();
  if (!promoCodes) {
    return res.status(500).json({ success: false, message: 'Promo system not configured' });
  }

  const entry = promoCodes[normalizedCode];
  if (!entry) {
    return res.status(404).json({ success: false, message: 'Invalid promo code' });
  }

  // Check max uses (per serverless instance)
  if (entry.maxUses) {
    const usedSet = usageStore.get(normalizedCode) || new Set();
    if (usedSet.size >= entry.maxUses) {
      return res.status(410).json({ success: false, message: 'Promo code expired' });
    }
    // Track usage
    usedSet.add(deviceId);
    usageStore.set(normalizedCode, usedSet);
  }

  // Calculate expiry
  const expiresAt = Date.now() + entry.durationDays * 24 * 60 * 60 * 1000;

  return res.status(200).json({
    success: true,
    plan: entry.plan,
    durationDays: entry.durationDays,
    expiresAt,
  });
}
