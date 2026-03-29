import AsyncStorage from '@react-native-async-storage/async-storage';
import { getHealthAdapter, getHealthSource, getTodayRange } from './nativeHealthAdapter';
import { format } from 'date-fns';

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

// ── Native Health Integration ─────────────────────────────────────────────

/**
 * Check if native health SDK (HealthKit / Health Connect) is available.
 */
export async function isNativeHealthAvailable(): Promise<boolean> {
  const adapter = getHealthAdapter();
  return adapter.isAvailable();
}

/**
 * Request health permissions and connect.
 * Returns true if permissions were granted.
 */
export async function connectNativeHealth(): Promise<boolean> {
  const adapter = getHealthAdapter();

  const available = await adapter.isAvailable();
  if (!available) return false;

  const granted = await adapter.requestPermissions();
  if (!granted) return false;

  const config = await getHealthSyncConfig();
  config.isConnected = true;
  await saveHealthSyncConfig(config);

  return true;
}

/**
 * Disconnect native health (keep data, just stop syncing).
 */
export async function disconnectNativeHealth(): Promise<void> {
  const config = await getHealthSyncConfig();
  config.isConnected = false;
  config.lastSyncDate = null;
  await saveHealthSyncConfig(config);
}

/**
 * Sync today's data from native health SDK into local storage.
 * Only syncs metric types that are enabled in config.
 */
export async function syncFromNativeHealth(): Promise<{
  synced: boolean;
  metrics: { steps: number; heartRate: number; sleep: number; activeCalories: number };
}> {
  const config = await getHealthSyncConfig();
  if (!config.isConnected) {
    return { synced: false, metrics: { steps: 0, heartRate: 0, sleep: 0, activeCalories: 0 } };
  }

  const adapter = getHealthAdapter();
  const source = getHealthSource();
  const { start, end } = getTodayRange();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const allMetrics = await adapter.getAllMetrics(start, end);

  const metrics = { steps: 0, heartRate: 0, sleep: 0, activeCalories: 0 };

  if (config.syncSteps && allMetrics.steps > 0) {
    metrics.steps = allMetrics.steps;
    await addHealthDataPoint({
      id: `${todayStr}_steps_${source}`,
      date: todayStr,
      type: 'steps',
      value: allMetrics.steps,
      unit: 'steps',
      source,
    });
  }

  if (config.syncHeartRate && allMetrics.heartRate) {
    metrics.heartRate = allMetrics.heartRate.avg;
    await addHealthDataPoint({
      id: `${todayStr}_heartRate_${source}`,
      date: todayStr,
      type: 'heartRate',
      value: allMetrics.heartRate.avg,
      unit: 'bpm',
      source,
    });
  }

  if (config.syncSleep && allMetrics.sleep > 0) {
    metrics.sleep = allMetrics.sleep;
    await addHealthDataPoint({
      id: `${todayStr}_sleep_${source}`,
      date: todayStr,
      type: 'sleep',
      value: allMetrics.sleep,
      unit: 'hours',
      source,
    });
  }

  if (config.syncCalories && allMetrics.activeCalories > 0) {
    metrics.activeCalories = allMetrics.activeCalories;
    await addHealthDataPoint({
      id: `${todayStr}_activeCalories_${source}`,
      date: todayStr,
      type: 'activeCalories',
      value: allMetrics.activeCalories,
      unit: 'kcal',
      source,
    });
  }

  // Update last sync timestamp
  config.lastSyncDate = new Date().toISOString();
  await saveHealthSyncConfig(config);

  return { synced: true, metrics };
}
