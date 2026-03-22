import AsyncStorage from '@react-native-async-storage/async-storage';

const HEALTH_SYNC_KEY = 'fittrack_health_sync';
const HEALTH_DATA_KEY = 'fittrack_health_data';

export interface HealthSyncConfig {
  isConnected: boolean;
  lastSyncDate: string | null;
  syncSteps: boolean;
  syncHeartRate: boolean;
  syncSleep: boolean;
  syncCalories: boolean;
}

export interface HealthDataPoint {
  id: string;
  date: string;
  type: 'steps' | 'heartRate' | 'sleep' | 'activeCalories';
  value: number;
  unit: string;
  source: 'manual' | 'healthkit' | 'googlefit';
}

const DEFAULT_CONFIG: HealthSyncConfig = {
  isConnected: false,
  lastSyncDate: null,
  syncSteps: true,
  syncHeartRate: true,
  syncSleep: true,
  syncCalories: true,
};

export async function getHealthSyncConfig(): Promise<HealthSyncConfig> {
  try {
    const stored = await AsyncStorage.getItem(HEALTH_SYNC_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_CONFIG;
  } catch { return DEFAULT_CONFIG; }
}

export async function saveHealthSyncConfig(config: HealthSyncConfig): Promise<void> {
  await AsyncStorage.setItem(HEALTH_SYNC_KEY, JSON.stringify(config));
}

export async function getHealthData(date?: string): Promise<HealthDataPoint[]> {
  try {
    const stored = await AsyncStorage.getItem(HEALTH_DATA_KEY);
    const data: HealthDataPoint[] = stored ? JSON.parse(stored) : [];
    if (date) return data.filter((d) => d.date === date);
    return data;
  } catch { return []; }
}

export async function addHealthDataPoint(point: HealthDataPoint): Promise<void> {
  const data = await getHealthData();
  // Replace if same date+type exists
  const idx = data.findIndex((d) => d.date === point.date && d.type === point.type);
  if (idx >= 0) {
    data[idx] = point;
  } else {
    data.push(point);
  }
  await AsyncStorage.setItem(HEALTH_DATA_KEY, JSON.stringify(data));
}

export async function getHealthStats(days: number): Promise<{
  avgSteps: number;
  avgHeartRate: number;
  avgSleep: number;
  avgActiveCalories: number;
  totalEntries: number;
}> {
  const data = await getHealthData();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const filtered = data.filter((d) => d.date >= cutoffStr);

  const byType = (type: string) => filtered.filter((d) => d.type === type);
  const avg = (arr: HealthDataPoint[]) => arr.length > 0 ? Math.round(arr.reduce((s, d) => s + d.value, 0) / arr.length) : 0;

  return {
    avgSteps: avg(byType('steps')),
    avgHeartRate: avg(byType('heartRate')),
    avgSleep: Math.round((byType('sleep').length > 0 ? byType('sleep').reduce((s, d) => s + d.value, 0) / byType('sleep').length : 0) * 10) / 10,
    avgActiveCalories: avg(byType('activeCalories')),
    totalEntries: filtered.length,
  };
}

export async function exportAllData(): Promise<string> {
  const [healthData, config] = await Promise.all([
    getHealthData(),
    getHealthSyncConfig(),
  ]);
  return JSON.stringify({ healthData, config, exportDate: new Date().toISOString() }, null, 2);
}
