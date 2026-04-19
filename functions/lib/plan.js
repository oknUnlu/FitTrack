"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plan = void 0;
const https_1 = require("firebase-functions/v2/https");
const gemini_1 = require("./_lib/gemini");
const auth_1 = require("./_lib/auth");
const rateLimit_1 = require("./_lib/rateLimit");
const premiumVerifier_1 = require("./_lib/premiumVerifier");
const MAX_PROMPT_CHARS = 8000;
const MAX_SYSTEM_CHARS = 4000;
// Plan is pure text, no images — keep the payload ceiling tight.
const MAX_PAYLOAD_BYTES = 256 * 1024; // 256 KB
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
    // Stop oversize requests before we do any billable work.
    const rawLen = Number(req.headers['content-length'] || 0);
    if (rawLen > MAX_PAYLOAD_BYTES) {
        res.status(413).json({ success: false, message: 'Payload too large' });
        return;
    }
    const isPremium = await (0, premiumVerifier_1.verifyPremiumStatus)(deviceId);
    const { allowed, remaining } = await (0, rateLimit_1.checkRateLimit)({ feature: 'plan', isPremium, deviceId });
    if (!allowed) {
        res.status(429).json({ success: false, message: 'Rate limit exceeded', source: 'fallback' });
        return;
    }
    try {
        const body = (req.body || {});
        const planPrompt = body.planPrompt;
        const systemInstruction = body.systemInstruction;
        if (typeof planPrompt !== 'string' ||
            typeof systemInstruction !== 'string' ||
            planPrompt.length === 0 ||
            systemInstruction.length === 0 ||
            planPrompt.length > MAX_PROMPT_CHARS ||
            systemInstruction.length > MAX_SYSTEM_CHARS) {
            res.status(400).json({ success: false, message: 'Invalid request fields' });
            return;
        }
        const message = await (0, gemini_1.generateContent)(planPrompt, systemInstruction);
        res.set('X-RateLimit-Remaining', remaining.toString());
        res.status(200).json({ success: true, message, source: 'gemini_cloud' });
    }
    catch (error) {
        const msg = (_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : '';
        console.error('Plan error:', msg);
        if (msg.startsWith('SAFETY_BLOCKED')) {
            res.status(400).json({ success: false, message: 'Plan request blocked by safety filters', source: 'safety' });
            return;
        }
        if (msg.startsWith('BUDGET_EXCEEDED')) {
            res.status(503).json({ success: false, message: 'Service temporarily unavailable', source: 'fallback' });
            return;
        }
        // Never leak raw SDK / model error strings.
        res.status(500).json({ success: false, message: 'AI service error', source: 'gemini_cloud' });
    }
});
//# sourceMappingURL=plan.js.map