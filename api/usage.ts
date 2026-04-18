import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { getRedis } from './_lib/redis';

// Constant-time string compare to prevent timing attacks against admin key.
function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Admin auth via secret key. Require ADMIN_API_KEY to be configured and
  // at least 24 chars long — reject outright otherwise (no silent open door).
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey || adminKey.length < 24) {
    console.error('ADMIN_API_KEY not configured or too short — /api/usage disabled');
    return res.status(503).json({ success: false, message: 'Admin endpoint not configured' });
  }
  const authHeader = req.headers['x-admin-key'];
  if (typeof authHeader !== 'string' || !safeEqual(authHeader, adminKey)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const redis = getRedis();
    const now = new Date();
    const todayKey = `usage:daily:${now.toISOString().split('T')[0]}`;
    const monthKey = `usage:monthly:${now.toISOString().slice(0, 7)}`;

    const [daily, monthly] = await Promise.all([
      redis.hgetall(todayKey),
      redis.hgetall(monthKey),
    ]);

    const budgetLimit = parseInt(process.env.MONTHLY_BUDGET_LIMIT || '', 10) || 10000;
    const monthlyTotal = (monthly?.total_count as number) || 0;

    return res.status(200).json({
      success: true,
      daily: daily || {},
      monthly: monthly || {},
      budget: {
        limit: budgetLimit,
        used: monthlyTotal,
        remaining: Math.max(0, budgetLimit - monthlyTotal),
        percentUsed: Math.round((monthlyTotal / budgetLimit) * 100),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
