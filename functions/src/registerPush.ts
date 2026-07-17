import { onRequest } from 'firebase-functions/v2/https';
import { db } from './_lib/admin';
import { getDeviceToken } from './_lib/auth';

/**
 * Push reminder registration — the client posts its FCM token plus the
 * reminder preferences that used to live only in AsyncStorage. Reminders
 * are then delivered server-side by `sendReminders` (see reminders.ts)
 * because client-scheduled alarms are unreliable on aggressive OEMs
 * (MIUI batches or drops them, which is how users ended up with seven
 * "Drink Water" notifications at once).
 *
 * Doc id = deviceId (one device, one doc) so token rotation simply
 * overwrites. Collection `push_tokens` is server-only per firestore.rules
 * (default deny) — clients can only reach it through this endpoint.
 */

interface RegisterBody {
  fcmToken?: unknown;
  timezone?: unknown;
  language?: unknown;
  prefs?: { meal?: unknown; water?: unknown; workout?: unknown; supplement?: unknown };
  supplements?: unknown;
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const TIME_OF_DAY = new Set(['morning', 'afternoon', 'evening']);

export const registerPush = onRequest(
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

    const body = (req.body ?? {}) as RegisterBody;

    const fcmToken = typeof body.fcmToken === 'string' ? body.fcmToken.trim() : '';
    if (!fcmToken || fcmToken.length < 32 || fcmToken.length > 512) {
      res.status(400).json({ success: false, message: 'Invalid fcmToken' });
      return;
    }

    const timezone =
      typeof body.timezone === 'string' && isValidTimezone(body.timezone)
        ? body.timezone
        : 'Europe/Istanbul';

    const language =
      typeof body.language === 'string' && body.language.toLowerCase().startsWith('tr') ? 'tr' : 'en';

    const prefs = {
      meal: body.prefs?.meal === true,
      water: body.prefs?.water === true,
      workout: body.prefs?.workout === true,
      supplement: body.prefs?.supplement === true,
    };

    // Only the fields the sender needs: name + a fixed time slot. Anything
    // malformed is dropped rather than rejected so a bad supplement row
    // can't break water/meal reminders.
    const supplements = (Array.isArray(body.supplements) ? body.supplements : [])
      .filter(
        (s: any): s is { name: string; timeOfDay: string; dosage?: string } =>
          !!s &&
          typeof s.name === 'string' &&
          s.name.length > 0 &&
          s.name.length <= 100 &&
          typeof s.timeOfDay === 'string' &&
          TIME_OF_DAY.has(s.timeOfDay)
      )
      .slice(0, 30)
      .map((s: any) => ({
        name: String(s.name).slice(0, 100),
        timeOfDay: s.timeOfDay as string,
        dosage: typeof s.dosage === 'string' ? s.dosage.slice(0, 50) : '',
      }));

    try {
      await db.collection('push_tokens').doc(deviceId).set({
        fcmToken,
        timezone,
        language,
        prefs,
        supplements,
        updatedAt: Date.now(),
      });
      res.json({ success: true });
    } catch (e) {
      console.error('registerPush: write failed', e);
      res.status(500).json({ success: false, message: 'Internal error' });
    }
  }
);
