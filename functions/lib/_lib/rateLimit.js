"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRateLimit = checkRateLimit;
const admin_1 = require("./admin");
const firestore_1 = require("firebase-admin/firestore");
const LIMITS = {
    ai_coach: { free: 0, premium: 10 },
    food_recognition: { free: 0, premium: 7 },
    food_estimate: { free: 0, premium: 7 },
    plan: { free: 0, premium: 10 },
};
function getSecondsUntilMidnightUTC() {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return Math.ceil((tomorrow.getTime() - now.getTime()) / 1000);
}
async function checkRateLimit(config) {
    const { feature, isPremium, deviceId } = config;
    const limits = LIMITS[feature];
    if (!limits)
        return { allowed: true, remaining: 999 };
    const maxRequests = isPremium ? limits.premium : limits.free;
    const today = new Date().toISOString().split('T')[0];
    const docId = `${deviceId}:${feature}:${today}`;
    const docRef = admin_1.db.collection('rate_limits').doc(docId);
    try {
        const result = await admin_1.db.runTransaction(async (tx) => {
            var _a, _b, _c, _d, _e, _f;
            const doc = await tx.get(docRef);
            const now = Date.now();
            if (!doc.exists || ((_d = (_c = (_b = (_a = doc.data()) === null || _a === void 0 ? void 0 : _a.expiresAt) === null || _b === void 0 ? void 0 : _b.toMillis) === null || _c === void 0 ? void 0 : _c.call(_b)) !== null && _d !== void 0 ? _d : 0) < now) {
                const expiresAt = new Date(now + getSecondsUntilMidnightUTC() * 1000);
                tx.set(docRef, { count: 1, expiresAt });
                return { allowed: true, remaining: maxRequests - 1 };
            }
            const count = (_f = (_e = doc.data()) === null || _e === void 0 ? void 0 : _e.count) !== null && _f !== void 0 ? _f : 0;
            if (count >= maxRequests) {
                return { allowed: false, remaining: 0 };
            }
            tx.update(docRef, { count: firestore_1.FieldValue.increment(1) });
            return { allowed: true, remaining: maxRequests - count - 1 };
        });
        return result;
    }
    catch (error) {
        // Fail-closed: when Firestore is unreachable we must not hand out free
        // requests, otherwise a simulated outage becomes a trivial rate-limit
        // bypass. Prefer a short hiccup over granting unlimited AI usage.
        console.error('Rate limit check failed:', error);
        return { allowed: false, remaining: 0 };
    }
}
//# sourceMappingURL=rateLimit.js.map