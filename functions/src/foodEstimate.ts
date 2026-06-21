import { onRequest } from 'firebase-functions/v2/https';
import { generateContent } from './_lib/gemini';
import { getDeviceToken } from './_lib/auth';
import { checkRateLimit } from './_lib/rateLimit';
import { verifyPremiumStatus } from './_lib/premiumVerifier';
import type { RecognizedFood } from './_lib/types';

// Text-based nutrition estimation. The user types a food name (optionally with
// a portion, e.g. "1 kase mercimek çorbası") and the model returns the TOTAL
// nutritional values for that described portion — the same wire shape the
// photo flow (`foodRecognition`) returns, so the client reuses the identical
// totals→per-100g conversion.
const ESTIMATE_PROMPT = `You are a Turkish nutrition assistant. The user gives you a short text describing a food, optionally including a portion (e.g. "1 kase mercimek çorbası", "2 dilim ekmek", "100 gram tavuk göğsü", "bir tabak pilav").

Return ONE JSON object with the TOTAL estimated nutritional values for the described portion (NOT per-100g, NOT per-recipe).

How to estimate:
- Identify the food from the text, then judge the portion size.
- If the user states an explicit amount (grams, dilim, kase, tabak, bardak, adet), use it.
- If no amount is given, assume ONE common Turkish serving of that food.
- Typical references: pizza dilimi ~120g, pilav porsiyon ~150g, çorba kase ~250g, salata kase ~150g, ekmek dilimi ~30g, döner porsiyon ~200g, ayran bardak ~200ml, çay bardak ~150ml.
- "calories", "protein", "carbs", "fat" are TOTALS for the described portion.
- "servingSize" is the estimated weight (or volume) of that portion.
- "servingDescription" is a short Turkish phrase describing the portion (e.g. "1 dilim", "1 kase", "1 porsiyon", "1 büyük bardak").

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "name": "Yemeğin Türkçe adı",
  "calories": 168,
  "protein": 9.6,
  "carbs": 27,
  "fat": 2.7,
  "servingSize": 250,
  "servingUnit": "g",
  "servingDescription": "1 kase",
  "confidence": "high"
}

Rules:
- If the text does not describe a recognizable food, return null.
- servingUnit is "g" for solids, "ml" for liquids.
- confidence is "high", "medium", or "low".
- Always respond with ONLY the JSON object (or null), nothing else.`;

const MAX_QUERY_LENGTH = 120;

export const foodEstimate = onRequest(
  { cors: true, timeoutSeconds: 60, memory: '512MiB', region: 'europe-west1', secrets: ['GEMINI_API_KEY', 'MONTHLY_BUDGET_LIMIT'] },
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
    const { allowed, remaining } = await checkRateLimit({ feature: 'food_estimate', isPremium, deviceId });

    if (!allowed) {
      res.status(429).json({ success: false, message: 'Rate limit exceeded' });
      return;
    }

    try {
      const body = (req.body || {}) as { query?: unknown };
      const query = typeof body.query === 'string' ? body.query.trim() : '';

      if (!query) {
        res.status(400).json({ success: false, message: 'Missing query' });
        return;
      }
      if (query.length > MAX_QUERY_LENGTH) {
        res.status(400).json({ success: false, message: 'Query too long' });
        return;
      }

      const text = await generateContent(query, ESTIMATE_PROMPT);

      let jsonStr = text.trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // Model may legitimately answer "null" for an unrecognizable food.
        res.status(200).json({ success: true, food: null });
        return;
      }

      const f = parsed as Partial<RecognizedFood> | null;
      if (!f || typeof f.name !== 'string' || typeof f.calories !== 'number' || f.calories < 0) {
        res.status(200).json({ success: true, food: null });
        return;
      }

      const food: RecognizedFood = {
        name: f.name,
        calories: f.calories,
        protein: typeof f.protein === 'number' ? f.protein : 0,
        carbs: typeof f.carbs === 'number' ? f.carbs : 0,
        fat: typeof f.fat === 'number' ? f.fat : 0,
        servingSize: typeof f.servingSize === 'number' && f.servingSize > 0 ? f.servingSize : 100,
        servingUnit: f.servingUnit === 'ml' ? 'ml' : 'g',
        servingDescription: typeof f.servingDescription === 'string' ? f.servingDescription : undefined,
        confidence: typeof f.confidence === 'string' ? f.confidence : 'medium',
      };

      res.set('X-RateLimit-Remaining', remaining.toString());
      res.status(200).json({ success: true, food });
    } catch (error: any) {
      const msg: string = error?.message ?? '';
      console.error('Food estimate error:', msg);
      if (msg.startsWith('SAFETY_BLOCKED')) {
        res.status(400).json({ success: false, message: 'Blocked by safety filters', food: null });
        return;
      }
      if (msg.startsWith('BUDGET_EXCEEDED')) {
        res.status(503).json({ success: false, message: 'Service temporarily unavailable', food: null });
        return;
      }
      res.status(500).json({ success: false, message: 'Estimate error', food: null });
    }
  }
);
