"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promo = void 0;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("./_lib/auth");
const admin_1 = require("./_lib/admin");
const firestore_1 = require("firebase-admin/firestore");
function getPromoCodes() {
    const raw = process.env.PROMO_CODES;
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch (_a) {
        return null;
    }
}
exports.promo = (0, https_1.onRequest)({ cors: true, timeoutSeconds: 15, memory: '256MiB', region: 'europe-west1' }, async (req, res) => {
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
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
        res.status(400).json({ success: false, message: 'Missing promo code' });
        return;
    }
    const normalizedCode = code.trim().toUpperCase();
    const promoCodes = getPromoCodes();
    if (!promoCodes) {
        res.status(500).json({ success: false, message: 'Promo system not configured' });
        return;
    }
    const entry = promoCodes[normalizedCode];
    if (!entry) {
        res.status(404).json({ success: false, message: 'Invalid promo code' });
        return;
    }
    // Check max uses and uniqueness via Firestore transaction
    if (entry.maxUses) {
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
    // Grant premium via Firestore
    await admin_1.db.collection('promo_premium').doc(deviceId).set({ expiresAt });
    res.status(200).json({ success: true, plan: entry.plan, durationDays: entry.durationDays, expiresAt });
});
//# sourceMappingURL=promo.js.map