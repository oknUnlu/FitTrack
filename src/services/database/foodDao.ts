import { getDatabase } from './database';

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
}

function rowToFood(row: any): FoodItem {
  return {
    id: row.id, name: row.name, nameTr: row.name_tr,
    calories: row.calories, protein: row.protein, carbs: row.carbs, fat: row.fat,
    fiber: row.fiber, sugar: row.sugar, barcode: row.barcode,
    servingSize: row.serving_size, servingUnit: row.serving_unit,
    isCustom: !!row.is_custom, isFavorite: !!row.is_favorite, source: row.source,
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
  await db.runAsync(
    `INSERT OR REPLACE INTO food_items (id, name, name_tr, calories, protein, carbs, fat, fiber, sugar, barcode, serving_size, serving_unit, is_custom, is_favorite, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [food.id, food.name, food.nameTr, food.calories, food.protein, food.carbs, food.fat, food.fiber, food.sugar, food.barcode, food.servingSize, food.servingUnit, food.isCustom ? 1 : 0, food.isFavorite ? 1 : 0, food.source]
  );
}

export async function toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE food_items SET is_favorite = ? WHERE id = ?', [isFavorite ? 1 : 0, id]);
}
