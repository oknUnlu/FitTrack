import { getDatabase } from './database';

export interface BodyMetric {
  id: string;
  userId: string;
  date: string;
  weight: number;
  bodyFat: number | null;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  bicepCm: number | null;
  thighCm: number | null;
  progressPhotoPath: string | null;
}

export interface WaterLog {
  id: string;
  userId: string;
  date: string;
  totalMl: number;
  entries: { time: number; amount: number }[];
}

function rowToMetric(row: any): BodyMetric {
  return {
    id: row.id, userId: row.user_id, date: row.date, weight: row.weight,
    bodyFat: row.body_fat, waistCm: row.waist_cm, hipCm: row.hip_cm,
    chestCm: row.chest_cm, bicepCm: row.bicep_cm, thighCm: row.thigh_cm,
    progressPhotoPath: row.progress_photo_path,
  };
}

function rowToWater(row: any): WaterLog {
  return {
    id: row.id, userId: row.user_id, date: row.date, totalMl: row.total_ml,
    entries: JSON.parse(row.entries_json || '[]'),
  };
}

// Body Metrics
export async function getLatestMetric(userId: string): Promise<BodyMetric | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync('SELECT * FROM body_metrics WHERE user_id = ? ORDER BY date DESC LIMIT 1', [userId]);
  return row ? rowToMetric(row) : null;
}

export async function getAllMetrics(userId: string): Promise<BodyMetric[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync('SELECT * FROM body_metrics WHERE user_id = ? ORDER BY date DESC', [userId]);
  return rows.map(rowToMetric);
}

export async function getMetricsByRange(userId: string, start: string, end: string): Promise<BodyMetric[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync('SELECT * FROM body_metrics WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date', [userId, start, end]);
  return rows.map(rowToMetric);
}

export async function insertMetric(metric: BodyMetric): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO body_metrics (id, user_id, date, weight, body_fat, waist_cm, hip_cm, chest_cm, bicep_cm, thigh_cm, progress_photo_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [metric.id, metric.userId, metric.date, metric.weight, metric.bodyFat, metric.waistCm, metric.hipCm, metric.chestCm, metric.bicepCm, metric.thighCm, metric.progressPhotoPath]
  );
}

// Water Logs
export async function getWaterLog(userId: string, date: string): Promise<WaterLog | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync('SELECT * FROM water_logs WHERE user_id = ? AND date = ? LIMIT 1', [userId, date]);
  return row ? rowToWater(row) : null;
}

export async function getWaterLogsByDateRange(userId: string, startDate: string, endDate: string): Promise<WaterLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM water_logs WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date',
    [userId, startDate, endDate]
  );
  return (rows as any[]).map(rowToWater);
}

export async function upsertWaterLog(log: WaterLog): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO water_logs (id, user_id, date, total_ml, entries_json)
     VALUES (?, ?, ?, ?, ?)`,
    [log.id, log.userId, log.date, log.totalMl, JSON.stringify(log.entries)]
  );
}
