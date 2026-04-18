import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateContent } from './_lib/gemini';
import { getDeviceToken, verifyPremiumStatus } from './_lib/auth';
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

  const isPremium = await verifyPremiumStatus(deviceId);

  const { allowed, remaining } = await checkRateLimit({
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
    const { planPrompt, systemInstruction } = (req.body || {}) as PlanRequest;

    if (!planPrompt || !systemInstruction ||
        typeof planPrompt !== 'string' || typeof systemInstruction !== 'string') {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    if (planPrompt.length > 8000 || systemInstruction.length > 4000) {
      return res.status(413).json({ success: false, message: 'Payload too large' });
    }

    const message = await generateContent(planPrompt, systemInstruction);

    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    return res.status(200).json({
      success: true,
      message,
      source: 'gemini_cloud',
    });
  } catch (error: any) {
    console.error('Plan error:', error?.message);
    const msg = String(error?.message || '');
    if (msg.startsWith('SAFETY_BLOCKED')) {
      return res.status(400).json({
        success: false,
        message: 'Request was blocked by the AI safety filter',
        source: 'gemini_cloud',
      });
    }
    if (msg.startsWith('BUDGET_EXCEEDED')) {
      return res.status(503).json({
        success: false,
        message: 'AI service temporarily unavailable',
        source: 'fallback',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'AI service error',
      source: 'gemini_cloud',
    });
  }
}
