import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDeviceToken } from './_lib/auth';
import { grantPremiumStatus } from './_lib/premiumVerifier';

/**
 * Google Play purchase verification endpoint.
 *
 * After a successful Google Play purchase, the client sends the purchase token
 * here for server-side verification. The server validates the purchase with
 * Google Play Developer API and grants premium status in Redis.
 *
 * Required env vars:
 *   GOOGLE_PLAY_PACKAGE_NAME — e.g. "com.okanu.fittrack"
 *   GOOGLE_SERVICE_ACCOUNT_KEY — JSON stringified service account key
 */

interface VerifyRequest {
  purchaseToken: string;
  productId: string;
}

const PLAN_DURATIONS: Record<string, number> = {
  fittrack_premium_monthly: 30,
  fittrack_premium_quarterly: 90,
  fittrack_premium_yearly: 365,
};

async function getAccessToken(): Promise<string | null> {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountJson) return null;

  try {
    const sa = JSON.parse(serviceAccountJson);

    // Create JWT
    const now = Math.floor(Date.now() / 1000);
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }));

    // Sign JWT with service account private key
    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(sa.private_key, 'base64url');

    const jwt = `${header}.${payload}.${signature}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!tokenResponse.ok) return null;
    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (e) {
    console.error('Failed to get access token:', e);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const deviceId = getDeviceToken(req);
  if (!deviceId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { purchaseToken, productId } = req.body as VerifyRequest;
  if (!purchaseToken || !productId) {
    return res.status(400).json({ success: false, message: 'Missing purchaseToken or productId' });
  }

  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.okanu.fittrack';

  // If Google service account is configured, verify with Google Play API
  const accessToken = await getAccessToken();

  if (accessToken) {
    try {
      const verifyUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;

      const verifyResponse = await fetch(verifyUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!verifyResponse.ok) {
        return res.status(400).json({ success: false, message: 'Invalid purchase' });
      }

      const purchase = await verifyResponse.json();

      // Check if subscription is active
      // paymentState: 0 = pending, 1 = received, 2 = free trial, 3 = deferred
      if (purchase.paymentState === undefined || purchase.cancelReason !== undefined) {
        // Check expiryTimeMillis
        const expiryMs = parseInt(purchase.expiryTimeMillis || '0', 10);
        if (expiryMs < Date.now()) {
          return res.status(400).json({ success: false, message: 'Subscription expired' });
        }
      }

      const expiryMs = parseInt(purchase.expiryTimeMillis || '0', 10);
      const plan = productId.includes('yearly') ? 'yearly'
        : productId.includes('quarterly') ? 'quarterly'
        : 'monthly';

      await grantPremiumStatus(deviceId, plan, expiryMs);

      return res.status(200).json({
        success: true,
        plan,
        expiresAt: expiryMs,
      });
    } catch (error: any) {
      console.error('Google Play verification failed:', error.message);
      return res.status(500).json({ success: false, message: 'Verification failed' });
    }
  }

  // Fallback: If Google service account is not configured, trust the client
  // (only for development — in production, always configure GOOGLE_SERVICE_ACCOUNT_KEY)
  const durationDays = PLAN_DURATIONS[productId] || 30;
  const expiresAt = Date.now() + durationDays * 24 * 60 * 60 * 1000;
  const plan = productId.includes('yearly') ? 'yearly'
    : productId.includes('quarterly') ? 'quarterly'
    : 'monthly';

  await grantPremiumStatus(deviceId, plan, expiresAt);

  return res.status(200).json({
    success: true,
    plan,
    expiresAt,
    warning: 'GOOGLE_SERVICE_ACCOUNT_KEY not configured — purchase not verified with Google',
  });
}
