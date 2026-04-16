import { onRequest } from 'firebase-functions/v2/https';
import { chat as geminiChat } from './_lib/gemini';
import { getDeviceToken } from './_lib/auth';
import { checkRateLimit } from './_lib/rateLimit';
import { verifyPremiumStatus } from './_lib/premiumVerifier';
import type { ChatRequest } from './_lib/types';

export const chat = onRequest(
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
    const { allowed, remaining } = await checkRateLimit({ feature: 'ai_coach', isPremium, deviceId });

    if (!allowed) {
      res.status(429).json({ success: false, message: 'Rate limit exceeded', source: 'fallback' });
      return;
    }

    try {
      const { prompt, systemInstruction, history } = req.body as ChatRequest;
      if (!prompt || !systemInstruction) {
        res.status(400).json({ success: false, message: 'Missing required fields' });
        return;
      }

      const message = await geminiChat(prompt, systemInstruction, history || []);
      res.set('X-RateLimit-Remaining', remaining.toString());
      res.status(200).json({ success: true, message, source: 'gemini_cloud' });
    } catch (error: any) {
      console.error('Chat error:', error.message);
      if (error.message?.startsWith('BUDGET_EXCEEDED')) {
        res.status(503).json({ success: false, message: 'Service temporarily unavailable', source: 'fallback' });
        return;
      }
      res.status(500).json({ success: false, message: `AI error: ${error.message}`, source: 'gemini_cloud' });
    }
  }
);
