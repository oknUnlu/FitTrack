import { onRequest } from 'firebase-functions/v2/https';
import { db } from './_lib/admin';
import { getDeviceToken } from './_lib/auth';

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
export const deleteAccount = onRequest(
  { cors: true, timeoutSeconds: 60, memory: '256MiB', region: 'europe-west1' },
  async (req, res) => {
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      res.status(405).json({ success: false, message: 'Method not allowed' });
      return;
    }

    const deviceId = getDeviceToken(req);
    if (!deviceId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    try {
      // 1) premium_status/{deviceId}
      await db.collection('premium_status').doc(deviceId).delete().catch(() => {});

      // 2) promo_premium/{deviceId}
      await db.collection('promo_premium').doc(deviceId).delete().catch(() => {});

      // 3) rate_limits/{deviceId}:* — doc ID'ler `${deviceId}:${feature}:${date}`
      //    formatında olduğu için range query ile toplu silme yapıyoruz.
      //    Firestore doc-id sıralaması leksikografik: `x:` prefixli ID'leri
      //    bulmak için >= deviceId+':' ve < deviceId+';' aralığını tarıyoruz.
      const rlStart = `${deviceId}:`;
      const rlEnd = `${deviceId};`; // ':' = 0x3a, ';' = 0x3b — sıradaki karakter
      const rlSnap = await db
        .collection('rate_limits')
        .where('__name__', '>=', rlStart)
        .where('__name__', '<', rlEnd)
        .limit(500)
        .get();

      if (!rlSnap.empty) {
        const batch = db.batch();
        rlSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      // 4) promo_usage: usedBy dizisinden deviceId'yi çıkar. Tüm promo kodlarını
      //    tarayıp sadece bu kullanıcıyı içerenleri güncelliyoruz; promo
      //    kod listesi küçük (config-driven) olduğu için tüm koleksiyonu
      //    gezmek pratik.
      const promoSnap = await db.collection('promo_usage').get();
      if (!promoSnap.empty) {
        const batch = db.batch();
        let dirty = false;
        promoSnap.docs.forEach((d) => {
          const usedBy: string[] = d.data()?.usedBy ?? [];
          if (usedBy.includes(deviceId)) {
            const filtered = usedBy.filter((u) => u !== deviceId);
            batch.update(d.ref, { usedBy: filtered });
            dirty = true;
          }
        });
        if (dirty) await batch.commit();
      }

      res.status(200).json({
        success: true,
        message: 'Account data deleted',
        deletedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('deleteAccount error:', error?.message);
      res.status(500).json({ success: false, message: 'Account deletion failed' });
    }
  }
);
