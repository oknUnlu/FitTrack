import { db } from './admin';
import { FieldValue } from 'firebase-admin/firestore';

type Feature = 'chat' | 'food_recognition' | 'plan';

export async function logUsage(feature: Feature, durationMs: number): Promise<void> {
  try {
    const now = new Date();
    const dailyId = `daily:${now.toISOString().split('T')[0]}`;
    const monthlyId = `monthly:${now.toISOString().slice(0, 7)}`;

    const batch = db.batch();
    const increment = FieldValue.increment(1);
    const durationIncrement = FieldValue.increment(Math.round(durationMs));

    const dailyRef = db.collection('usage_stats').doc(dailyId);
    const monthlyRef = db.collection('usage_stats').doc(monthlyId);

    batch.set(dailyRef, {
      [`${feature}_count`]: increment,
      total_count: increment,
      total_duration_ms: durationIncrement,
    }, { merge: true });

    batch.set(monthlyRef, {
      [`${feature}_count`]: increment,
      total_count: increment,
      total_duration_ms: durationIncrement,
    }, { merge: true });

    await batch.commit();
  } catch (error) {
    console.error('Usage logging failed:', error);
  }
}

export async function getMonthlyUsage(): Promise<number> {
  try {
    const monthlyId = `monthly:${new Date().toISOString().slice(0, 7)}`;
    const doc = await db.collection('usage_stats').doc(monthlyId).get();
    return doc.data()?.total_count ?? 0;
  } catch {
    return 0;
  }
}
