import {
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { getDeviceToken } from '../api/apiClient';

const SUBMISSIONS_COL = 'barcode_submissions';
const VERIFIED_COL = 'verified_products';
const MIN_SUBMISSIONS = 5;
const MAX_DEVIATION_RATIO = 0.25;

// Local negative cache: track barcodes we already checked and weren't verified.
// Prevents repeated Firestore reads for non-existent products.
const NEGATIVE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const negativeCache = new Map<string, number>();

export interface CloudBarcodeSubmission {
  barcode: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  deviceId: string;
  submittedAt: any;
}

export interface VerifiedProduct {
  barcode: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  submissionCount: number;
  verifiedAt: any;
}

/**
 * Submit a barcode entry to Firestore cloud.
 * Silently fails if Firebase is not configured or network is unavailable.
 */
export async function submitBarcodeToCloud(
  barcode: string,
  name: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
): Promise<void> {
  if (!isFirebaseConfigured()) return;

  try {
    const deviceId = await getDeviceToken();
    // Composite ID (deviceId_barcode) makes each (device, barcode) pair
    // a single document. Re-submitting the same product from the same
    // phone overwrites, ensuring the 5-submission verification threshold
    // counts 5 DISTINCT users, not 5 submissions from one user.
    const docId = `${deviceId}_${barcode}`;
    await setDoc(doc(db, SUBMISSIONS_COL, docId), {
      barcode,
      name,
      calories,
      protein,
      carbs,
      fat,
      deviceId,
      submittedAt: serverTimestamp(),
    });
    // New verified submission may promote the product to verified_products.
    // Non-blocking — any failure here just defers verification.
    checkAndVerifyInCloud(barcode).catch(() => {});
  } catch (e) {
    if (__DEV__) console.warn('submitBarcodeToCloud failed:', e);
  }
}

/**
 * Get a verified product from Firestore by barcode.
 * Returns null if not found or Firebase is not configured.
 */
export async function getVerifiedProduct(barcode: string): Promise<VerifiedProduct | null> {
  if (!isFirebaseConfigured()) return null;

  // Check negative cache to avoid redundant Firestore reads
  const cachedAt = negativeCache.get(barcode);
  if (cachedAt && Date.now() - cachedAt < NEGATIVE_CACHE_TTL_MS) {
    return null;
  }

  try {
    const docRef = doc(db, VERIFIED_COL, barcode);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      // Cache the miss to avoid re-checking Firestore
      negativeCache.set(barcode, Date.now());
      return null;
    }
    // Clear negative cache on successful find
    negativeCache.delete(barcode);
    return snap.data() as VerifiedProduct;
  } catch (e) {
    if (__DEV__) console.warn('getVerifiedProduct failed:', e);
    return null;
  }
}

/**
 * Check if a barcode has enough consistent submissions in Firestore.
 * If verified, write to verified_products collection.
 */
export async function checkAndVerifyInCloud(barcode: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;

  try {
    const q = query(collection(db, SUBMISSIONS_COL), where('barcode', '==', barcode));
    const snapshot = await getDocs(q);

    // Dedup by deviceId — legacy addDoc rows (pre-migration) could create
    // multiple docs per device. New code uses setDoc with a composite
    // `${deviceId}_${barcode}` id so this is mostly a safety net.
    const byDevice = new Map<string, CloudBarcodeSubmission>();
    snapshot.forEach((d) => {
      const data = d.data() as CloudBarcodeSubmission;
      const key = data.deviceId || d.id;
      // Keep only the latest per device
      const existing = byDevice.get(key);
      if (!existing) {
        byDevice.set(key, data);
      }
    });
    const submissions: CloudBarcodeSubmission[] = Array.from(byDevice.values());

    if (submissions.length < MIN_SUBMISSIONS) return false;

    const calories = submissions.map((s) => s.calories);
    const protein = submissions.map((s) => s.protein);
    const carbs = submissions.map((s) => s.carbs);
    const fat = submissions.map((s) => s.fat);

    if (!isConsistent(calories) || !isConsistent(protein) || !isConsistent(carbs) || !isConsistent(fat)) {
      return false;
    }

    const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10;
    const mostCommonName = getMostCommonName(submissions);

    const verified: VerifiedProduct = {
      barcode,
      name: mostCommonName,
      calories: avg(calories),
      protein: avg(protein),
      carbs: avg(carbs),
      fat: avg(fat),
      submissionCount: submissions.length,
      verifiedAt: serverTimestamp(),
    };

    await setDoc(doc(db, VERIFIED_COL, barcode), verified);
    return true;
  } catch (e) {
    if (__DEV__) console.warn('checkAndVerifyInCloud failed:', e);
    return false;
  }
}

function stdDev(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}

function isConsistent(values: number[]): boolean {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return true;
  return stdDev(values) / mean < MAX_DEVIATION_RATIO;
}

function getMostCommonName(submissions: CloudBarcodeSubmission[]): string {
  const counts: Record<string, number> = {};
  for (const s of submissions) {
    const key = s.name.trim().toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
  }
  let best = submissions[0].name;
  let bestCount = 0;
  for (const [key, count] of Object.entries(counts)) {
    if (count > bestCount) {
      bestCount = count;
      best = submissions.find((s) => s.name.trim().toLowerCase() === key)?.name || best;
    }
  }
  return best;
}
