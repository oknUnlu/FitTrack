import { onRequest } from 'firebase-functions/v2/https';
import * as crypto from 'crypto';
import { db } from './_lib/admin';

// We require a reasonably strong admin key. Anything shorter than this is
// almost certainly a human-chosen string and trivially brute-forceable.
const MIN_ADMIN_KEY_LEN = 24;

/**
 * Constant-time comparison wrapper. `crypto.timingSafeEqual` throws if the
 * buffers aren't equal length, so we normalise that up front. Without this
 * an attacker can distinguish "wrong length" from "wrong value" by timing.
 */
function safeCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export const usage = onRequest(
  { cors: false, timeoutSeconds: 10, memory: '128MiB', region: 'europe-west1', secrets: ['ADMIN_API_KEY', 'MONTHLY_BUDGET_LIMIT'] },
  async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).json({ success: false, message: 'Method not allowed' });
      return;
    }

    const adminKey = process.env.ADMIN_API_KEY;
    const provided = req.headers['x-admin-key'];

    // Refuse to run without a configured key AND refuse weak keys. A missing
    // or short admin secret is a configuration bug, not something we should
    // silently paper over.
    if (!adminKey || adminKey.length < MIN_ADMIN_KEY_LEN) {
      console.error('usage: ADMIN_API_KEY missing or too short — refusing request.');
      res.status(503).json({ success: false, message: 'Admin endpoint not configured' });
      return;
    }
    if (typeof provided !== 'string' || !safeCompare(provided, adminKey)) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    try {
      const now = new Date();
      const dailyId = `daily:${now.toISOString().split('T')[0]}`;
      const monthlyId = `monthly:${now.toISOString().slice(0, 7)}`;

      const [dailyDoc, monthlyDoc] = await Promise.all([
        db.collection('usage_stats').doc(dailyId).get(),
        db.collection('usage_stats').doc(monthlyId).get(),
      ]);

      const monthly = monthlyDoc.data() || {};
      const budgetLimit = parseInt(process.env.MONTHLY_BUDGET_LIMIT || '', 10) || 10000;
      const monthlyTotal = (monthly.total_count as number) || 0;

      res.status(200).json({
        success: true,
        daily: dailyDoc.data() || {},
        monthly,
        budget: {
          limit: budgetLimit,
          used: monthlyTotal,
          remaining: Math.max(0, budgetLimit - monthlyTotal),
          percentUsed: Math.round((monthlyTotal / budgetLimit) * 100),
        },
      });
    } catch (error: any) {
      // Don't echo internal error text — just log server-side.
      console.error('usage error:', error?.message);
      res.status(500).json({ success: false, message: 'Usage query failed' });
    }
  }
);
