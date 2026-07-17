"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccount = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin_1 = require("./_lib/admin");
const auth_1 = require("./_lib/auth");
/**
 * KVKK (Kanun No. 6698) madde 11 "silme hakkı" ve GDPR Art. 17 "right to
 * erasure" kapsamında, kullanıcının sunucu tarafında tutulan tüm kayıtlarını
 * geri alınamaz şekilde siler.
 *
 * Silinenler:
 *   - rate_limits/{deviceId}:*:YYYY-MM-DD  (günlük rate-limit kayıtları)
 *   - premium_status/{deviceId}            (satın alma tabanlı premium)
 *   - promo_premium/{deviceId}             (promo kod tabanlı premium)
 *   - promo_usage/{code}.usedBy[]          (kullanıcının izlediği promo kodlar)
 *
 * Local SQLite / SecureStore verileri client-side silinir; bu endpoint
 * sunucu-taraflı kayıtları temizler. 200 dönmek, her iki tarafın da
 * silindiği anlamına gelmez — client kendi yerel silme adımını ayrıca
 * çalıştırır.
 */
exports.deleteAccount = (0, https_1.onRequest)({ cors: true, timeoutSeconds: 60, memory: '256MiB', region: 'europe-west1' }, async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    if (req.method !== 'POST' && req.method !== 'DELETE') {
        res.status(405).json({ success: false, message: 'Method not allowed' });
        return;
    }
    const deviceId = (0, auth_1.getDeviceToken)(req);
    if (!deviceId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    try {
        // 1) premium_status/{deviceId}
        await admin_1.db.collection('premium_status').doc(deviceId).delete().catch(() => { });
        // 2) promo_premium/{deviceId}
        await admin_1.db.collection('promo_premium').doc(deviceId).delete().catch(() => { });
        // 2b) push_tokens/{deviceId} — stop server-side reminder pushes.
        await admin_1.db.collection('push_tokens').doc(deviceId).delete().catch(() => { });
        // 3) rate_limits/{deviceId}:* — doc ID'ler `${deviceId}:${feature}:${date}`
        //    formatında olduğu için range query ile toplu silme yapıyoruz.
        //    Firestore doc-id sıralaması leksikografik: `x:` prefixli ID'leri
        //    bulmak için >= deviceId+':' ve < deviceId+';' aralığını tarıyoruz.
        const rlStart = `${deviceId}:`;
        const rlEnd = `${deviceId};`; // ':' = 0x3a, ';' = 0x3b — sıradaki karakter
        const rlSnap = await admin_1.db
            .collection('rate_limits')
            .where('__name__', '>=', rlStart)
            .where('__name__', '<', rlEnd)
            .limit(500)
            .get();
        if (!rlSnap.empty) {
            const batch = admin_1.db.batch();
            rlSnap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
        }
        // 4) promo_usage: usedBy dizisinden deviceId'yi çıkar. Tüm promo kodlarını
        //    tarayıp sadece bu kullanıcıyı içerenleri güncelliyoruz; promo
        //    kod listesi küçük (config-driven) olduğu için tüm koleksiyonu
        //    gezmek pratik.
        const promoSnap = await admin_1.db.collection('promo_usage').get();
        if (!promoSnap.empty) {
            const batch = admin_1.db.batch();
            let dirty = false;
            promoSnap.docs.forEach((d) => {
                var _a, _b;
                const usedBy = (_b = (_a = d.data()) === null || _a === void 0 ? void 0 : _a.usedBy) !== null && _b !== void 0 ? _b : [];
                if (usedBy.includes(deviceId)) {
                    const filtered = usedBy.filter((u) => u !== deviceId);
                    batch.update(d.ref, { usedBy: filtered });
                    dirty = true;
                }
            });
            if (dirty)
                await batch.commit();
        }
        res.status(200).json({
            success: true,
            message: 'Account data deleted',
            deletedAt: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('deleteAccount error:', error === null || error === void 0 ? void 0 : error.message);
        res.status(500).json({ success: false, message: 'Account deletion failed' });
    }
});
//# sourceMappingURL=deleteAccount.js.map