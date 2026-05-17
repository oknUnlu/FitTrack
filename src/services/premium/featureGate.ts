import { usePremiumStore } from '../../store/premiumStore';
import { canUseFeature, getRemainingUsage, getDailyLimit, type LimitedFeature } from '../ai/rateLimiter';

export type PremiumFeature =
  | 'ai_coach'
  | 'food_recognition'
  | 'progress_analysis'
  | 'data_export'
  | 'advanced_programs'
  | 'wellness_detail'
  | 'health_hub_full';

/**
 * Check if a feature is available (premium only)
 */
export function canAccessFeature(feature: PremiumFeature): boolean {
  const { isPremium } = usePremiumStore.getState();
  return isPremium;
}

/**
 * Check if a daily-limited feature can be used right now.
 * Returns { allowed, remaining, limit } so the UI can show usage info.
 * Free users are always blocked (allowed = false, remaining = 0).
 */
export async function checkDailyLimit(feature: LimitedFeature): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
}> {
  const { isPremium } = usePremiumStore.getState();
  const limit = getDailyLimit(feature);

  if (!isPremium) {
    return { allowed: false, remaining: 0, limit };
  }

  const allowed = await canUseFeature(feature);
  const remaining = await getRemainingUsage(feature);
  return { allowed, remaining, limit };
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
  return isPremium ? Infinity : 6;
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
