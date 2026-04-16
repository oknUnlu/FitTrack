import { onRequest } from 'firebase-functions/v2/https';

export const health = onRequest(
  { cors: true, timeoutSeconds: 10, memory: '128MiB', region: 'europe-west1', secrets: ['GEMINI_API_KEY'] },
  async (req, res) => {
    res.set('Cache-Control', 'public, s-maxage=60');
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      hasApiKey: !!process.env.GEMINI_API_KEY,
    });
  }
);
