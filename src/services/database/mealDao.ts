import { getDatabase } from './database';

export interface MealLog {
  id: string;
  userId: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foodItemId: string;
  servingAmount: number;
  servingUnit: string;
  caloriesConsumed: number;
  proteinConsumed: number;
  carbsConsumed: number;
  fatConsumed: number;
  createdAt: number;
}

function rowToMeal(row: any): MealLog {
  return {
    id: row.id, userId: row.user_id, date: row.date, mealType: row.meal_type,
    foodItemId: row.food_item_id, servingAmount: row.serving_amount,
    servingUnit: row.serving_unit, caloriesConsumed: row.calories_consumed,
    proteinConsumed: row.protein_consumed, carbsConsumed: row.carbs_consumed,
    fatConsumed: row.fat_consumed, createdAt: row.created_at,
  };
}

export async function getMealLogsByDate(userId: string, date: string): Promise<MealLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM meal_logs WHERE user_id = ? AND date = ? ORDER BY meal_type, created_at',
    [userId, date]
  );
  return rows.map(rowToMeal);
}

export async function getMealLogsByDateRange(userId: string, startDate: string, endDate: string): Promise<MealLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM meal_logs WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date, meal_type',
    [userId, startDate, endDate]
  );
  return rows.map(rowToMeal);
}

export async function getTotalCaloriesByDate(userId: string, date: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync(
    'SELECT SUM(calories_consumed) as total FROM meal_logs WHERE user_id = ? AND date = ?',
    [userId, date]
  );
  return row?.total ?? 0;
}

export async function getRecentFoodIds(userId: string, limit = 20): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT DISTINCT food_item_id FROM meal_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit]
  );
  return rows.map((r: any) => r.food_item_id);
}

export async function insertMealLog(meal: MealLog): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO meal_logs (id, user_id, date, meal_type, food_item_id, serving_amount, serving_unit, calories_consumed, protein_consumed, carbs_consumed, fat_consumed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [meal.id, meal.userId, meal.date, meal.mealType, meal.foodItemId, meal.servingAmount, meal.servingUnit, meal.caloriesConsumed, meal.proteinConsumed, meal.carbsConsumed, meal.fatConsumed, meal.createdAt]
  );
}

export async function deleteMealLog(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM meal_logs WHERE id = ?', [id]);
}
