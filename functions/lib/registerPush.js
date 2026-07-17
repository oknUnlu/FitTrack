"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPush = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin_1 = require("./_lib/admin");
const auth_1 = require("./_lib/auth");
function isValidTimezone(tz) {
    try {
        new Intl.DateTimeFormat('en-GB', { timeZone: tz });
        return true;
    }
    catch (_a) {
        return false;
    }
}
const TIME_OF_DAY = new Set(['morning', 'afternoon', 'evening']);
exports.registerPush = (0, https_1.onRequest)({ cors: false, timeoutSeconds: 10, memory: '128MiB', region: 'europe-west1' }, async (req, res) => {
    var _a, _b, _c, _d, _e;
    if (req.method !== 'POST') {
        res.status(405).json({ success: false, message: 'Method not allowed' });
        return;
    }
    const deviceId = (0, auth_1.getDeviceToken)(req);
    if (!deviceId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    const body = ((_a = req.body) !== null && _a !== void 0 ? _a : {});
    const fcmToken = typeof body.fcmToken === 'string' ? body.fcmToken.trim() : '';
    if (!fcmToken || fcmToken.length < 32 || fcmToken.length > 512) {
        res.status(400).json({ success: false, message: 'Invalid fcmToken' });
        return;
    }
    const timezone = typeof body.timezone === 'string' && isValidTimezone(body.timezone)
        ? body.timezone
        : 'Europe/Istanbul';
    const language = typeof body.language === 'string' && body.language.toLowerCase().startsWith('tr') ? 'tr' : 'en';
    const prefs = {
        meal: ((_b = body.prefs) === null || _b === void 0 ? void 0 : _b.meal) === true,
        water: ((_c = body.prefs) === null || _c === void 0 ? void 0 : _c.water) === true,
        workout: ((_d = body.prefs) === null || _d === void 0 ? void 0 : _d.workout) === true,
        supplement: ((_e = body.prefs) === null || _e === void 0 ? void 0 : _e.supplement) === true,
    };
    // Only the fields the sender needs: name + a fixed time slot. Anything
    // malformed is dropped rather than rejected so a bad supplement row
    // can't break water/meal reminders.
    const supplements = (Array.isArray(body.supplements) ? body.supplements : [])
        .filter((s) => !!s &&
        typeof s.name === 'string' &&
        s.name.length > 0 &&
        s.name.length <= 100 &&
        typeof s.timeOfDay === 'string' &&
        TIME_OF_DAY.has(s.timeOfDay))
        .slice(0, 30)
        .map((s) => ({
        name: String(s.name).slice(0, 100),
        timeOfDay: s.timeOfDay,
        dosage: typeof s.dosage === 'string' ? s.dosage.slice(0, 50) : '',
    }));
    try {
        await admin_1.db.collection('push_tokens').doc(deviceId).set({
            fcmToken,
            timezone,
            language,
            prefs,
            supplements,
            updatedAt: Date.now(),
        });
        res.json({ success: true });
    }
    catch (e) {
        console.error('registerPush: write failed', e);
        res.status(500).json({ success: false, message: 'Internal error' });
    }
});
//# sourceMappingURL=registerPush.js.map