import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REVIEW_REQUESTED_KEY = 'fittrack_review_requested';
const REVIEW_LAST_PROMPT_KEY = 'fittrack_review_last_prompt';
const MIN_DAYS_BETWEEN_PROMPTS = 60;
const REVIEW_PROMPT_DELAY_MS = 2_000; // Delay to let achievement animation finish

/**
 * Milestone IDs that should trigger a review prompt.
 * These represent positive moments in the user journey.
 */
const REVIEW_TRIGGER_ACHIEVEMENTS = [
  'streak_7',       // 7-day streak — user is engaged
  'workouts_10',    // 10 workouts — solid commitment
  'meals_25',       // 25 meals logged — regular user
  'water_14',       // 14 days water goal — consistent
  'calorie_goal_7', // 7 days calorie goal met
];

/**
 * Check if we should request a review based on the achievement unlocked.
 * Returns true if a review prompt should be shown.
 */
export async function shouldRequestReview(achievementId: string): Promise<boolean> {
  // Only trigger on specific positive milestones
  if (!REVIEW_TRIGGER_ACHIEVEMENTS.includes(achievementId)) {
    return false;
  }

  try {
    // Check if already reviewed
    const alreadyRequested = await AsyncStorage.getItem(REVIEW_REQUESTED_KEY);
    if (alreadyRequested === 'true') return false;

    // Check minimum days between prompts
    const lastPrompt = await AsyncStorage.getItem(REVIEW_LAST_PROMPT_KEY);
    if (lastPrompt) {
      const daysSince = (Date.now() - parseInt(lastPrompt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSince < MIN_DAYS_BETWEEN_PROMPTS) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Request an in-app review using expo-store-review.
 * Only works on native platforms (iOS/Android).
 */
export async function requestInAppReview(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const StoreReview = require('expo-store-review');

    const isAvailable = await StoreReview.isAvailableAsync();
    if (!isAvailable) return false;

    await StoreReview.requestReview();

    // Mark that we've requested a review
    await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, 'true');
    await AsyncStorage.setItem(REVIEW_LAST_PROMPT_KEY, String(Date.now()));

    return true;
  } catch (e) {
    if (__DEV__) console.warn('requestInAppReview failed:', e);
    return false;
  }
}

/**
 * Check and trigger review if appropriate for the given achievement.
 * Call this after an achievement is unlocked.
 */
export async function checkAndRequestReview(achievementId: string): Promise<void> {
  const should = await shouldRequestReview(achievementId);
  if (should) {
    // Small delay so the achievement toast/animation can show first
    setTimeout(() => {
      requestInAppReview();
    }, REVIEW_PROMPT_DELAY_MS);
  }
}
