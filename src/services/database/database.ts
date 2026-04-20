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

  // Migration: add category column if it doesn't exist
  try {
    await database.runAsync(`ALTER TABLE workout_templates ADD COLUMN category TEXT NOT NULL DEFAULT 'equipment'`);
  } catch (_) {
    // Column already exists, ignore
  }

  // Migration: add device_id column to barcode_submissions for dedup logic.
  // Community barcode DB needs 5 *distinct* devices, not 5 submissions from
  // the same phone. device_id is the SecureStore device token.
  try {
    await database.runAsync(`ALTER TABLE barcode_submissions ADD COLUMN device_id TEXT NOT NULL DEFAULT ''`);
  } catch (_) {
    // Column already exists, ignore
  }
  // Unique index enforces "one submission per (barcode, device)"; safe to
  // run repeatedly.
  try {
    await database.runAsync(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_barcode_submissions_device ON barcode_submissions(barcode, device_id)`
    );
  } catch (_) {
    // ignore — can fail if duplicate rows exist from pre-migration state
  }
}

export async function seedDatabase(): Promise<void> {
  if (Platform.OS === 'web') return;
  const database = await getDatabase();

  const templatesData = require('../../assets/data/workout_templates.json');

  // Always sync built-in templates (INSERT OR REPLACE ensures new templates are added and existing ones updated)
  for (const t of templatesData) {
    await database.runAsync(
      `INSERT OR REPLACE INTO workout_templates (id, user_id, name, description, estimated_duration, difficulty, target_muscle_groups, days_json, is_built_in, category, created_at)
       VALUES (?, '', ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [t.id, t.name, t.description, t.estimatedDuration, t.difficulty, JSON.stringify(t.targetMuscleGroups), JSON.stringify(t.days), t.category ?? 'equipment', Date.now()]
    );
  }

  // Check if foods/exercises already seeded
  const result = await database.getFirstAsync(
    'SELECT COUNT(*) as count FROM food_items WHERE source = ?',
    ['local']
  );
  if (result && result.count > 0) return;

  const foodsData = require('../../assets/data/foods_tr.json');
  const exercisesData = require('../../assets/data/exercises_tr.json');

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

  // Seed default user if not exists
  const userResult = await database.getFirstAsync(
    'SELECT COUNT(*) as count FROM users WHERE id = ?',
    ['default_user']
  );
  if (!userResult || (userResult as any).count === 0) {
    const { calculateBMR, calculateTDEE, calculateMacroTargets, calculateWaterNeeds } = require('../../utils/calculations');
    const bmr = calculateBMR(70, 170, 30, 'male');
    const tdee = calculateTDEE(bmr, 'moderate');
    const macros = calculateMacroTargets(tdee, 'maintain');
    const water = calculateWaterNeeds(70, 'moderate');
    await database.runAsync(
      `INSERT OR IGNORE INTO users (id, name, email, height, weight, age, gender, activity_level, goal, tdee, protein_target_g, carbs_target_g, fat_target_g, water_target_ml, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['default_user', 'Kullanıcı', 'user@fittrack.app', 170, 70, 30, 'male', 'moderate', 'maintain', tdee, macros.protein, macros.carbs, macros.fat, water, Date.now()]
    );
  }
}
