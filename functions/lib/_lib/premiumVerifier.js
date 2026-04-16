"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPremiumStatus = verifyPremiumStatus;
exports.grantPremiumStatus = grantPremiumStatus;
const admin_1 = require("./admin");
const firestore_1 = require("firebase-admin/firestore");
/**
 * Verify premium status server-side using Firestore cache.
 * Premium is granted by /verifyPurchase or /promo endpoints.
 * Fail-closed: returns false on any error.
 */
async function verifyPremiumStatus(deviceId) {
    var _a, _b, _c, _d;
    try {
        // 1. Check promo-granted premium
        const promoDoc = await admin_1.db.collection('promo_premium').doc(deviceId).get();
        if (promoDoc.exists) {
            const expiresAt = (_b = (_a = promoDoc.data()) === null || _a === void 0 ? void 0 : _a.expiresAt) !== null && _b !== void 0 ? _b : 0;
            if (expiresAt > Date.now())
                return true;
        }
        // 2. Check purchase-granted premium
        const premiumDoc = await admin_1.db.collection('premium_status').doc(deviceId).get();
        if (premiumDoc.exists) {
            const data = premiumDoc.data();
            if ((data === null || data === void 0 ? void 0 : data.isPremium) && ((_d = (_c = data === null || data === void 0 ? void 0 : data.expiresAt) === null || _c === void 0 ? void 0 : _c.toMillis) === null || _d === void 0 ? void 0 : _d.call(_c)) > Date.now()) {
                return true;
            }
        }
        return false;
    }
    catch (error) {
        console.error('Premium verification failed:', error);
        return false;
    }
}
/**
 * Grant premium status after successful Google Play purchase verification.
 */
async function grantPremiumStatus(deviceId, plan, expiresAtMs) {
    const expiresAt = new Date(expiresAtMs);
    await admin_1.db.collection('premium_status').doc(deviceId).set({
        isPremium: true,
        plan,
        expiresAt,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
}
//# sourceMappingURL=premiumVerifier.js.map