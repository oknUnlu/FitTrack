import { getDatabase } from './database';

export interface WorkoutSession {
  id: string;
  userId: string;
  date: string;
  templateId: string | null;
  name: string;
  durationMinutes: number;
  caloriesBurned: number;
  notes: string | null;
  completedAt: number | null;
}

export interface ExerciseSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  isPersonalRecord: boolean;
  isWarmup: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  nameTr: string;
  muscleGroups: string[];
  equipmentType: string;
  instructions: string;
  metValue: number;
  isCustom: boolean;
}

export interface WorkoutTemplate {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  estimatedDuration: number;
  difficulty: string;
  targetMuscleGroups: string[];
  days: any[];
  isBuiltIn: boolean;
  createdAt: number;
}

function rowToSession(row: any): WorkoutSession {
  return {
    id: row.id, userId: row.user_id, date: row.date, templateId: row.template_id,
    name: row.name, durationMinutes: row.duration_minutes, caloriesBurned: row.calories_burned,
    notes: row.notes, completedAt: row.completed_at,
  };
}

function rowToExercise(row: any): Exercise {
  return {
    id: row.id, name: row.name, nameTr: row.name_tr,
    muscleGroups: JSON.parse(row.muscle_groups || '[]'),
    equipmentType: row.equipment_type, instructions: row.instructions,
    metValue: row.met_value, isCustom: !!row.is_custom,
  };
}

function rowToTemplate(row: any): WorkoutTemplate {
  return {
    id: row.id, userId: row.user_id, name: row.name, description: row.description,
    estimatedDuration: row.estimated_duration, difficulty: row.difficulty,
    targetMuscleGroups: JSON.parse(row.target_muscle_groups || '[]'),
    days: JSON.parse(row.days_json || '[]'),
    isBuiltIn: !!row.is_built_in, createdAt: row.created_at,
  };
}

// Sessions
export async function getRecentSessions(userId: string, limit = 10): Promise<WorkoutSession[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM workout_sessions WHERE user_id = ? ORDER BY date DESC LIMIT ?',
    [userId, limit]
  );
  return rows.map(rowToSession);
}

export async function getSessionsByDate(userId: string, date: string): Promise<WorkoutSession[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM workout_sessions WHERE user_id = ? AND date = ?',
    [userId, date]
  );
  return rows.map(rowToSession);
}

export async function getActiveSession(userId: string): Promise<WorkoutSession | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync(
    'SELECT * FROM workout_sessions WHERE user_id = ? AND completed_at IS NULL LIMIT 1',
    [userId]
  );
  return row ? rowToSession(row) : null;
}

export async function getTotalCaloriesBurnedByDate(userId: string, date: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync(
    'SELECT SUM(calories_burned) as total FROM workout_sessions WHERE user_id = ? AND date = ? AND completed_at IS NOT NULL',
    [userId, date]
  );
  return row?.total ?? 0;
}

export async function insertSession(session: WorkoutSession): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO workout_sessions (id, user_id, date, template_id, name, duration_minutes, calories_burned, notes, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [session.id, session.userId, session.date, session.templateId, session.name, session.durationMinutes, session.caloriesBurned, session.notes, session.completedAt]
  );
}

export async function updateSession(session: WorkoutSession): Promise<void> {
  await insertSession(session);
}

// Exercises
export async function getAllExercises(): Promise<Exercise[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync('SELECT * FROM exercises ORDER BY name_tr ASC');
  return rows.map(rowToExercise);
}

export async function searchExercises(query: string): Promise<Exercise[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM exercises WHERE name LIKE ? OR name_tr LIKE ? ORDER BY name_tr ASC',
    [`%${query}%`, `%${query}%`]
  );
  return rows.map(rowToExercise);
}

// Sets
export async function getSetsBySession(sessionId: string): Promise<ExerciseSet[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM exercise_sets WHERE session_id = ? ORDER BY exercise_id, set_number',
    [sessionId]
  );
  return rows.map((row: any) => ({
    id: row.id, sessionId: row.session_id, exerciseId: row.exercise_id,
    setNumber: row.set_number, reps: row.reps, weightKg: row.weight_kg,
    durationSeconds: row.duration_seconds, isPersonalRecord: !!row.is_personal_record,
    isWarmup: !!row.is_warmup,
  }));
}

export async function insertSet(set: ExerciseSet): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO exercise_sets (id, session_id, exercise_id, set_number, reps, weight_kg, duration_seconds, is_personal_record, is_warmup)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [set.id, set.sessionId, set.exerciseId, set.setNumber, set.reps, set.weightKg, set.durationSeconds, set.isPersonalRecord ? 1 : 0, set.isWarmup ? 1 : 0]
  );
}

// Templates
export async function getAllTemplates(): Promise<WorkoutTemplate[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync('SELECT * FROM workout_templates ORDER BY is_built_in DESC, name ASC');
  return rows.map(rowToTemplate);
}

export async function getBuiltInTemplates(): Promise<WorkoutTemplate[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync('SELECT * FROM workout_templates WHERE is_built_in = 1 ORDER BY name ASC');
  return rows.map(rowToTemplate);
}
