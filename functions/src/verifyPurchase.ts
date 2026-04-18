import { onRequest } from 'firebase-functions/v2/https';
import { getDeviceToken } from './_lib/auth';
import { grantPremiumStatus } from './_lib/premiumVerifier';

// Strict product whitelist — anything else is rejected outright. Prevents an
// attacker from minting their own product identifiers and confusing the grant
// logic below.
const ALLOWED_PRODUCT_IDS = new Set<string>([
  'fittrack_premium_monthly',
  'fittrack_premium_quarterly',
  'fittrack_premium_yearly',
]);

const PLAN_FROM_PRODUCT: Record<string, 'monthly' | 'quarterly' | 'yearly'> = {
  fittrack_premium_monthly: 'monthly',
  fittrack_premium_quarterly: 'quarterly',
  fittrack_premium_yearly: 'yearly',
};

// Loose but defensive input caps — Google purchase tokens are ~2 kB, product
// IDs are short strings. Anything outside this range is garbage or attack.
const MAX_TOKEN_LEN = 2048;
const MAX_PRODUCT_ID_LEN = 128;

async function getGoogleAccessToken(): Promise<string | null> {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountJson) return null;

  try {
    const sa = JSON.parse(serviceAccountJson);
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })).toString('base64url');

    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(sa.private_key, 'base64url');
    const jwt = `${header}.${payload}.${signature}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!tokenRes.ok) return null;
    const data = await tokenRes.json() as { access_token: string };
    return data.access_token;
  } catch (e) {
    console.error('Failed to get access token:', e);
    return null;
  }
}

export const verifyPurchase = onRequest(
  { cors: true, timeoutSeconds: 30, memory: '256MiB', region: 'europe-west1', secrets: ['GOOGLE_SERVICE_ACCOUNT_KEY', 'GOOGLE_PLAY_PACKAGE_NAME'] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ success: false, message: 'Method not allowed' });
      return;
    }

    const deviceId = getDeviceToken(req);
    if (!deviceId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const body = (req.body || {}) as { purchaseToken?: unknown; productId?: unknown };
    const purchaseToken = body.purchaseToken;
    const productId = body.productId;

    // Strict input validation — refuse anything non-string, oversized, or
    // not in our product whitelist. We never trust client-supplied product IDs.
    if (
      typeof purchaseToken !== 'string' ||
      typeof productId !== 'string' ||
      purchaseToken.length === 0 ||
      purchaseToken.length > MAX_TOKEN_LEN ||
      productId.length === 0 ||
      productId.length > MAX_PRODUCT_ID_LEN
    ) {
      res.status(400).json({ success: false, message: 'Invalid purchaseToken or productId' });
      return;
    }

    if (!ALLOWED_PRODUCT_IDS.has(productId)) {
      res.status(400).json({ success: false, message: 'Unknown product' });
      return;
    }

    const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
    if (!packageName) {
      // Refuse to proceed without a configured package name — otherwise an
      // attacker could target someone else's app.
      res.status(503).json({ success: false, message: 'Billing backend not configured' });
      return;
    }

    const accessToken = await getGoogleAccessToken();

    if (!accessToken) {
      // CRITICAL: no silent fallback to "grant premium anyway". An absent
      // service-account key means we literally cannot verify the purchase,
      // so we must refuse. Previous versions of this file handed out a free
      // premium subscription in this branch — that bypass is now closed.
      console.error('verifyPurchase: GOOGLE_SERVICE_ACCOUNT_KEY not configured — refusing to grant premium.');
      res.status(503).json({ success: false, message: 'Purchase verification temporarily unavailable' });
      return;
    }

    try {
      const verifyUrl =
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
        `${encodeURIComponent(packageName)}/purchases/subscriptions/` +
        `${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
      const verifyRes = await fetch(verifyUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!verifyRes.ok) {
        res.status(400).json({ success: false, message: 'Invalid purchase' });
        return;
      }

      const purchase = (await verifyRes.json()) as {
        expiryTimeMillis?: string;
        paymentState?: number;
        cancelReason?: number;
      };

      const expiryMs = parseInt(purchase.expiryTimeMillis || '0', 10);
      if (!expiryMs || expiryMs < Date.now()) {
        res.status(400).json({ success: false, message: 'Subscription expired' });
        return;
      }

      // paymentState: 0=pending, 1=received, 2=free trial, 3=pending deferred
      // Only 1 and 2 represent an active paid or free-trial state that we
      // should honour. Pending (0/3) must not grant premium.
      if (purchase.paymentState !== 1 && purchase.paymentState !== 2) {
        res.status(400).json({ success: false, message: 'Subscription not active' });
        return;
      }

      const plan = PLAN_FROM_PRODUCT[productId];
      await grantPremiumStatus(deviceId, plan, expiryMs);
      res.status(200).json({ success: true, plan, expiresAt: expiryMs });
    } catch (error: any) {
      console.error('Google Play verification failed:', error?.message);
      res.status(500).json({ success: false, message: 'Verification failed' });
    }
  }
);
