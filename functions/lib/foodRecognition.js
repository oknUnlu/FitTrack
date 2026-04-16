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
exports.foodRecognition = (0, https_1.onRequest)({ cors: true, timeoutSeconds: 120, memory: '1GiB', region: 'europe-west1', secrets: ['GEMINI_API_KEY', 'MONTHLY_BUDGET_LIMIT'] }, async (req, res) => {
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
    const { allowed, remaining } = await (0, rateLimit_1.checkRateLimit)({ feature: 'food_recognition', isPremium, deviceId });
    if (!allowed) {
        res.status(429).json({ success: false, message: 'Rate limit exceeded' });
        return;
    }
    try {
        const { image, mimeType } = req.body;
        if (!image || !mimeType) {
            res.status(400).json({ success: false, message: 'Missing image or mimeType' });
            return;
        }
        const text = await (0, gemini_1.analyzeImage)(image, mimeType, FOOD_PROMPT);
        let jsonStr = text.trim();
        const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (jsonMatch)
            jsonStr = jsonMatch[0];
        const foods = JSON.parse(jsonStr).filter((f) => f.name && f.calories >= 0);
        res.set('X-RateLimit-Remaining', remaining.toString());
        res.status(200).json({ success: true, foods });
    }
    catch (error) {
        console.error('Food recognition error:', error.message);
        res.status(500).json({ success: false, message: `Recognition error: ${error.message}`, foods: [] });
    }
});
//# sourceMappingURL=foodRecognition.js.map