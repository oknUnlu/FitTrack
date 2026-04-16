import { onRequest } from 'firebase-functions/v2/https';
import { analyzeImage } from './_lib/gemini';
import { getDeviceToken } from './_lib/auth';
import { checkRateLimit } from './_lib/rateLimit';
import { verifyPremiumStatus } from './_lib/premiumVerifier';
import type { FoodRecognitionRequest, RecognizedFood } from './_lib/types';

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

export const foodRecognition = onRequest(
  { cors: true, timeoutSeconds: 120, memory: '1GiB', region: 'europe-west1', secrets: ['GEMINI_API_KEY', 'MONTHLY_BUDGET_LIMIT'] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ success: false, message: 'Method not allowed' });
      return;
    }

    const deviceId = getDeviceToken(req);
    if (!deviceId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const isPremium = await verifyPremiumStatus(deviceId);
    const { allowed, remaining } = await checkRateLimit({ feature: 'food_recognition', isPremium, deviceId });

    if (!allowed) {
      res.status(429).json({ success: false, message: 'Rate limit exceeded' });
      return;
    }

    try {
      const { image, mimeType } = req.body as FoodRecognitionRequest;
      if (!image || !mimeType) {
        res.status(400).json({ success: false, message: 'Missing image or mimeType' });
        return;
      }

      const text = await analyzeImage(image, mimeType, FOOD_PROMPT);

      let jsonStr = text.trim();
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (jsonMatch) jsonStr = jsonMatch[0];

      const foods: RecognizedFood[] = JSON.parse(jsonStr).filter(
        (f: RecognizedFood) => f.name && f.calories >= 0
      );

      res.set('X-RateLimit-Remaining', remaining.toString());
      res.status(200).json({ success: true, foods });
    } catch (error: any) {
      console.error('Food recognition error:', error.message);
      res.status(500).json({ success: false, message: `Recognition error: ${error.message}`, foods: [] });
    }
  }
);
