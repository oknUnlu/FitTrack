"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plan = void 0;
const https_1 = require("firebase-functions/v2/https");
const gemini_1 = require("./_lib/gemini");
const auth_1 = require("./_lib/auth");
const rateLimit_1 = require("./_lib/rateLimit");
const premiumVerifier_1 = require("./_lib/premiumVerifier");
exports.plan = (0, https_1.onRequest)({ cors: true, timeoutSeconds: 60, memory: '512MiB', region: 'europe-west1', secrets: ['GEMINI_API_KEY', 'MONTHLY_BUDGET_LIMIT'] }, async (req, res) => {
    var _a;
    if (req.method !== 'POST') {
        res.status(405).json({ success: false, message: 'Method not allowed' });
        return;
    }
    const deviceId = (0, auth_1.getDeviceToken)(req);
    if (!deviceId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    const isPremium = await (0, premiumVerifier_1.verifyPremiumStatus)(deviceId);
    const { allowed, remaining } = await (0, rateLimit_1.checkRateLimit)({ feature: 'plan', isPremium, deviceId });
    if (!allowed) {
        res.status(429).json({ success: false, message: 'Rate limit exceeded', source: 'fallback' });
        return;
    }
    try {
        const { planPrompt, systemInstruction } = req.body;
        if (!planPrompt || !systemInstruction) {
            res.status(400).json({ success: false, message: 'Missing required fields' });
            return;
        }
        const message = await (0, gemini_1.generateContent)(planPrompt, systemInstruction);
        res.set('X-RateLimit-Remaining', remaining.toString());
        res.status(200).json({ success: true, message, source: 'gemini_cloud' });
    }
    catch (error) {
        console.error('Plan error:', error.message);
        if ((_a = error.message) === null || _a === void 0 ? void 0 : _a.startsWith('BUDGET_EXCEEDED')) {
            res.status(503).json({ success: false, message: 'Service temporarily unavailable', source: 'fallback' });
            return;
        }
        res.status(500).json({ success: false, message: `AI error: ${error.message}`, source: 'gemini_cloud' });
    }
});
//# sourceMappingURL=plan.js.map