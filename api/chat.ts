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
    const { prompt, systemInstruction, history } = (req.body || {}) as ChatRequest;

    if (!prompt || !systemInstruction ||
        typeof prompt !== 'string' || typeof systemInstruction !== 'string') {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    if (prompt.length > 8000 || systemInstruction.length > 4000) {
      return res.status(413).json({ success: false, message: 'Payload too large' });
    }
    if (history && !Array.isArray(history)) {
      return res.status(400).json({ success: false, message: 'Invalid history format' });
    }
    const safeHistory = Array.isArray(history)
      ? history
          .filter((m: any) => m && (m.role === 'user' || m.role === 'model') && typeof m.content === 'string')
          .slice(-20)
      : [];

    const message = await chat(prompt, systemInstruction, safeHistory);

    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    return res.status(200).json({
      success: true,
      message,
      source: 'gemini_cloud',
    });
  } catch (error: any) {
    console.error('Chat error:', error?.message);
    // Distinguish safety blocks from other errors without leaking internals.
    const msg = String(error?.message || '');
    if (msg.startsWith('SAFETY_BLOCKED')) {
      return res.status(400).json({
        success: false,
        message: 'Your request was blocked by the AI safety filter. Please rephrase.',
        source: 'gemini_cloud',
      });
    }
    if (msg.startsWith('BUDGET_EXCEEDED')) {
      return res.status(503).json({
        success: false,
        message: 'AI service is temporarily unavailable. Please try again later.',
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
