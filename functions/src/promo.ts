import { onRequest } from 'firebase-functions/v2/https';
import { getDeviceToken } from './_lib/auth';
import { db } from './_lib/admin';
import { FieldValue } from 'firebase-admin/firestore';

interface PromoCodeEntry {
  plan: string;
  durationDays: number;
  maxUses?: number;
}

function getPromoCodes(): Record<string, PromoCodeEntry> | null {
  const raw = process.env.PROMO_CODES;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export const promo = onRequest(
  { cors: true, timeoutSeconds: 15, memory: '256MiB', region: 'europe-west1', secrets: ['PROMO_CODES'] },
  async (req, res) => {
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') {
      res.status(405).json({ success: false, message: 'Method not allowed' });
      return;
    }

    const deviceId = getDeviceToken(req);
    if (!deviceId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { code } = req.body as { code?: string };
    if (!code || typeof code !== 'string') {
      res.status(400).json({ success: false, message: 'Missing promo code' });
      return;
    }

    const normalizedCode = code.trim().toUpperCase();
    const promoCodes = getPromoCodes();
    if (!promoCodes) {
      res.status(500).json({ success: false, message: 'Promo system not configured' });
      return;
    }

    const entry = promoCodes[normalizedCode];
    if (!entry) {
      res.status(404).json({ success: false, message: 'Invalid promo code' });
      return;
    }

    // Check max uses and uniqueness via Firestore transaction
    if (entry.maxUses) {
      const usageRef = db.collection('promo_usage').doc(normalizedCode);
      const allowed = await db.runTransaction(async (tx) => {
        const doc = await tx.get(usageRef);
        const usedBy: string[] = doc.data()?.usedBy ?? [];

        if (usedBy.includes(deviceId)) return 'already_used';
        if (usedBy.length >= entry.maxUses!) return 'expired';

        tx.set(usageRef, { usedBy: FieldValue.arrayUnion(deviceId) }, { merge: true });
        return 'ok';
      });

      if (allowed === 'already_used') {
        res.status(409).json({ success: false, message: 'Promo code already used' });
        return;
      }
      if (allowed === 'expired') {
        res.status(410).json({ success: false, message: 'Promo code expired' });
        return;
      }
    }

    const expiresAt = Date.now() + entry.durationDays * 24 * 60 * 60 * 1000;

    // Grant premium via Firestore
    await db.collection('promo_premium').doc(deviceId).set({ expiresAt });

    res.status(200).json({ success: true, plan: entry.plan, durationDays: entry.durationDays, expiresAt });
  }
);
