import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { usePremiumStore } from '../../store/premiumStore';

export type PremiumFeature =
  | 'ai_coach'
  | 'food_recognition'
  | 'barcode_scanner'
  | 'progress_analysis'
  | 'data_export'
  | 'advanced_programs'
  | 'wellness_detail'
  | 'health_hub_full';

interface UsageLimit {
  daily: number;
  storageKey: string;
}

const FREE_LIMITS: Record<string, UsageLimit> = {
  ai_coach: { daily: 10, storageKey: 'usage_ai_coach' },
  food_recognition: { daily: 3, storageKey: 'usage_food_recognition' },
  barcode_scanner: { daily: 5, storageKey: 'usage_barcode_scanner' },
};

// Features that are fully locked (no free usage)
const LOCKED_FEATURES: PremiumFeature[] = ['data_export'];

// Features with limited free access (not usage-count based)
const LIMITED_FEATURES: Record<string, { freeValue: any }> = {
  progress_analysis: { freeValue: '7d' }, // only 7-day in free
  advanced_programs: { freeValue: 3 },    // only 3 basic programs
  wellness_detail: { freeValue: 'basic' }, // basic only
  health_hub_full: { freeValue: 'steps' }, // steps only
};

/**
 * Check if a feature is available (either premium or within free limits)
 */
export function canAccessFeature(feature: PremiumFeature): boolean {
  const { isPremium } = usePremiumStore.getState();
  if (isPremium) return true;

  if (LOCKED_FEATURES.includes(feature)) return false;

  // Usage-limited and limited features are accessible in free tier
  return true;
}

/**
 * Check if user has reached the daily usage limit for a feature
 */
export async function checkUsageLimit(feature: PremiumFeature): Promise<{ allowed: boolean; used: number; limit: number }> {
  const { isPremium } = usePremiumStore.getState();
  const limit = FREE_LIMITS[feature];

  if (isPremium || !limit) {
    return { allowed: true, used: 0, limit: Infinity };
  }

  const today = format(new Date(), 'yyyy-MM-dd');
  const key = `${limit.storageKey}_${today}`;

  try {
    const stored = await AsyncStorage.getItem(key);
    const used = stored ? parseInt(stored, 10) : 0;
    return { allowed: used < limit.daily, used, limit: limit.daily };
  } catch {
    return { allowed: true, used: 0, limit: limit.daily };
  }
}

/**
 * Record a usage of a feature (increment daily counter)
 */
export async function recordFeatureUsage(feature: PremiumFeature): Promise<void> {
  const limit = FREE_LIMITS[feature];
  if (!limit) return;

  const today = format(new Date(), 'yyyy-MM-dd');
  const key = `${limit.storageKey}_${today}`;

  try {
    const stored = await AsyncStorage.getItem(key);
    const used = stored ? parseInt(stored, 10) : 0;
    await AsyncStorage.setItem(key, String(used + 1));
  } catch {
    // silently fail
  }
}

/**
 * Get remaining usage for a feature
 */
export async function getRemainingUsage(feature: PremiumFeature): Promise<number> {
  const { isPremium } = usePremiumStore.getState();
  if (isPremium) return Infinity;

  const limit = FREE_LIMITS[feature];
  if (!limit) return Infinity;

  const today = format(new Date(), 'yyyy-MM-dd');
  const key = `${limit.storageKey}_${today}`;

  try {
    const stored = await AsyncStorage.getItem(key);
    const used = stored ? parseInt(stored, 10) : 0;
    return Math.max(0, limit.daily - used);
  } catch {
    return limit.daily;
  }
}

/**
 * Check if a specific progress range is available
 */
export function isProgressRangeAvailable(range: string): boolean {
  const { isPremium } = usePremiumStore.getState();
  if (isPremium) return true;
  return range === '7d';
}

/**
 * Get the number of workout programs available
 */
export function getAvailableProgramCount(): number {
  const { isPremium } = usePremiumStore.getState();
  return isPremium ? Infinity : 3;
}

/**
 * Check if wellness detail view is available
 */
export function isWellnessDetailAvailable(): boolean {
  const { isPremium } = usePremiumStore.getState();
  return isPremium;
}

/**
 * Check if full health hub metrics are available
 */
export function isHealthHubFullAvailable(): boolean {
  const { isPremium } = usePremiumStore.getState();
  return isPremium;
}

/**
 * Get the free limit for a feature (for display purposes)
 */
export function getFeatureFreeLimit(feature: PremiumFeature): number | null {
  const limit = FREE_LIMITS[feature];
  return limit ? limit.daily : null;
}
