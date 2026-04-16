import { onRequest } from 'firebase-functions/v2/https';
import { db } from './_lib/admin';

export const usage = onRequest(
  { cors: false, timeoutSeconds: 10, memory: '128MiB', region: 'europe-west1', secrets: ['ADMIN_API_KEY', 'MONTHLY_BUDGET_LIMIT'] },
  async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).json({ success: false, message: 'Method not allowed' });
      return;
    }

    const adminKey = process.env.ADMIN_API_KEY;
    if (!adminKey || req.headers['x-admin-key'] !== adminKey) {
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
      res.status(500).json({ success: false, message: error.message });
    }
  }
);
