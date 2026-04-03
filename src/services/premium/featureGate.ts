import { usePremiumStore } from '../../store/premiumStore';

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
