import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

const KEY_COUNT = 'ai_request_count';
const KEY_DATE = 'ai_request_date';
const MAX_DAILY = 250;

async function resetIfNewDay(): Promise<void> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const savedDate = await AsyncStorage.getItem(KEY_DATE);
  if (savedDate !== today) {
    await AsyncStorage.multiSet([
      [KEY_COUNT, '0'],
      [KEY_DATE, today],
    ]);
  }
}

export async function getTodayRequestCount(): Promise<number> {
  await resetIfNewDay();
  return parseInt((await AsyncStorage.getItem(KEY_COUNT)) || '0', 10);
}

export function getMaxDailyRequests(): number {
  return MAX_DAILY;
}
