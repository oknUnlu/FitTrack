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

// Images are inlined as base64 — keep the payload ceiling a bit above 8 MB of
// raw image bytes so we don't accidentally reject legitimate iOS HEIC photos.
const MAX_PAYLOAD_BYTES = 12 * 1024 * 1024; // 12 MB
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

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

    const rawLen = Number(req.headers['content-length'] || 0);
    if (rawLen > MAX_PAYLOAD_BYTES) {
      res.status(413).json({ success: false, message: 'Image too large' });
      return;
    }

    const isPremium = await verifyPremiumStatus(deviceId);
    const { allowed, remaining } = await checkRateLimit({ feature: 'food_recognition', isPremium, deviceId });

    if (!allowed) {
      res.status(429).json({ success: false, message: 'Rate limit exceeded' });
      return;
    }

    try {
      const body = (req.body || {}) as Partial<FoodRecognitionRequest>;
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

      const text = await analyzeImage(image, mimeType, FOOD_PROMPT);

      let jsonStr = text.trim();
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (jsonMatch) jsonStr = jsonMatch[0];

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        res.status(502).json({ success: false, message: 'Model returned non-JSON', foods: [] });
        return;
      }
      if (!Array.isArray(parsed)) {
        res.status(200).json({ success: true, foods: [] });
        return;
      }

      const foods: RecognizedFood[] = (parsed as RecognizedFood[]).filter(
        (f) => f && typeof f.name === 'string' && typeof f.calories === 'number' && f.calories >= 0
      );

      res.set('X-RateLimit-Remaining', remaining.toString());
      res.status(200).json({ success: true, foods });
    } catch (error: any) {
      const msg: string = error?.message ?? '';
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
  }
);
