"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPurchase = void 0;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("./_lib/auth");
const premiumVerifier_1 = require("./_lib/premiumVerifier");
const PLAN_DURATIONS = {
    fittrack_premium_monthly: 30,
    fittrack_premium_quarterly: 90,
    fittrack_premium_yearly: 365,
};
async function getGoogleAccessToken() {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountJson)
        return null;
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
        const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(`${header}.${payload}`);
        const signature = sign.sign(sa.private_key, 'base64url');
        const jwt = `${header}.${payload}.${signature}`;
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
        });
        if (!tokenRes.ok)
            return null;
        const data = await tokenRes.json();
        return data.access_token;
    }
    catch (e) {
        console.error('Failed to get access token:', e);
        return null;
    }
}
exports.verifyPurchase = (0, https_1.onRequest)({ cors: true, timeoutSeconds: 30, memory: '256MiB', region: 'europe-west1' }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ success: false, message: 'Method not allowed' });
        return;
    }
    const deviceId = (0, auth_1.getDeviceToken)(req);
    if (!deviceId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    const { purchaseToken, productId } = req.body;
    if (!purchaseToken || !productId) {
        res.status(400).json({ success: false, message: 'Missing purchaseToken or productId' });
        return;
    }
    const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.okanu.fittrack';
    const accessToken = await getGoogleAccessToken();
    if (accessToken) {
        try {
            const verifyUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
            const verifyRes = await fetch(verifyUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!verifyRes.ok) {
                res.status(400).json({ success: false, message: 'Invalid purchase' });
                return;
            }
            const purchase = await verifyRes.json();
            const expiryMs = parseInt(purchase.expiryTimeMillis || '0', 10);
            if (expiryMs < Date.now()) {
                res.status(400).json({ success: false, message: 'Subscription expired' });
                return;
            }
            const plan = productId.includes('yearly') ? 'yearly' : productId.includes('quarterly') ? 'quarterly' : 'monthly';
            await (0, premiumVerifier_1.grantPremiumStatus)(deviceId, plan, expiryMs);
            res.status(200).json({ success: true, plan, expiresAt: expiryMs });
            return;
        }
        catch (error) {
            console.error('Google Play verification failed:', error.message);
            res.status(500).json({ success: false, message: 'Verification failed' });
            return;
        }
    }
    // Fallback (dev only — configure GOOGLE_SERVICE_ACCOUNT_KEY in production)
    const durationDays = PLAN_DURATIONS[productId] || 30;
    const expiresAt = Date.now() + durationDays * 24 * 60 * 60 * 1000;
    const plan = productId.includes('yearly') ? 'yearly' : productId.includes('quarterly') ? 'quarterly' : 'monthly';
    await (0, premiumVerifier_1.grantPremiumStatus)(deviceId, plan, expiresAt);
    res.status(200).json({ success: true, plan, expiresAt, warning: 'GOOGLE_SERVICE_ACCOUNT_KEY not configured' });
});
//# sourceMappingURL=verifyPurchase.js.map