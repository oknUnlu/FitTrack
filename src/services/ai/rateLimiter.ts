import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

export type LimitedFeature = 'ai_coach' | 'food_recognition' | 'food_estimate';

const DAILY_LIMITS: Record<LimitedFeature, number> = {
  ai_coach: 10,
  food_recognition: 7,
  food_estimate: 7,
};

function getCountKey(feature: LimitedFeature): string {
  return `daily_count_${feature}`;
}

function getDateKey(feature: LimitedFeature): string {
  return `daily_date_${feature}`;
}

async function resetIfNewDay(feature: LimitedFeature): Promise<void> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const savedDate = await AsyncStorage.getItem(getDateKey(feature));
  if (savedDate !== today) {
    await AsyncStorage.multiSet([
      [getCountKey(feature), '0'],
      [getDateKey(feature), today],
    ]);
  }
}

export async function getTodayUsage(feature: LimitedFeature): Promise<number> {
  await resetIfNewDay(feature);
  return parseInt((await AsyncStorage.getItem(getCountKey(feature))) || '0', 10);
}

export async function incrementUsage(feature: LimitedFeature): Promise<void> {
  await resetIfNewDay(feature);
  const current = parseInt((await AsyncStorage.getItem(getCountKey(feature))) || '0', 10);
  await AsyncStorage.setItem(getCountKey(feature), String(current + 1));
}

export function getDailyLimit(feature: LimitedFeature): number {
  return DAILY_LIMITS[feature];
}

export async function canUseFeature(feature: LimitedFeature): Promise<boolean> {
  const usage = await getTodayUsage(feature);
  return usage < DAILY_LIMITS[feature];
}

export async function getRemainingUsage(feature: LimitedFeature): Promise<number> {
  const usage = await getTodayUsage(feature);
  return Math.max(0, DAILY_LIMITS[feature] - usage);
}
