import { onRequest } from 'firebase-functions/v2/https';
import { db } from './_lib/admin';
import { getDeviceToken } from './_lib/auth';

/**
 * Lightweight funnel-event log for growth measurement (onboarding →
 * first value → paywall → purchase). One doc per event, auto-id, so a
 * device can log the same name more than once (the client is expected to
 * de-dupe "first_*" events locally before calling this).
 *
 * Collection `events` is server-only per firestore.rules — clients can
 * only reach it through this endpoint.
 */

const ALLOWED_EVENTS = new Set([
  'onboarding_completed',
  'first_calorie_entry',
  'first_photo_analysis',
  'paywall_seen',
  'purchase_started',
  'purchase_completed',
]);

const MAX_PROP_KEYS = 10;

/** Flat primitive-only props map, capped in size so a bad client can't bloat Firestore. */
function sanitizeProps(value: unknown): Record<string, string | number | boolean> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const out: Record<string, string | number | boolean> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>).slice(0, MAX_PROP_KEYS)) {
    if (typeof key !== 'string' || key.length === 0 || key.length > 40) continue;
    if (typeof v === 'string') out[key] = v.slice(0, 200);
    else if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
    else if (typeof v === 'boolean') out[key] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

interface EventBody {
  name?: unknown;
  props?: unknown;
}

export const event = onRequest(
  { cors: false, timeoutSeconds: 10, memory: '128MiB', region: 'europe-west1' },
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

    const body = (req.body ?? {}) as EventBody;
    const name = typeof body.name === 'string' ? body.name : '';
    if (!ALLOWED_EVENTS.has(name)) {
      res.status(400).json({ success: false, message: 'Unknown event name' });
      return;
    }

    const props = sanitizeProps(body.props);

    try {
      await db.collection('events').add({
        deviceId,
        name,
        ...(props ? { props } : {}),
        createdAt: Date.now(),
      });
      res.json({ success: true });
    } catch (e) {
      console.error('event: write failed', e);
      res.status(500).json({ success: false, message: 'Internal error' });
    }
  }
);
