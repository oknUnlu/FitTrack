import { onRequest } from 'firebase-functions/v2/https';
import { analyzeImage } from './_lib/gemini';
import { getDeviceToken } from './_lib/auth';
import { checkRateLimit } from './_lib/rateLimit';
import { verifyPremiumStatus } from './_lib/premiumVerifier';
import type { FoodRecognitionRequest, RecognizedFood } from './_lib/types';

const FOOD_PROMPT = `You are a Turkish nutrition assistant. Analyze this food photo and estimate the TOTAL calorie value of the food actually visible in the picture.

For each distinct food item you see, return ONE entry with the TOTAL nutritional values for what is in the photo (NOT per-100g, NOT per-recipe).

How to estimate:
- Identify the food, then judge its visible portion size from common Turkish servings.
- Typical references: pizza dilimi ~120g, pilav porsiyon ~150g, çorba kase ~250g, salata kase ~150g, ekmek dilimi ~30g, döner porsiyon ~200g, ayran bardak ~200ml, çay bardak ~150ml.
- "calories", "protein", "carbs", "fat" are TOTALS for the visible portion.
- "servingSize" is the estimated weight (or volume) of the visible portion.
- "servingDescription" is a short Turkish phrase describing the portion (e.g. "1 dilim", "1 kase", "1 porsiyon", "1 büyük bardak").

Return ONLY a valid JSON array (no markdown, no explanation):
[
  {
    "name": "Yemeğin Türkçe adı",
    "calories": 320,
    "protein": 14,
    "carbs": 42,
    "fat": 12,
    "servingSize": 120,
    "servingUnit": "g",
    "servingDescription": "1 dilim",
    "confidence": "high"
  }
]

Rules:
- If no food is visible, return [].
- servingUnit is "g" for solids, "ml" for liquids.
- confidence is "high", "medium", or "low".
- If multiple items are visible (e.g. plate of pilav with chicken and salad), return one entry per distinct item.
- Always respond with ONLY the JSON array, nothing else.`;

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
