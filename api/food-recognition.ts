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
    const { image, mimeType } = req.body as FoodRecognitionRequest;

    if (!image || !mimeType) {
      return res.status(400).json({ success: false, message: 'Missing image or mimeType' });
    }

    const text = await analyzeImage(image, mimeType, FOOD_PROMPT);

    // Parse JSON from response
    let jsonStr = text.trim();
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const foods: RecognizedFood[] = JSON.parse(jsonStr).filter(
      (f: RecognizedFood) => f.name && f.calories >= 0
    );

    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    return res.status(200).json({ success: true, foods });
  } catch (error: any) {
    console.error('Food recognition error:', error.message);
    return res.status(500).json({
      success: false,
      message: `Recognition error: ${error.message}`,
      foods: [],
    });
  }
}
