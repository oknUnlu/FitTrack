"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promo = void 0;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("./_lib/auth");
const admin_1 = require("./_lib/admin");
const firestore_1 = require("firebase-admin/firestore");
// Promo codes are short alphanumeric strings. Reject anything else outright
// so a malicious client can't smuggle control characters, whitespace tricks,
// or oversize payloads through the normaliser.
const PROMO_CODE_REGEX = /^[A-Z0-9_-]{3,32}$/;
const MAX_CODE_LEN = 64;
function getPromoCodes() {
    const raw = process.env.PROMO_CODES;
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed;
        }
        return null;
    }
    catch (_a) {
        return null;
    }
}
exports.promo = (0, https_1.onRequest)({ cors: true, timeoutSeconds: 15, memory: '256MiB', region: 'europe-west1', secrets: ['PROMO_CODES'] }, async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ success: false, message: 'Method not allowed' });
        return;
    }
    const deviceId = (0, auth_1.getDeviceToken)(req);
    if (!deviceId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    const body = (req.body || {});
    const rawCode = body.code;
    if (typeof rawCode !== 'string' || rawCode.length === 0 || rawCode.length > MAX_CODE_LEN) {
        res.status(400).json({ success: false, message: 'Invalid promo code' });
        return;
    }
    const normalizedCode = rawCode.trim().toUpperCase();
    if (!PROMO_CODE_REGEX.test(normalizedCode)) {
        // Reject bad shapes without telling the caller which character tripped
        // the check — a noisy error message just invites fuzzing.
        res.status(400).json({ success: false, message: 'Invalid promo code' });
        return;
    }
    const promoCodes = getPromoCodes();
    if (!promoCodes) {
        // Configuration missing or malformed — refuse rather than silently
        // handing out premium.
        res.status(503).json({ success: false, message: 'Promo system not configured' });
        return;
    }
    const entry = promoCodes[normalizedCode];
    if (!entry || typeof entry.plan !== 'string' || typeof entry.durationDays !== 'number' || entry.durationDays <= 0) {
        // Treat unknown codes and malformed entries the same way: an attacker
        // should not be able to tell them apart via the error string.
        res.status(404).json({ success: false, message: 'Invalid promo code' });
        return;
    }
    try {
        // Check max uses and uniqueness via Firestore transaction.
        if (entry.maxUses && entry.maxUses > 0) {
            const usageRef = admin_1.db.collection('promo_usage').doc(normalizedCode);
            const allowed = await admin_1.db.runTransaction(async (tx) => {
                var _a, _b;
                const doc = await tx.get(usageRef);
                const usedBy = (_b = (_a = doc.data()) === null || _a === void 0 ? void 0 : _a.usedBy) !== null && _b !== void 0 ? _b : [];
                if (usedBy.includes(deviceId))
                    return 'already_used';
                if (usedBy.length >= entry.maxUses)
                    return 'expired';
                tx.set(usageRef, { usedBy: firestore_1.FieldValue.arrayUnion(deviceId) }, { merge: true });
                return 'ok';
            });
            if (allowed === 'already_used') {
                res.status(409).json({ success: false, message: 'Promo code already used' });
                return;
            }
            if (allowed === 'expired') {
                res.status(410).json({ success: false, message: 'Promo code expired' });
                return;
            }
        }
        const expiresAt = Date.now() + entry.durationDays * 24 * 60 * 60 * 1000;
        // Grant premium via Firestore.
        await admin_1.db.collection('promo_premium').doc(deviceId).set({ expiresAt });
        res.status(200).json({ success: true, plan: entry.plan, durationDays: entry.durationDays, expiresAt });
    }
    catch (error) {
        console.error('Promo error:', error === null || error === void 0 ? void 0 : error.message);
        res.status(500).json({ success: false, message: 'Promo redemption failed' });
    }
});
//# sourceMappingURL=promo.js.map