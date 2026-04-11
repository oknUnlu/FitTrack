import type { VercelRequest, VercelResponse } from '@vercel/node';
import { chat } from './_lib/gemini';
import { getDeviceToken, verifyPremiumStatus } from './_lib/auth';
import { checkRateLimit } from './_lib/rateLimit';
import type { ChatRequest } from './_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const deviceId = getDeviceToken(req);
  if (!deviceId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const isPremium = await verifyPremiumStatus(deviceId);

  // Rate limit check
  const { allowed, remaining } = await checkRateLimit({
    feature: 'ai_coach',
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
    const { prompt, systemInstruction, history } = req.body as ChatRequest;

    if (!prompt || !systemInstruction) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const message = await chat(prompt, systemInstruction, history || []);

    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    return res.status(200).json({
      success: true,
      message,
      source: 'gemini_cloud',
    });
  } catch (error: any) {
    console.error('Chat error:', error.message);
    return res.status(500).json({
      success: false,
      message: `AI error: ${error.message}`,
      source: 'gemini_cloud',
    });
  }
}
