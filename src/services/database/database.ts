import { Platform } from 'react-native';
import { CREATE_TABLES_SQL } from './schema';

let db: any = null;
let initPromise: Promise<void> | null = null;
let initFailed = false;

/**
 * Internal: just open the SQLite handle. Used by both initDatabase (which
 * needs the raw handle to run DDL on) and the public getDatabase wrapper.
 * Does NOT run migrations — callers that need a *ready* DB go through
 * getDatabase() instead.
 */
async function openDb(): Promise<any> {
  if (Platform.OS === 'web') {
    throw new Error('SQLite is not available on web');
  }
  if (!db) {
    const SQLite = require('expo-sqlite');
    db = await SQLite.openDatabaseAsync('fittrack.db');
  }
  return db;
}

/**
 * Public DB accessor used by every DAO. CRITICAL: this awaits the
 * initDatabase() promise before returning the handle, so DAOs can never
 * see a half-initialised database.
 *
 * Why this matters: App.tsx flips `isLoading` to false as soon as the
 * onboarding state finishes loading from AsyncStorage, which happens
 * BEFORE initDatabase() resolves. The navigator then mounts and the
 * Dashboard / Progress screens fire their useEffect data loaders
 * immediately. Without this gate, those DAO calls hit a SQLite handle
 * whose tables haven't been CREATEd yet, and the Android native module
 * surfaces the failure as `NullPointerException` on prepareAsync — the
 * exact crash users were seeing on cold-start.
 *
 * initDatabase() is idempotent (de-duped via initPromise), so calling it
 * from every DAO is essentially free after the first call.
 */
export async function getDatabase(): Promise<any> {
  if (Platform.OS === 'web') {
    throw new Error('SQLite is not available on web');
  }
  // Make sure migrations have run. After the first call this resolves
  // synchronously off the cached initPromise.
  await initDatabase();
  return openDb();
}

export function isDatabaseReady(): boolean {
  return !!db && !initFailed;
}

/**
 * Run every DDL statement in isolation so a single failure can't poison
 * the native handle (which manifests later as NullPointerException on
 * prepareAsync). Each CREATE TABLE / INDEX is independently idempotent,
 * so splitting them costs nothing but buys us resilience.
 */
