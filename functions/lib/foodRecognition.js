"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.foodRecognition = void 0;
const https_1 = require("firebase-functions/v2/https");
const gemini_1 = require("./_lib/gemini");
const auth_1 = require("./_lib/auth");
const rateLimit_1 = require("./_lib/rateLimit");
const premiumVerifier_1 = require("./_lib/premiumVerifier");
const FOOD_PROMPT = `Analyze this food image and identify all food items visible.
For each item, estimate the nutritional values per serving.

Return ONLY a valid JSON array with this format (no markdown, no explanation):
[
  {
    "name": "Food name in Turkish",
    "calories": 250,
    "protein": 15,
    "carbs": 30,
    "fat": 8,
    "servingSize": 100,
    "servingUnit": "g",
    "confidence": "high"
  }
]

If no food is detected, return an empty array: []
Confidence can be "high", "medium", or "low".
Always respond with ONLY the JSON array, nothing else.`;
// Images are inlined as base64 — keep the payload ceiling a bit above 8 MB of
// raw image bytes so we don't accidentally reject legitimate iOS HEIC photos.
const MAX_PAYLOAD_BYTES = 12 * 1024 * 1024; // 12 MB
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
exports.foodRecognition = (0, https_1.onRequest)({ cors: true, timeoutSeconds: 120, memory: '1GiB', region: 'europe-west1', secrets: ['GEMINI_API_KEY', 'MONTHLY_BUDGET_LIMIT'] }, async (req, res) => {
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
    const rawLen = Number(req.headers['content-length'] || 0);
    if (rawLen > MAX_PAYLOAD_BYTES) {
        res.status(413).json({ success: false, message: 'Image too large' });
        return;
    }
    const isPremium = await (0, premiumVerifier_1.verifyPremiumStatus)(deviceId);
    const { allowed, remaining } = await (0, rateLimit_1.checkRateLimit)({ feature: 'food_recognition', isPremium, deviceId });
    if (!allowed) {
        res.status(429).json({ success: false, message: 'Rate limit exceeded' });
        return;
    }
    try {
        const body = (req.body || {});
        const image = body.image;
        const mimeType = body.mimeType;
        if (typeof image !== 'string' || typeof mimeType !== 'string' || !image.length) {
            res.status(400).json({ success: false, message: 'Missing image or mimeType' });
            return;
        }
        if (!ALLOWED_MIMES.has(mimeType)) {
            res.status(400).json({ success: false, message: 'Unsupported image type' });
            return;
        }
        const text = await (0, gemini_1.analyzeImage)(image, mimeType, FOOD_PROMPT);
        let jsonStr = text.trim();
        const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (jsonMatch)
            jsonStr = jsonMatch[0];
        let parsed;
        try {
            parsed = JSON.parse(jsonStr);
        }
        catch (_b) {
            res.status(502).json({ success: false, message: 'Model returned non-JSON', foods: [] });
            return;
        }
        if (!Array.isArray(parsed)) {
            res.status(200).json({ success: true, foods: [] });
            return;
        }
        const foods = parsed.filter((f) => f && typeof f.name === 'string' && typeof f.calories === 'number' && f.calories >= 0);
        res.set('X-RateLimit-Remaining', remaining.toString());
        res.status(200).json({ success: true, foods });
    }
    catch (error) {
        const msg = (_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : '';
        console.error('Food recognition error:', msg);
        if (msg.startsWith('SAFETY_BLOCKED')) {
            res.status(400).json({ success: false, message: 'Image blocked by safety filters', foods: [] });
            return;
        }
        if (msg.startsWith('INVALID_IMAGE')) {
            res.status(400).json({ success: false, message: 'Invalid image', foods: [] });
            return;
        }
        if (msg.startsWith('BUDGET_EXCEEDED')) {
            res.status(503).json({ success: false, message: 'Service temporarily unavailable', foods: [] });
            return;
        }
        res.status(500).json({ success: false, message: 'Recognition error', foods: [] });
    }
});
//# sourceMappingURL=foodRecognition.js.map