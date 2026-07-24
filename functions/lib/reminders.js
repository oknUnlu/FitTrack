"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendReminders = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const admin_1 = require("./_lib/admin");
// Mirrors the client tables in src/services/notifications/notificationService.ts.
const WATER_TIMES = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'];
const MEAL_TIMES = {
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
const SUPPLEMENT_TIMES = {
    morning: '08:00',
    afternoon: '14:00',
    evening: '20:00',
};
const WATER_TEXT = {
    tr: ['💧 Su İç!', 'Bir bardak su içmeyi unutma. Vücudunun suya ihtiyacı var!'],
    en: ['💧 Drink Water!', "Don't forget to drink a glass of water. Your body needs hydration!"],
};
const WORKOUT_TEXT = {
    tr: ['💪 Antrenman Zamanı!', 'Bugün için antrenman planlamıştın. Hadi başlayalım!'],
    en: ['💪 Workout Time!', "You planned a workout today. Let's get moving!"],
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
function localTime(now, timezone) {
    let formatted;
    try {
        formatted = new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(now);
    }
    catch (_a) {
        formatted = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    }
    const [hour, minute] = formatted.split(':').map(Number);
    const snappedTotal = (Math.round((hour * 60 + minute) / 30) * 30) % 1440;
    const snappedHour = Math.floor(snappedTotal / 60);
    const snappedMinute = snappedTotal % 60;
    return `${String(snappedHour).padStart(2, '0')}:${String(snappedMinute).padStart(2, '0')}`;
}
function dueMessages(doc, hhmm) {
    var _a, _b, _c, _d;
    const lang = doc.language === 'tr' ? 'tr' : 'en';
    const due = [];
    if (((_a = doc.prefs) === null || _a === void 0 ? void 0 : _a.water) && WATER_TIMES.includes(hhmm)) {
        const [title, body] = WATER_TEXT[lang];
        due.push({ tag: 'water_reminder', title, body });
    }
    if (((_b = doc.prefs) === null || _b === void 0 ? void 0 : _b.meal) && MEAL_TIMES[hhmm]) {
        const [title, body] = MEAL_TIMES[hhmm][lang];
        due.push({ tag: 'meal_reminder', title, body });
    }
    if (((_c = doc.prefs) === null || _c === void 0 ? void 0 : _c.workout) && hhmm === WORKOUT_TIME) {
        const [title, body] = WORKOUT_TEXT[lang];
        due.push({ tag: 'workout_reminder', title, body });
    }
    if (((_d = doc.prefs) === null || _d === void 0 ? void 0 : _d.supplement) && Array.isArray(doc.supplements)) {
        const names = doc.supplements
            .filter((s) => SUPPLEMENT_TIMES[s.timeOfDay] === hhmm)
            .map((s) => (s.dosage ? `${s.name} (${s.dosage})` : s.name));
        if (names.length > 0) {
            due.push({
                tag: 'supplement_reminder',
                title: lang === 'tr' ? '💊 Takviye Zamanı' : '💊 Supplement Time',
                body: lang === 'tr' ? `${names.join(', ')} alma zamanı` : `Time to take ${names.join(', ')}`,
            });
        }
    }
    return due;
}
exports.sendReminders = (0, scheduler_1.onSchedule)({ schedule: '*/30 * * * *', timeZone: 'UTC', region: 'europe-west1', memory: '256MiB', timeoutSeconds: 120 }, async () => {
    const now = new Date();
    const snapshot = await admin_1.db.collection('push_tokens').get();
    if (snapshot.empty)
        return;
    const messaging = admin.messaging();
    let sent = 0;
    const staleRefs = [];
    await Promise.all(snapshot.docs.map(async (snap) => {
        var _a;
        const doc = snap.data();
        if (!(doc === null || doc === void 0 ? void 0 : doc.fcmToken))
            return;
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
            }
            catch (e) {
                const code = ((_a = e === null || e === void 0 ? void 0 : e.errorInfo) === null || _a === void 0 ? void 0 : _a.code) || (e === null || e === void 0 ? void 0 : e.code) || '';
                if (code.includes('registration-token-not-registered') ||
                    code.includes('invalid-argument')) {
                    staleRefs.push(snap.ref);
                    return; // no point trying this device's other categories
                }
                console.warn(`sendReminders: send failed for ${snap.id}: ${code || (e === null || e === void 0 ? void 0 : e.message)}`);
            }
        }
    }));
    // Drop tokens FCM says are dead (uninstalls) so the collection stays lean.
    for (const ref of staleRefs) {
        try {
            await ref.delete();
        }
        catch (_a) { }
    }
    if (sent > 0)
        console.log(`sendReminders: delivered ${sent} messages to ${snapshot.size} devices`);
});
//# sourceMappingURL=reminders.js.map