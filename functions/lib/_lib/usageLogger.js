"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logUsage = logUsage;
exports.getMonthlyUsage = getMonthlyUsage;
const admin_1 = require("./admin");
const firestore_1 = require("firebase-admin/firestore");
async function logUsage(feature, durationMs) {
    try {
        const now = new Date();
        const dailyId = `daily:${now.toISOString().split('T')[0]}`;
        const monthlyId = `monthly:${now.toISOString().slice(0, 7)}`;
        const batch = admin_1.db.batch();
        const increment = firestore_1.FieldValue.increment(1);
        const durationIncrement = firestore_1.FieldValue.increment(Math.round(durationMs));
        const dailyRef = admin_1.db.collection('usage_stats').doc(dailyId);
        const monthlyRef = admin_1.db.collection('usage_stats').doc(monthlyId);
        batch.set(dailyRef, {
            [`${feature}_count`]: increment,
            total_count: increment,
            total_duration_ms: durationIncrement,
        }, { merge: true });
        batch.set(monthlyRef, {
            [`${feature}_count`]: increment,
            total_count: increment,
            total_duration_ms: durationIncrement,
        }, { merge: true });
        await batch.commit();
    }
    catch (error) {
        console.error('Usage logging failed:', error);
    }
}
async function getMonthlyUsage() {
    var _a, _b;
    try {
        const monthlyId = `monthly:${new Date().toISOString().slice(0, 7)}`;
        const doc = await admin_1.db.collection('usage_stats').doc(monthlyId).get();
        return (_b = (_a = doc.data()) === null || _a === void 0 ? void 0 : _a.total_count) !== null && _b !== void 0 ? _b : 0;
    }
    catch (_c) {
        return 0;
    }
}
//# sourceMappingURL=usageLogger.js.map