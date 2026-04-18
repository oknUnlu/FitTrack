import { onRequest } from 'firebase-functions/v2/https';
import { generateContent } from './_lib/gemini';
import { getDeviceToken } from './_lib/auth';
import { checkRateLimit } from './_lib/rateLimit';
import { verifyPremiumStatus } from './_lib/premiumVerifier';
import type { PlanRequest } from './_lib/types';

const MAX_PROMPT_CHARS = 8000;
const MAX_SYSTEM_CHARS = 4000;
// Plan is pure text, no images — keep the payload ceiling tight.
const MAX_PAYLOAD_BYTES = 256 * 1024; // 256 KB

export const plan = onRequest(
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

    // Stop oversize requests before we do any billable work.
    const rawLen = Number(req.headers['content-length'] || 0);
    if (rawLen > MAX_PAYLOAD_BYTES) {
      res.status(413).json({ success: false, message: 'Payload too large' });
      return;
    }

    const isPremium = await verifyPremiumStatus(deviceId);
    const { allowed, remaining } = await checkRateLimit({ feature: 'plan', isPremium, deviceId });

    if (!allowed) {
      res.status(429).json({ success: false, message: 'Rate limit exceeded', source: 'fallback' });
      return;
    }

    try {
      const body = (req.body || {}) as Partial<PlanRequest>;
      const planPrompt = body.planPrompt;
      const systemInstruction = body.systemInstruction;

      if (
        typeof planPrompt !== 'string' ||
        typeof systemInstruction !== 'string' ||
        planPrompt.length === 0 ||
        systemInstruction.length === 0 ||
        planPrompt.length > MAX_PROMPT_CHARS ||
        systemInstruction.length > MAX_SYSTEM_CHARS
      ) {
        res.status(400).json({ success: false, message: 'Invalid request fields' });
        return;
      }

      const message = await generateContent(planPrompt, systemInstruction);
      res.set('X-RateLimit-Remaining', remaining.toString());
      res.status(200).json({ success: true, message, source: 'gemini_cloud' });
    } catch (error: any) {
      const msg: string = error?.message ?? '';
      console.error('Plan error:', msg);

      if (msg.startsWith('SAFETY_BLOCKED')) {
        res.status(400).json({ success: false, message: 'Plan request blocked by safety filters', source: 'safety' });
        return;
      }
      if (msg.startsWith('BUDGET_EXCEEDED')) {
        res.status(503).json({ success: false, message: 'Service temporarily unavailable', source: 'fallback' });
        return;
      }
      // Never leak raw SDK / model error strings.
      res.status(500).json({ success: false, message: 'AI service error', source: 'gemini_cloud' });
    }
  }
);
