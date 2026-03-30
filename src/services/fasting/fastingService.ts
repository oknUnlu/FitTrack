import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

const FASTING_LOGS_KEY = 'fittrack_fasting_logs';
const FASTING_SETTINGS_KEY = 'fittrack_fasting_settings';

export interface FastingLog {
  id: string;
  date: string;
  startTime: string;   // "04:30" (sahur bitis)
  endTime: string;     // "19:15" (iftar)
  completed: boolean;
  notes: string;
}

export interface FastingSettings {
  enabled: boolean;
  defaultStartTime: string;  // sahur bitis saati
  defaultEndTime: string;    // iftar saati
  remindSahur: boolean;
  remindIftar: boolean;
}

const DEFAULT_SETTINGS: FastingSettings = {
  enabled: false,
  defaultStartTime: '04:30',
  defaultEndTime: '19:15',
  remindSahur: true,
  remindIftar: true,
};

// ── Settings ──

export async function getFastingSettings(): Promise<FastingSettings> {
  try {
    const stored = await AsyncStorage.getItem(FASTING_SETTINGS_KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveFastingSettings(settings: FastingSettings): Promise<void> {
  await AsyncStorage.setItem(FASTING_SETTINGS_KEY, JSON.stringify(settings));
}

// ── Logs ──

export async function getFastingLogs(): Promise<FastingLog[]> {
  try {
    const stored = await AsyncStorage.getItem(FASTING_LOGS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

async function saveFastingLogs(logs: FastingLog[]): Promise<void> {
  await AsyncStorage.setItem(FASTING_LOGS_KEY, JSON.stringify(logs));
}

export async function getTodayFastingLog(): Promise<FastingLog | null> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const logs = await getFastingLogs();
  return logs.find((l) => l.date === today) ?? null;
}

export async function saveFastingLog(log: FastingLog): Promise<void> {
  const logs = await getFastingLogs();
  const index = logs.findIndex((l) => l.id === log.id);
  if (index >= 0) {
    logs[index] = log;
  } else {
    logs.push(log);
  }
  await saveFastingLogs(logs);
}

export async function completeFasting(id: string): Promise<void> {
  const logs = await getFastingLogs();
  const log = logs.find((l) => l.id === id);
  if (log) {
    log.completed = true;
    await saveFastingLogs(logs);
  }
}

export async function getFastingStreak(): Promise<number> {
  const logs = await getFastingLogs();
  const completedDates = logs
    .filter((l) => l.completed)
    .map((l) => l.date)
    .sort()
    .reverse();

  if (completedDates.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const checkDate = format(new Date(today.getTime() - i * 86400000), 'yyyy-MM-dd');
    if (completedDates.includes(checkDate)) {
      streak++;
    } else if (i > 0) {
      break; // streak broken
    }
  }
  return streak;
}

/**
 * Calculate remaining fasting time in minutes.
 */
export function getRemainingFastingMinutes(endTime: string): number {
  const now = new Date();
  const [h, m] = endTime.split(':').map(Number);
  const end = new Date(now);
  end.setHours(h, m, 0, 0);

  if (end.getTime() <= now.getTime()) return 0;
  return Math.round((end.getTime() - now.getTime()) / 60000);
}

/**
 * Format minutes into "Xh Ym" string.
 */
export function formatFastingDuration(minutes: number): string {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
