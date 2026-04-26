import { getDatabase } from './database';

/**
 * A household-measure preset that the quantity dialog shows as a quick-pick
 * chip (e.g. "1 dilim", "1 kase", "1 büyük bardak"). Each preset translates
 * the user's intuitive label into a concrete gram/ml value, which is what
 * the meal log actually stores. The grams value is the SCALED amount —
 * macros are computed as `(grams / 100) * per100g`.
 */
export interface FoodPortion {
  label: string;
  grams: number;
}

export interface FoodItem {
  id: string;
  name: string;
  nameTr: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  barcode: string | null;
  servingSize: number;
  servingUnit: string;
  isCustom: boolean;
  isFavorite: boolean;
  source: string;
  /**
   * Free-form taxonomy used by the portion picker to pick sensible default
   * presets when no curated `commonPortions` exist. Examples: 'beverage',
   * 'soup', 'meal', 'snack', 'condiment'. Stored as TEXT in SQLite, may be
   * null for foods predating the migration.
   */
  category: string | null;
  /**
   * Up to ~5 hand-curated portion presets, sourced from the cloud food
   * library or the seed file. When absent, the quantity dialog falls back
   * to category-based defaults (see utils/portions.ts).
   */
  commonPortions: FoodPortion[] | null;
}

function parsePortions(raw: unknown): FoodPortion[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    // Already an array (e.g. the Firestore mapping path passed through).
    return raw.filter((p) => p && typeof p.label === 'string' && typeof p.grams === 'number');
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsePortions(parsed);
    } catch {
      return null;
    }
  }
  return null;
}

function rowToFood(row: any): FoodItem {
  return {
    id: row.id, name: row.name, nameTr: row.name_tr,
    calories: row.calories, protein: row.protein, carbs: row.carbs, fat: row.fat,
    fiber: row.fiber, sugar: row.sugar, barcode: row.barcode,
    servingSize: row.serving_size, servingUnit: row.serving_unit,
    isCustom: !!row.is_custom, isFavorite: !!row.is_favorite, source: row.source,
    category: row.category ?? null,
    commonPortions: parsePortions(row.common_portions),
  };
}

export async function searchFoodItems(query: string, limit = 20): Promise<FoodItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    `SELECT * FROM food_items WHERE name LIKE ? OR name_tr LIKE ? ORDER BY is_favorite DESC, name ASC LIMIT ?`,
    [`%${query}%`, `%${query}%`, limit]
  );
  return rows.map(rowToFood);
}

export async function getFoodByBarcode(barcode: string): Promise<FoodItem | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync('SELECT * FROM food_items WHERE barcode = ? LIMIT 1', [barcode]);
  return row ? rowToFood(row) : null;
}

export async function getFavoriteFoods(): Promise<FoodItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync('SELECT * FROM food_items WHERE is_favorite = 1 ORDER BY name ASC');
  return rows.map(rowToFood);
}

export async function getCustomFoods(): Promise<FoodItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync('SELECT * FROM food_items WHERE is_custom = 1 ORDER BY name ASC');
  return rows.map(rowToFood);
}

export async function insertFoodItem(food: FoodItem): Promise<void> {
  const db = await getDatabase();
  // common_portions is stored as a JSON string so SQLite stays schema-light;
  // the array round-trips through `parsePortions` on read.
  const portionsJson = food.commonPortions && food.commonPortions.length > 0
    ? JSON.stringify(food.commonPortions)
    : null;
  await db.runAsync(
    `INSERT OR REPLACE INTO food_items (id, name, name_tr, calories, protein, carbs, fat, fiber, sugar, barcode, serving_size, serving_unit, is_custom, is_favorite, source, category, common_portions)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [food.id, food.name, food.nameTr, food.calories, food.protein, food.carbs, food.fat, food.fiber, food.sugar, food.barcode, food.servingSize, food.servingUnit, food.isCustom ? 1 : 0, food.isFavorite ? 1 : 0, food.source, food.category ?? null, portionsJson]
  );
}

export async function toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE food_items SET is_favorite = ? WHERE id = ?', [isFavorite ? 1 : 0, id]);
}
