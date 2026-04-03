import { getDatabase } from './database';
import { insertFoodItem, FoodItem } from './foodDao';
import { submitBarcodeToCloud, checkAndVerifyInCloud, getVerifiedProduct } from '../firebase/barcodeFirestore';

export interface BarcodeSubmission {
  id: string;
  barcode: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  submittedAt: number;
}

const MIN_SUBMISSIONS = 5;
const MAX_DEVIATION_RATIO = 0.25;

export async function insertBarcodeSubmission(
  barcode: string,
  name: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
): Promise<void> {
  // Save locally
  const db = await getDatabase();
  const id = `bs_${barcode}_${Date.now()}`;
  await db.runAsync(
    `INSERT INTO barcode_submissions (id, barcode, name, calories, protein, carbs, fat, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, barcode, name, calories, protein, carbs, fat, Date.now()],
  );

  // Sync to Firestore (fire-and-forget, no await to avoid blocking)
  submitBarcodeToCloud(barcode, name, calories, protein, carbs, fat).catch(() => {});
}

export async function getSubmissionsByBarcode(barcode: string): Promise<BarcodeSubmission[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM barcode_submissions WHERE barcode = ? ORDER BY submitted_at DESC',
    [barcode],
  );
  return (rows as any[]).map((r) => ({
    id: r.id,
    barcode: r.barcode,
    name: r.name,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    submittedAt: r.submitted_at,
  }));
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

/**
 * Get verified product from Firestore cloud and cache locally.
 * Returns FoodItem if found, null otherwise.
 */
export async function getVerifiedProductFromCloud(barcode: string): Promise<FoodItem | null> {
  try {
    const verified = await getVerifiedProduct(barcode);
    if (!verified) return null;

    const food: FoodItem = {
      id: `community_${barcode}`,
      name: verified.name,
      nameTr: verified.name,
      calories: verified.calories,
      protein: verified.protein,
      carbs: verified.carbs,
      fat: verified.fat,
      fiber: null,
      sugar: null,
      barcode,
      servingSize: 100,
      servingUnit: 'g',
      isCustom: false,
      isFavorite: false,
      source: 'community',
    };

    // Cache locally for offline access
    await insertFoodItem(food);
    return food;
  } catch {
    return null;
  }
}

/**
 * Check if a barcode has enough consistent submissions to be verified.
 * Checks both local and cloud submissions. If verified, promotes to food_items.
 */
export async function checkAndPromoteBarcode(barcode: string): Promise<boolean> {
  // Try cloud verification first (has data from all users)
  checkAndVerifyInCloud(barcode).catch(() => {});

  const submissions = await getSubmissionsByBarcode(barcode);
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

  const food: FoodItem = {
    id: `community_${barcode}`,
    name: mostCommonName,
    nameTr: mostCommonName,
    calories: avg(calories),
    protein: avg(protein),
    carbs: avg(carbs),
    fat: avg(fat),
    fiber: null,
    sugar: null,
    barcode,
    servingSize: 100,
    servingUnit: 'g',
    isCustom: false,
    isFavorite: false,
    source: 'community',
  };

  await insertFoodItem(food);
  return true;
}

function getMostCommonName(submissions: BarcodeSubmission[]): string {
  const counts: Record<string, number> = {};
  for (const s of submissions) {
    const key = s.name.trim().toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
  }
  let best = submissions[0].name;
  let bestCount = 0;
  for (const [, count] of Object.entries(counts)) {
    if (count > bestCount) {
      bestCount = count;
      best = submissions.find((s) => s.name.trim().toLowerCase() === Object.keys(counts).find((k) => counts[k] === count))?.name || best;
    }
  }
  return best;
}
