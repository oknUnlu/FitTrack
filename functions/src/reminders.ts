import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { db } from './_lib/admin';

/**
 * Server-side reminder delivery over FCM.
 *
 * Why server push instead of client-scheduled alarms: aggressive OEM power
 * managers (notably MIUI) defer or drop AlarmManager broadcasts for
 * backgrounded apps, then flush the whole backlog at once — users reported
 * seven identical "Drink Water" notifications arriving together, or none
 * all day. High-priority FCM is delivered by Play services, which is exempt
 * from those restrictions, so timing is reliable.
 *
 * Runs every 30 minutes on the :00/:30 grid. For each registered device we
 * compute the LOCAL wall-clock time in its timezone and send whatever is due
 * at exactly that minute. Each category ships with a stable Android
 * notification `tag`, so even if several messages get queued for an offline
 * device they REPLACE each other in the shade instead of stacking, and
 * `collapseKey` collapses undelivered ones FCM-side.
 */

interface TokenDoc {
  fcmToken: string;
  timezone: string;
  language: 'tr' | 'en';
  prefs: { meal: boolean; water: boolean; workout: boolean; supplement: boolean };
  supplements: Array<{ name: string; timeOfDay: string; dosage?: string }>;
}

// Mirrors the client tables in src/services/notifications/notificationService.ts.
const WATER_TIMES = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'];
const MEAL_TIMES: Record<string, { tr: [string, string]; en: [string, string] }> = {
  '08:00': {
    tr: ['🍳 Kahvaltı Zamanı', 'Güne sağlıklı bir kahvaltıyla başla!'],
    en: ['🍳 Breakfast Time', 'Start your day with a healthy breakfast!'],
  },
  '12:30': {
    tr: ['🥗 Öğle Yemeği Zamanı', 'Öğle yemeğini kaydetmeyi unutma!'],
    en: ['🥗 Lunch Time', "Don't forget to log your lunch!"],
  },
  '19:00': {
    tr: ['🍽️ Akşam Yemeği Zamanı', 'Akşam yemeğini kaydetmeyi unutma!'],
    en: ['🍽️ Dinner Time', "Don't forget to log your dinner!"],
  },
};
const WORKOUT_TIME = '17:30';
const SUPPLEMENT_TIMES: Record<string, string> = {
  morning: '08:00',
  afternoon: '14:00',
  evening: '20:00',
};

const WATER_TEXT = {
  tr: ['💧 Su İç!', 'Bir bardak su içmeyi unutma. Vücudunun suya ihtiyacı var!'] as const,
  en: ['💧 Drink Water!', "Don't forget to drink a glass of water. Your body needs hydration!"] as const,
};
const WORKOUT_TEXT = {
  tr: ['💪 Antrenman Zamanı!', 'Bugün için antrenman planlamıştın. Hadi başlayalım!'] as const,
  en: ['💪 Workout Time!', "You planned a workout today. Let's get moving!"] as const,
};

/**
 * Local HH:MM for a timezone, snapped to the nearest 30-minute grid mark;
 * falls back to UTC on bad tz.
 *
 * Every reminder time in this file sits exactly on a 30-minute mark, and the
 * scheduler runs on a matching 30-minute grid — but Cloud Scheduler
 * jitter or a Cloud Run cold start can delay the actual tick by a minute or
 * more (observed: a 09:00 tick firing at 09:01, which starved that whole
 * slot). Without snapping, the exact-match lookups below (`WATER_TIMES`,
 * `MEAL_TIMES`, etc.) silently miss and drop the reminder with no error
 * logged. Rounding to the nearest grid mark absorbs that jitter.
 */
function localTime(now: Date, timezone: string): string {
  let formatted: string;
  try {
    formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
  } catch {
    formatted = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  }
  const [hour, minute] = formatted.split(':').map(Number);
  const snappedTotal = (Math.round((hour * 60 + minute) / 30) * 30) % 1440;
  const snappedHour = Math.floor(snappedTotal / 60);
  const snappedMinute = snappedTotal % 60;
  return `${String(snappedHour).padStart(2, '0')}:${String(snappedMinute).padStart(2, '0')}`;
}

interface Due {
  tag: 'water_reminder' | 'meal_reminder' | 'workout_reminder' | 'supplement_reminder';
  title: string;
  body: string;
}

function dueMessages(doc: TokenDoc, hhmm: string): Due[] {
  const lang: 'tr' | 'en' = doc.language === 'tr' ? 'tr' : 'en';
  const due: Due[] = [];

  if (doc.prefs?.water && WATER_TIMES.includes(hhmm)) {
    const [title, body] = WATER_TEXT[lang];
    due.push({ tag: 'water_reminder', title, body });
  }
  if (doc.prefs?.meal && MEAL_TIMES[hhmm]) {
    const [title, body] = MEAL_TIMES[hhmm][lang];
    due.push({ tag: 'meal_reminder', title, body });
  }
  if (doc.prefs?.workout && hhmm === WORKOUT_TIME) {
    const [title, body] = WORKOUT_TEXT[lang];
    due.push({ tag: 'workout_reminder', title, body });
  }
  if (doc.prefs?.supplement && Array.isArray(doc.supplements)) {
    const names = doc.supplements
      .filter((s) => SUPPLEMENT_TIMES[s.timeOfDay] === hhmm)
      .map((s) => (s.dosage ? `${s.name} (${s.dosage})` : s.name));
    if (names.length > 0) {
      due.push({
        tag: 'supplement_reminder',
        title: lang === 'tr' ? '💊 Takviye Zamanı' : '💊 Supplement Time',
        body:
          lang === 'tr' ? `${names.join(', ')} alma zamanı` : `Time to take ${names.join(', ')}`,
      });
    }
  }
  return due;
}

export const sendReminders = onSchedule(
  { schedule: '*/30 * * * *', timeZone: 'UTC', region: 'europe-west1', memory: '256MiB', timeoutSeconds: 120 },
  async () => {
    const now = new Date();
    const snapshot = await db.collection('push_tokens').get();
    if (snapshot.empty) return;

    const messaging = admin.messaging();
    let sent = 0;
    const staleRefs: FirebaseFirestore.DocumentReference[] = [];

    await Promise.all(
      snapshot.docs.map(async (snap) => {
        const doc = snap.data() as TokenDoc;
        if (!doc?.fcmToken) return;
        const hhmm = localTime(now, doc.timezone || 'Europe/Istanbul');

        for (const msg of dueMessages(doc, hhmm)) {
          try {
            await messaging.send({
              token: doc.fcmToken,
              android: {
                priority: 'high',
                collapseKey: msg.tag,
                notification: {
                  title: msg.title,
                  body: msg.body,
                  channelId: 'reminders',
                  // Same tag per category → a late/queued delivery REPLACES
                  // the previous notification instead of stacking seven
                  // "Drink Water" cards in the shade.
                  tag: msg.tag,
                },
              },
              data: { type: msg.tag },
            });
            sent++;
          } catch (e: any) {
            const code: string = e?.errorInfo?.code || e?.code || '';
            if (
              code.includes('registration-token-not-registered') ||
              code.includes('invalid-argument')
            ) {
              staleRefs.push(snap.ref);
              return; // no point trying this device's other categories
            }
            console.warn(`sendReminders: send failed for ${snap.id}: ${code || e?.message}`);
          }
        }
      })
    );

    // Drop tokens FCM says are dead (uninstalls) so the collection stays lean.
    for (const ref of staleRefs) {
      try {
        await ref.delete();
      } catch {}
    }

    if (sent > 0) console.log(`sendReminders: delivered ${sent} messages to ${snapshot.size} devices`);
  }
);
