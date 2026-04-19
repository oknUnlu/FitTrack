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
exports.usage = void 0;
const https_1 = require("firebase-functions/v2/https");
const crypto = __importStar(require("crypto"));
const admin_1 = require("./_lib/admin");
// We require a reasonably strong admin key. Anything shorter than this is
// almost certainly a human-chosen string and trivially brute-forceable.
const MIN_ADMIN_KEY_LEN = 24;
/**
 * Constant-time comparison wrapper. `crypto.timingSafeEqual` throws if the
 * buffers aren't equal length, so we normalise that up front. Without this
 * an attacker can distinguish "wrong length" from "wrong value" by timing.
 */
function safeCompare(a, b) {
    const ab = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ab.length !== bb.length)
        return false;
    return crypto.timingSafeEqual(ab, bb);
}
exports.usage = (0, https_1.onRequest)({ cors: false, timeoutSeconds: 10, memory: '128MiB', region: 'europe-west1', secrets: ['ADMIN_API_KEY', 'MONTHLY_BUDGET_LIMIT'] }, async (req, res) => {
    if (req.method !== 'GET') {
        res.status(405).json({ success: false, message: 'Method not allowed' });
        return;
    }
    const adminKey = process.env.ADMIN_API_KEY;
    const provided = req.headers['x-admin-key'];
    // Refuse to run without a configured key AND refuse weak keys. A missing
    // or short admin secret is a configuration bug, not something we should
    // silently paper over.
    if (!adminKey || adminKey.length < MIN_ADMIN_KEY_LEN) {
        console.error('usage: ADMIN_API_KEY missing or too short — refusing request.');
        res.status(503).json({ success: false, message: 'Admin endpoint not configured' });
        return;
    }
    if (typeof provided !== 'string' || !safeCompare(provided, adminKey)) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    try {
        const now = new Date();
        const dailyId = `daily:${now.toISOString().split('T')[0]}`;
        const monthlyId = `monthly:${now.toISOString().slice(0, 7)}`;
        const [dailyDoc, monthlyDoc] = await Promise.all([
            admin_1.db.collection('usage_stats').doc(dailyId).get(),
            admin_1.db.collection('usage_stats').doc(monthlyId).get(),
        ]);
        const monthly = monthlyDoc.data() || {};
        const budgetLimit = parseInt(process.env.MONTHLY_BUDGET_LIMIT || '', 10) || 10000;
        const monthlyTotal = monthly.total_count || 0;
        res.status(200).json({
            success: true,
            daily: dailyDoc.data() || {},
            monthly,
            budget: {
                limit: budgetLimit,
                used: monthlyTotal,
                remaining: Math.max(0, budgetLimit - monthlyTotal),
                percentUsed: Math.round((monthlyTotal / budgetLimit) * 100),
            },
        });
    }
    catch (error) {
        // Don't echo internal error text — just log server-side.
        console.error('usage error:', error === null || error === void 0 ? void 0 : error.message);
        res.status(500).json({ success: false, message: 'Usage query failed' });
    }
});
//# sourceMappingURL=usage.js.map