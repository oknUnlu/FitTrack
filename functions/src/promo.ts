import { onRequest } from 'firebase-functions/v2/https';
import { getDeviceToken } from './_lib/auth';
import { db } from './_lib/admin';
import { FieldValue } from 'firebase-admin/firestore';

interface PromoCodeEntry {
  plan: string;
  durationDays: number;
  maxUses?: number;
}

// Promo codes are short alphanumeric strings. Reject anything else outright
// so a malicious client can't smuggle control characters, whitespace tricks,
// or oversize payloads through the normaliser.
const PROMO_CODE_REGEX = /^[A-Z0-9_-]{3,32}$/;
const MAX_CODE_LEN = 64;

function getPromoCodes(): Record<string, PromoCodeEntry> | null {
  const raw = process.env.PROMO_CODES;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, PromoCodeEntry>;
    }
    return null;
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

    const body = (req.body || {}) as { code?: unknown };
    const rawCode = body.code;

    if (typeof rawCode !== 'string' || rawCode.length === 0 || rawCode.length > MAX_CODE_LEN) {
      res.status(400).json({ success: false, message: 'Invalid promo code' });
      return;
    }

    const normalizedCode = rawCode.trim().toUpperCase();
    if (!PROMO_CODE_REGEX.test(normalizedCode)) {
      // Reject bad shapes without telling the caller which character tripped
      // the check — a noisy error message just invites fuzzing.
      res.status(400).json({ success: false, message: 'Invalid promo code' });
      return;
    }

    const promoCodes = getPromoCodes();
    if (!promoCodes) {
      // Configuration missing or malformed — refuse rather than silently
      // handing out premium.
      res.status(503).json({ success: false, message: 'Promo system not configured' });
      return;
    }

    const entry = promoCodes[normalizedCode];
    if (!entry || typeof entry.plan !== 'string' || typeof entry.durationDays !== 'number' || entry.durationDays <= 0) {
      // Treat unknown codes and malformed entries the same way: an attacker
      // should not be able to tell them apart via the error string.
      res.status(404).json({ success: false, message: 'Invalid promo code' });
      return;
    }

    try {
      // Check max uses and uniqueness via Firestore transaction.
      if (entry.maxUses && entry.maxUses > 0) {
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

      // Grant premium via Firestore.
      await db.collection('promo_premium').doc(deviceId).set({ expiresAt });

      res.status(200).json({ success: true, plan: entry.plan, durationDays: entry.durationDays, expiresAt });
    } catch (error: any) {
      console.error('Promo error:', error?.message);
      res.status(500).json({ success: false, message: 'Promo redemption failed' });
    }
  }
);
