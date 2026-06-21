import { getDatabase } from './database';

export interface User {
  id: string;
  name: string;
  email: string;
  height: number;
  weight: number;
  age: number;
  gender: 'male' | 'female' | 'other';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
  goal: 'lose' | 'maintain' | 'gain' | 'muscle';
  tdee: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  waterTargetMl: number;
  createdAt: number;
}

function rowToUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    height: row.height,
    weight: row.weight,
    age: row.age,
    gender: row.gender,
    activityLevel: row.activity_level,
    goal: row.goal,
    tdee: row.tdee,
    proteinTargetG: row.protein_target_g,
    carbsTargetG: row.carbs_target_g,
    fatTargetG: row.fat_target_g,
    waterTargetMl: row.water_target_ml,
    createdAt: row.created_at,
  };
}

export async function getUserById(userId: string): Promise<User | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync('SELECT * FROM users WHERE id = ?', [userId]);
  return row ? rowToUser(row) : null;
}

// Update only the user's current weight in the users table. Used when the
// weight is edited from the Body Metrics screen so the Profile screen reflects
// the latest value. This deliberately does NOT mirror back into body_metrics
// (unlike updateUser), because the caller already wrote the body_metrics row —
// going through updateUser would create a duplicate row for the same day.
export async function updateUserWeight(userId: string, weight: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE users SET weight = ? WHERE id = ?', [weight, userId]);
}

export async function insertUser(user: User): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO users (id, name, email, height, weight, age, gender, activity_level, goal, tdee, protein_target_g, carbs_target_g, fat_target_g, water_target_ml, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [user.id, user.name, user.email, user.height, user.weight, user.age, user.gender, user.activityLevel, user.goal, user.tdee, user.proteinTargetG, user.carbsTargetG, user.fatTargetG, user.waterTargetMl, user.createdAt]
  );
}

export async function updateUser(user: User): Promise<void> {
  // Detect weight change to also record a body_metrics row. This keeps the
  // Progress screen's weight chart in sync with the Profile screen where
  // the user actually edits their current weight.
  let prevWeight: number | null = null;
  try {
    const prev = await getUserById(user.id);
    prevWeight = prev?.weight ?? null;
  } catch {
    prevWeight = null;
  }

  await insertUser(user);

  // Only write a body_metrics row when the weight is a valid number and
  // is either brand-new or has actually changed. Today's row is upserted
  // (INSERT OR REPLACE via id = `bm_${userId}_${date}`) so the user can
  // correct their weight multiple times on the same day without piling up
  // duplicate rows.
  try {
    if (
      typeof user.weight === 'number' &&
      !isNaN(user.weight) &&
      user.weight > 0 &&
      prevWeight !== user.weight
    ) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const date = `${yyyy}-${mm}-${dd}`;

      // Lazy import to avoid circular dependency: progressDao -> database -> (unchanged)
      const { insertMetric, getLatestMetric } = await import('./progressDao');

      // Preserve most recent body composition / measurements so the
      // user's latest body-fat % etc. isn't wiped out when they just
      // update their weight from the profile screen.
      const latest = await getLatestMetric(user.id);
      await insertMetric({
        id: `bm_${user.id}_${date}`,
        userId: user.id,
        date,
        weight: user.weight,
        bodyFat: latest?.date === date ? latest.bodyFat : null,
        waistCm: latest?.date === date ? latest.waistCm : null,
        hipCm: latest?.date === date ? latest.hipCm : null,
        chestCm: latest?.date === date ? latest.chestCm : null,
        bicepCm: latest?.date === date ? latest.bicepCm : null,
        thighCm: latest?.date === date ? latest.thighCm : null,
        progressPhotoPath: latest?.date === date ? latest.progressPhotoPath : null,
      });
    }
  } catch (e) {
    // non-fatal — profile update still succeeds even if metric mirror fails
    if (__DEV__) console.warn('updateUser body_metrics mirror failed:', e);
  }
}

export async function deleteUser(userId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM users WHERE id = ?', [userId]);
}
