import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDeviceToken } from './_lib/auth';
import { getRedis } from './_lib/redis';

/**
 * Account deletion endpoint (KVKK Art. 7 / GDPR Art. 17).
 *
 * Removes all server-side traces of this device:
 *   - Premium status cache
 *   - Promo-granted premium
 *   - Rate-limit counters for all features
 *   - Any tracked promo-code usage for this device
 *
 * Local data on the device is wiped by the client (services/privacy/dataPrivacy.ts).
 * Firestore `barcode_submissions` are community-contributed and de-identified,
 * so they are not removed here — but the deviceId column could be anonymised
 * in a scheduled Cloud Function sweep if desired.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const deviceId = getDeviceToken(req);
  if (!deviceId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const redis = getRedis();

    const keysToDelete = [
      `premium:${deviceId}`,
      `promo_premium:${deviceId}`,
    ];

    // Rate-limit keys are per day; scan a small window and delete.
    const today = new Date();
    for (let d = 0; d < 40; d++) {
      const date = new Date(today.getTime() - d * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      for (const feature of ['ai_coach', 'food_recognition', 'plan']) {
        keysToDelete.push(`ratelimit:${deviceId}:${feature}:${date}`);
      }
    }

    // Delete directly. Upstash supports variadic `del`.
    await redis.del(...keysToDelete);

    // Scrub promo_usage sets for any promo code that tracked this device.
    // (Best-effort: scan a reasonable number of known promo codes via env.)
    try {
      const promoRaw = process.env.PROMO_CODES;
      if (promoRaw) {
        const promoCodes = JSON.parse(promoRaw);
        for (const code of Object.keys(promoCodes)) {
          try {
            await redis.srem(`promo_usage:${code.toUpperCase()}`, deviceId);
          } catch {}
        }
      }
    } catch {}

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Delete account failed:', error?.message);
    // Even on error, return 200 so the client can proceed with local wipe.
    // The user's right to delete must not be blocked by a backend hiccup.
    return res.status(200).json({ success: false, message: 'Partial deletion' });
  }
}