async function execStatements(database: any, sql: string): Promise<void> {
  // Split on semicolons that end a statement; ignores empty fragments.
  const statements = sql
    .split(/;\s*(?=\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('--'));
  for (const stmt of statements) {
    try {
      await database.execAsync(stmt);
    } catch (e) {
      if (__DEV__) console.warn('DB DDL skipped:', stmt.slice(0, 80), e);
      // keep going — individual DDL failures must not halt init
    }
  }
}

export async function initDatabase(): Promise<void> {
  if (Platform.OS === 'web') return;
  // De-dupe concurrent calls (App.tsx + any eager DAO) so we only run
  // migrations once.
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      // Use openDb() here, NOT getDatabase() — getDatabase() awaits
      // initDatabase() and would deadlock the init promise on itself.
      const database = await openDb();
      await execStatements(database, CREATE_TABLES_SQL);

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

      // Migration: add category + common_portions columns to food_items so the
      // portion picker can show household-measure chips ("1 dilim", "1 kase")
      // instead of asking for raw grams. Both columns are nullable — existing
      // local-seed foods stay valid while cloud-fetched foods bring richer data.
      try {
        await database.runAsync(`ALTER TABLE food_items ADD COLUMN category TEXT`);
      } catch (_) {
        // Column already exists, ignore
      }
      try {
        await database.runAsync(`ALTER TABLE food_items ADD COLUMN common_portions TEXT`);
      } catch (_) {
        // Column already exists, ignore
      }

      // Migration: back-fill category for existing local food items that were
      // seeded before the category column existed. Reads from the bundled JSON
      // and UPDATEs only rows where category IS NULL, so it is safe to run on
      // every app start (no-op after the first successful run).
      try {
        const needsBackfill = await database.getFirstAsync(
          `SELECT COUNT(*) as count FROM food_items WHERE source = 'local' AND category IS NULL`
        ) as any;
        if (needsBackfill?.count > 0) {
          const seedFoods = require('../../assets/data/foods_tr.json');
          for (const food of seedFoods) {
            if (food.category) {
              await database.runAsync(
                `UPDATE food_items SET category = ? WHERE id = ? AND source = 'local' AND category IS NULL`,
                [food.category, food.id]
              );
            }
          }
        }
        // Point recategorisations — fix foods that were seeded with the wrong
        // category before the keyword-matcher was corrected. These UPDATE
        // unconditionally on the specific old value so they are idempotent.
        // zeytin
        await database.runAsync(
          `UPDATE food_items SET category = 'vegetable' WHERE id = 'zeytin' AND source = 'local' AND category = 'condiment'`
        );
        // beverage → dessert
        for (const id of ['cikolatali_pasta', 'krep_cikolatali']) {
          await database.runAsync(
            `UPDATE food_items SET category = 'dessert' WHERE id = ? AND source = 'local' AND category = 'beverage'`, [id]
          );
        }
        // beverage → snack
        for (const id of ['cookie', 'cikolata_bitter', 'cikolata_sutlu', 'cikolata_beyaz']) {
          await database.runAsync(
            `UPDATE food_items SET category = 'snack' WHERE id = ? AND source = 'local' AND category = 'beverage'`, [id]
          );
        }
        // beverage → bread
        await database.runAsync(
          `UPDATE food_items SET category = 'bread' WHERE id = 'croissant_cikolatali' AND source = 'local' AND category = 'beverage'`
        );
        // bread → snack
        for (const id of ['cheeseburger', 'double_burger', 'hot_dog', 'islak_hamburger', 'club_sandwich']) {
          await database.runAsync(
            `UPDATE food_items SET category = 'snack' WHERE id = ? AND source = 'local' AND category = 'bread'`, [id]
          );
        }
        // egg → vegetable
        await database.runAsync(
          `UPDATE food_items SET category = 'vegetable' WHERE id = 'patlican' AND source = 'local' AND category = 'egg'`
        );
        // egg → snack
        await database.runAsync(
          `UPDATE food_items SET category = 'snack' WHERE id = 'veggie_burger' AND source = 'local' AND category = 'egg'`
        );
        // fruit → condiment
        for (const id of ['pekmez', 'nar_eksisi']) {
          await database.runAsync(
            `UPDATE food_items SET category = 'condiment' WHERE id = ? AND source = 'local' AND category = 'fruit'`, [id]
          );
        }
        // vegetable → condiment
        for (const id of ['pul_biber', 'acili_ezme', 'atom']) {
          await database.runAsync(
            `UPDATE food_items SET category = 'condiment' WHERE id = ? AND source = 'local' AND category = 'vegetable'`, [id]
          );
        }
        // vegetable → nut
        await database.runAsync(
          `UPDATE food_items SET category = 'nut' WHERE id = 'kabak_cekirdegi' AND source = 'local' AND category = 'vegetable'`
        );
        // vegetable → snack
        for (const id of ['pizza_pepperoni', 'quesadilla', 'onion_rings']) {
          await database.runAsync(
            `UPDATE food_items SET category = 'snack' WHERE id = ? AND source = 'local' AND category = 'vegetable'`, [id]
          );
        }
        // vegetable → bread
        await database.runAsync(
          `UPDATE food_items SET category = 'bread' WHERE id = 'dilli_kasarli' AND source = 'local' AND category = 'vegetable'`
        );
        // meat → dessert
        await database.runAsync(
          `UPDATE food_items SET category = 'dessert' WHERE id = 'tavuk_gogsu_tatlisi' AND source = 'local' AND category = 'meat'`
        );
        // dairy → nut
        await database.runAsync(
          `UPDATE food_items SET category = 'nut' WHERE id = 'fistik_ezmesi' AND source = 'local' AND category = 'dairy'`
        );
        // dairy → snack
        await database.runAsync(
          `UPDATE food_items SET category = 'snack' WHERE id = 'mozzarella_sticks' AND source = 'local' AND category = 'dairy'`
        );
        // snack → condiment
        await database.runAsync(
          `UPDATE food_items SET category = 'condiment' WHERE id = 'guacamole' AND source = 'local' AND category = 'snack'`
        );
        // legume → meat
        for (const id of ['falafel', 'tofu']) {
          await database.runAsync(
            `UPDATE food_items SET category = 'meat' WHERE id = ? AND source = 'local' AND category = 'legume'`, [id]
          );
        }
        // bread → condiment (breadcrumbs)
        await database.runAsync(
          `UPDATE food_items SET category = 'condiment' WHERE id = 'galeta_unu' AND source = 'local' AND category = 'bread'`
        );
        // nut → condiment (tahini)
        await database.runAsync(
          `UPDATE food_items SET category = 'condiment' WHERE id = 'tahin' AND source = 'local' AND category = 'nut'`
        );
        // egg → bread (egg pide)
        await database.runAsync(
          `UPDATE food_items SET category = 'bread' WHERE id = 'yumurtali_pide' AND source = 'local' AND category = 'egg'`
        );
        // grain → snack (rice cake)
        await database.runAsync(
          `UPDATE food_items SET category = 'snack' WHERE id = 'pirinc_patlagi' AND source = 'local' AND category = 'grain'`
        );
        // bread → snack (large sandwiches/wraps)
        for (const id of ['wrap_falafel', 'panini', 'etli_ekmek', 'kumru']) {
          await database.runAsync(
            `UPDATE food_items SET category = 'snack' WHERE id = ? AND source = 'local' AND category = 'bread'`, [id]
          );
        }
        // egg → NULL (full egg dishes — multiplier fallback gives correct portions)
        for (const id of ['menemen', 'cilbir', 'shakshuka', 'omlet', 'ispanaklı_yumurta']) {
          await database.runAsync(
            `UPDATE food_items SET category = NULL WHERE id = ? AND source = 'local' AND category = 'egg'`, [id]
          );
        }
        // vegetable → NULL (kumpir 400g — no preset fits, multiplier fallback is better)
        await database.runAsync(
          `UPDATE food_items SET category = NULL WHERE id = 'kumpir' AND source = 'local' AND category = 'vegetable'`
        );
        // fish → snack (pizza shouldn't be in fish)
        await database.runAsync(
          `UPDATE food_items SET category = 'snack' WHERE id = 'pizza_ton_balikli' AND source = 'local' AND category = 'fish'`
        );
        // snack → NULL (double_burger 320g; snack presets 30/50/100g are useless)
        await database.runAsync(
          `UPDATE food_items SET category = NULL WHERE id = 'double_burger' AND source = 'local' AND category = 'snack'`
        );
        // vegetable → NULL (karniyarik 300g; adet 50/100/180g too small)
        await database.runAsync(
          `UPDATE food_items SET category = NULL WHERE id = 'karniyarik' AND source = 'local' AND category = 'vegetable'`
        );
        // beverage → NULL (espresso 30g; smallest beverage preset is 150g = 5x too large)
        await database.runAsync(
          `UPDATE food_items SET category = NULL WHERE id = 'espresso' AND source = 'local' AND category = 'beverage'`
        );
        // bread → NULL (large flatbreads/pides/toasts 180-200g; dilim 30/60/90g too small)
        for (const id of ['tost_karisik','lahmacun','pide_kasarli','kiymali_pide',
                          'yumurtali_pide','kusbasi_pide','dilli_kasarli',
                          'gozleme','gozleme_kiymali','gozleme_peynirli','gozleme_patatesli']) {
          await database.runAsync(
            `UPDATE food_items SET category = NULL WHERE id = ? AND source = 'local' AND category = 'bread'`, [id]
          );
        }
        // snack → NULL (meals ≥150g; largest snack preset is 100g — multiplier fallback gives correct 1 porsiyon)
        for (const id of [
          'burrito','whopper','club_sandwich','wrap_falafel','etli_ekmek','shawarma','gyros',
          'cheeseburger','panini','kumru','big_mac','veggie_burger','calzone','enchilada',
          'quesadilla','patates_kizartmasi','hot_dog','pizza_margarita','pizza_pepperoni',
          'pizza_karisik','pizza_ton_balikli','pizza_4_peynirli','pizza_sebzeli',
          'islak_hamburger','kol_boregi','tepsi_boregi','taco',
        ]) {
          await database.runAsync(
            `UPDATE food_items SET category = NULL WHERE id = ? AND source = 'local' AND category = 'snack'`, [id]
          );
        }
        // beverage → NULL (≤60g drinks; smallest beverage preset 150g is 2.5× too large)
        for (const id of ['turk_kahvesi_sade','turk_kahvesi_sekerli','macchiato']) {
          await database.runAsync(
            `UPDATE food_items SET category = NULL WHERE id = ? AND source = 'local' AND category = 'beverage'`, [id]
          );
        }
        // condiment → NULL (dips with 100g serving; condiment max preset is 30g)
        for (const id of ['acili_ezme','atom','guacamole','babaganus']) {
          await database.runAsync(
            `UPDATE food_items SET category = NULL WHERE id = ? AND source = 'local' AND category = 'condiment'`, [id]
          );
        }
        // serving_unit g → ml for liquid beverages (UI shows "200 g" instead of "200 ml")
        for (const id of ['kefir','ayran','sut_tam','sut_yarim','sut_yagsiz','badem_sutu']) {
          await database.runAsync(
            `UPDATE food_items SET serving_unit = 'ml' WHERE id = ? AND source = 'local' AND serving_unit = 'g'`, [id]
          );
        }
        // bread → NULL (su_boregi 150g, tost_kasarli 150g; bread max preset 90g = only 60% of serving)
        for (const id of ['su_boregi','tost_kasarli']) {
          await database.runAsync(
            `UPDATE food_items SET category = NULL WHERE id = ? AND source = 'local' AND category = 'bread'`, [id]
          );
        }
        // Nutritional corrections for seeded foods that had wrong values
        await database.runAsync(
          `UPDATE food_items SET calories=155, fat=2.5, protein=2.7, carbs=27
           WHERE id='pilav' AND source='local' AND calories=130`
        );
        await database.runAsync(
          `UPDATE food_items SET calories=46, carbs=12, sugar=12
           WHERE id='fanta' AND source='local' AND calories=42`
        );
        await database.runAsync(
          `UPDATE food_items SET calories=33, protein=2.5, carbs=2.6, fat=1.3, sugar=2.6
           WHERE id='ayran_icecek' AND source='local' AND calories=38`
        );
      } catch (_) {
        // Non-critical — portion picker falls back gracefully without category
      }

      // Index on (barcode, device_id) — NOT unique. The composite primary
      // key `bs_${barcode}_${deviceId}` combined with `INSERT OR REPLACE`
      // in barcodeDao.ts already guarantees one row per (barcode, device).
      // A UNIQUE index here would crash migrations on any DB that has
      // pre-existing duplicate rows from before device_id tracking existed
      // (e.g., two submissions for the same barcode where device_id
      // defaults to ''), which would poison the native handle.
      try {
        await database.runAsync(
          `CREATE INDEX IF NOT EXISTS idx_barcode_submissions_device ON barcode_submissions(barcode, device_id)`
        );
      } catch (_) {
        // ignore — index is an optimisation, not a correctness guarantee
      }
    } catch (e) {
      initFailed = true;
      if (__DEV__) console.warn('FitTrack: initDatabase failed:', e);
      // Don't rethrow — callers use try/catch anyway, and an in-flight
      // DB is better than no app at all. Individual DAO queries will
      // surface their own errors.
    }
  })();
  return initPromise;
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
      `INSERT OR IGNORE INTO food_items (id, name, name_tr, calories, protein, carbs, fat, fiber, sugar, serving_size, serving_unit, is_custom, is_favorite, source, category, common_portions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'local', ?, ?)`,
      [food.id, food.name, food.nameTr, food.calories, food.protein, food.carbs, food.fat, food.fiber ?? null, food.sugar ?? null, food.servingSize, food.servingUnit, food.category ?? null, food.common_portions ? JSON.stringify(food.common_portions) : null]
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
