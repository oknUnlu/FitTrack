export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    height REAL NOT NULL,
    weight REAL NOT NULL,
    age INTEGER NOT NULL,
    gender TEXT NOT NULL,
    activity_level TEXT NOT NULL,
    goal TEXT NOT NULL,
    tdee INTEGER NOT NULL,
    protein_target_g INTEGER NOT NULL,
    carbs_target_g INTEGER NOT NULL,
    fat_target_g INTEGER NOT NULL,
    water_target_ml INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS food_items (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    name_tr TEXT,
    calories REAL NOT NULL,
    protein REAL NOT NULL,
    carbs REAL NOT NULL,
    fat REAL NOT NULL,
    fiber REAL,
    sugar REAL,
    barcode TEXT,
    serving_size REAL NOT NULL,
    serving_unit TEXT NOT NULL,
    is_custom INTEGER NOT NULL DEFAULT 0,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meal_logs (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    meal_type TEXT NOT NULL,
    food_item_id TEXT NOT NULL,
    serving_amount REAL NOT NULL,
    serving_unit TEXT NOT NULL,
    calories_consumed REAL NOT NULL,
    protein_consumed REAL NOT NULL,
    carbs_consumed REAL NOT NULL,
    fat_consumed REAL NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    name_tr TEXT NOT NULL,
    muscle_groups TEXT NOT NULL,
    equipment_type TEXT NOT NULL,
    instructions TEXT NOT NULL,
    met_value REAL NOT NULL,
    is_custom INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS workout_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    template_id TEXT,
    name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    calories_burned INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    completed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS exercise_sets (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    set_number INTEGER NOT NULL,
    reps INTEGER,
    weight_kg REAL,
    duration_seconds INTEGER,
    is_personal_record INTEGER NOT NULL DEFAULT 0,
    is_warmup INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS workout_templates (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    description TEXT,
    estimated_duration INTEGER NOT NULL,
    difficulty TEXT NOT NULL,
    target_muscle_groups TEXT NOT NULL,
    days_json TEXT NOT NULL,
    is_built_in INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'equipment',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS body_metrics (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    weight REAL NOT NULL,
    body_fat REAL,
    waist_cm REAL,
    hip_cm REAL,
    chest_cm REAL,
    bicep_cm REAL,
    thigh_cm REAL,
    progress_photo_path TEXT
  );

  CREATE TABLE IF NOT EXISTS water_logs (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    total_ml INTEGER NOT NULL DEFAULT 0,
    entries_json TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS ai_conversations (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_meal_logs_date ON meal_logs(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_workout_sessions_date ON workout_sessions(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_exercise_sets_session ON exercise_sets(session_id);
  CREATE INDEX IF NOT EXISTS idx_water_logs_date ON water_logs(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id, created_at);
`;
