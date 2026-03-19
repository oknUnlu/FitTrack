import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

const KEY_COUNT = 'ai_request_count';
const KEY_DATE = 'ai_request_date';
const KEY_TIMESTAMPS = 'ai_minute_timestamps';
const MAX_DAILY = 250;
const MAX_PER_MINUTE = 10;

async function resetIfNewDay(): Promise<void> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const savedDate = await AsyncStorage.getItem(KEY_DATE);
  if (savedDate !== today) {
    await AsyncStorage.multiSet([
      [KEY_COUNT, '0'],
      [KEY_DATE, today],
      [KEY_TIMESTAMPS, ''],
    ]);
  }
}

export async function canMakeRequest(): Promise<boolean> {
  await resetIfNewDay();
  const count = parseInt((await AsyncStorage.getItem(KEY_COUNT)) || '0', 10);
  if (count >= MAX_DAILY) return false;

  const raw = (await AsyncStorage.getItem(KEY_TIMESTAMPS)) || '';
  const timestamps = raw ? raw.split(',').map(Number).filter(Boolean) : [];
  const oneMinAgo = Date.now() - 60000;
  const recentCount = timestamps.filter((t) => t > oneMinAgo).length;
  return recentCount < MAX_PER_MINUTE;
}

export async function recordRequest(): Promise<void> {
  await resetIfNewDay();
  const count = parseInt((await AsyncStorage.getItem(KEY_COUNT)) || '0', 10);
  await AsyncStorage.setItem(KEY_COUNT, String(count + 1));

  const raw = (await AsyncStorage.getItem(KEY_TIMESTAMPS)) || '';
  const timestamps = raw ? raw.split(',').map(Number).filter(Boolean) : [];
  timestamps.push(Date.now());
  const oneMinAgo = Date.now() - 60000;
  const filtered = timestamps.filter((t) => t > oneMinAgo);
  await AsyncStorage.setItem(KEY_TIMESTAMPS, filtered.join(','));
}

export async function getTodayRequestCount(): Promise<number> {
  await resetIfNewDay();
  return parseInt((await AsyncStorage.getItem(KEY_COUNT)) || '0', 10);
}

export function getMaxDailyRequests(): number {
  return MAX_DAILY;
}
