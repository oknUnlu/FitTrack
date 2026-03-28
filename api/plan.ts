import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateContent } from './_lib/gemini';
import { getDeviceToken, isPremiumRequest } from './_lib/auth';
import { checkRateLimit } from './_lib/rateLimit';
import type { PlanRequest } from './_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const deviceId = getDeviceToken(req);
  if (!deviceId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const isPremium = isPremiumRequest(req);

  const { allowed, remaining } = checkRateLimit({
    feature: 'plan',
    isPremium,
    deviceId,
  });

  if (!allowed) {
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded',
      source: 'fallback',
    });
  }

  try {
    const { planPrompt, systemInstruction } = req.body as PlanRequest;

    if (!planPrompt || !systemInstruction) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const message = await generateContent(planPrompt, systemInstruction);

    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    return res.status(200).json({
      success: true,
      message,
      source: 'gemini_cloud',
    });
  } catch (error: any) {
    console.error('Plan error:', error.message);
    return res.status(500).json({
      success: false,
      message: `AI error: ${error.message}`,
      source: 'gemini_cloud',
    });
  }
}
