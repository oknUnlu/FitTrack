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

export async function insertUser(user: User): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO users (id, name, email, height, weight, age, gender, activity_level, goal, tdee, protein_target_g, carbs_target_g, fat_target_g, water_target_ml, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [user.id, user.name, user.email, user.height, user.weight, user.age, user.gender, user.activityLevel, user.goal, user.tdee, user.proteinTargetG, user.carbsTargetG, user.fatTargetG, user.waterTargetMl, user.createdAt]
  );
}

export async function updateUser(user: User): Promise<void> {
  await insertUser(user);
}

export async function deleteUser(userId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM users WHERE id = ?', [userId]);
}
