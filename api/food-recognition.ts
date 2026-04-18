import type { VercelRequest, VercelResponse } from '@vercel/node';
import { analyzeImage } from './_lib/gemini';
import { getDeviceToken, verifyPremiumStatus } from './_lib/auth';
import { checkRateLimit } from './_lib/rateLimit';
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const deviceId = getDeviceToken(req);
  if (!deviceId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const isPremium = await verifyPremiumStatus(deviceId);

  const { allowed, remaining } = await checkRateLimit({
    feature: 'food_recognition',
    isPremium,
    deviceId,
  });

  if (!allowed) {
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded',
    });
  }

  try {
    const { image, mimeType } = (req.body || {}) as FoodRecognitionRequest;

    if (!image || !mimeType || typeof image !== 'string' || typeof mimeType !== 'string') {
      return res.status(400).json({ success: false, message: 'Missing image or mimeType' });
    }
    if (image.length > 8 * 1024 * 1024) {
      return res.status(413).json({ success: false, message: 'Image too large' });
    }

    const text = await analyzeImage(image, mimeType, FOOD_PROMPT);

    // Parse JSON from response
    let jsonStr = text.trim();
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    let foods: RecognizedFood[] = [];
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        foods = parsed.filter(
          (f: any) => f && typeof f.name === 'string' && typeof f.calories === 'number' && f.calories >= 0
        );
      }
    } catch {
      foods = [];
    }

    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    return res.status(200).json({ success: true, foods });
  } catch (error: any) {
    console.error('Food recognition error:', error?.message);
    const msg = String(error?.message || '');
    if (msg.startsWith('SAFETY_BLOCKED') || msg.startsWith('INVALID_IMAGE')) {
      return res.status(400).json({ success: false, message: 'Image rejected', foods: [] });
    }
    if (msg.startsWith('BUDGET_EXCEEDED')) {
      return res.status(503).json({ success: false, message: 'AI service temporarily unavailable', foods: [] });
    }
    return res.status(500).json({
      success: false,
      message: 'Recognition error',
      foods: [],
    });
  }
}
