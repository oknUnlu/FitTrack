import { Platform } from 'react-native';
import { CREATE_TABLES_SQL } from './schema';

let db: any = null;

export async function getDatabase(): Promise<any> {
  if (Platform.OS === 'web') {
    throw new Error('SQLite is not available on web');
  }
  if (!db) {
    const SQLite = require('expo-sqlite');
    db = await SQLite.openDatabaseAsync('fittrack.db');
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  if (Platform.OS === 'web') return;
  const database = await getDatabase();
  await database.execAsync(CREATE_TABLES_SQL);
}

export async function seedDatabase(): Promise<void> {
  if (Platform.OS === 'web') return;
  const database = await getDatabase();

  // Check if already seeded
  const result = await database.getFirstAsync(
    'SELECT COUNT(*) as count FROM food_items WHERE source = ?',
    ['local']
  );
  if (result && result.count > 0) return;

  const foodsData = require('../../assets/data/foods_tr.json');
  const exercisesData = require('../../assets/data/exercises_tr.json');
  const templatesData = require('../../assets/data/workout_templates.json');

  // Seed foods
  for (const food of foodsData) {
    await database.runAsync(
      `INSERT OR IGNORE INTO food_items (id, name, name_tr, calories, protein, carbs, fat, fiber, sugar, serving_size, serving_unit, is_custom, is_favorite, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'local')`,
      [food.id, food.name, food.nameTr, food.calories, food.protein, food.carbs, food.fat, food.fiber ?? null, food.sugar ?? null, food.servingSize, food.servingUnit]
    );
  }

  // Seed exercises
  for (const ex of exercisesData) {
    await database.runAsync(
      `INSERT OR IGNORE INTO exercises (id, name, name_tr, muscle_groups, equipment_type, instructions, met_value, is_custom)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [ex.id, ex.name, ex.nameTr, JSON.stringify(ex.muscleGroups), ex.equipmentType, ex.instructions, ex.metValue]
    );
  }

  // Seed templates
  for (const t of templatesData) {
    await database.runAsync(
      `INSERT OR IGNORE INTO workout_templates (id, user_id, name, description, estimated_duration, difficulty, target_muscle_groups, days_json, is_built_in, created_at)
       VALUES (?, '', ?, ?, ?, ?, ?, ?, 1, ?)`,
      [t.id, t.name, t.description, t.estimatedDuration, t.difficulty, JSON.stringify(t.targetMuscleGroups), JSON.stringify(t.days), Date.now()]
    );
  }
}
