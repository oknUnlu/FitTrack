import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const ACHIEVEMENTS_KEY = 'fittrack_achievements';

export interface Achievement {
  id: string;
  icon: string;
  color: string;
  titleKey: string;
  descKey: string;
  target: number;
  current: number;
  unlocked: boolean;
  unlockedAt: number | null;
  category: 'meal' | 'workout' | 'streak' | 'water' | 'nutrition';
}

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_meal', icon: 'food-apple', color: '#66BB6A', titleKey: 'firstMeal', descKey: 'firstMealDesc', target: 1, current: 0, unlocked: false, unlockedAt: null, category: 'meal' },
  { id: 'first_workout', icon: 'dumbbell', color: '#42A5F5', titleKey: 'firstWorkout', descKey: 'firstWorkoutDesc', target: 1, current: 0, unlocked: false, unlockedAt: null, category: 'workout' },
  { id: 'streak_7', icon: 'fire', color: '#FF7043', titleKey: 'streak7', descKey: 'streak7Desc', target: 7, current: 0, unlocked: false, unlockedAt: null, category: 'streak' },
  { id: 'streak_30', icon: 'fire', color: '#FF5722', titleKey: 'streak30', descKey: 'streak30Desc', target: 30, current: 0, unlocked: false, unlockedAt: null, category: 'streak' },
  { id: 'meals_10', icon: 'silverware-fork-knife', color: '#8BC34A', titleKey: 'meals10', descKey: 'meals10Desc', target: 10, current: 0, unlocked: false, unlockedAt: null, category: 'meal' },
  { id: 'meals_50', icon: 'silverware-fork-knife', color: '#4CAF50', titleKey: 'meals50', descKey: 'meals50Desc', target: 50, current: 0, unlocked: false, unlockedAt: null, category: 'meal' },
  { id: 'meals_100', icon: 'silverware-variant', color: '#2E7D32', titleKey: 'meals100', descKey: 'meals100Desc', target: 100, current: 0, unlocked: false, unlockedAt: null, category: 'meal' },
  { id: 'workouts_10', icon: 'arm-flex', color: '#29B6F6', titleKey: 'workouts10', descKey: 'workouts10Desc', target: 10, current: 0, unlocked: false, unlockedAt: null, category: 'workout' },
  { id: 'workouts_50', icon: 'trophy', color: '#FFC107', titleKey: 'workouts50', descKey: 'workouts50Desc', target: 50, current: 0, unlocked: false, unlockedAt: null, category: 'workout' },
  { id: 'water_7', icon: 'water', color: '#29B6F6', titleKey: 'water7', descKey: 'water7Desc', target: 7, current: 0, unlocked: false, unlockedAt: null, category: 'water' },
  { id: 'calorie_goal', icon: 'bullseye-arrow', color: '#FF9800', titleKey: 'calorieGoal', descKey: 'calorieGoalDesc', target: 1, current: 0, unlocked: false, unlockedAt: null, category: 'nutrition' },
  { id: 'protein_goal', icon: 'food-steak', color: '#E91E63', titleKey: 'proteinGoal', descKey: 'proteinGoalDesc', target: 1, current: 0, unlocked: false, unlockedAt: null, category: 'nutrition' },
];

export async function getAchievements(): Promise<Achievement[]> {
  try {
    const stored = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
    if (stored) {
      const parsed: Achievement[] = JSON.parse(stored);
      // Merge with defaults to handle new achievements added in updates
      return DEFAULT_ACHIEVEMENTS.map((def) => {
        const existing = parsed.find((a) => a.id === def.id);
        return existing ? { ...def, current: existing.current, unlocked: existing.unlocked, unlockedAt: existing.unlockedAt } : def;
      });
    }
    return [...DEFAULT_ACHIEVEMENTS];
  } catch {
    return [...DEFAULT_ACHIEVEMENTS];
  }
}

export async function saveAchievements(achievements: Achievement[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements));
  } catch (e) {
    console.warn('Failed to save achievements:', e);
  }
}

export async function updateAchievementProgress(
  id: string,
  current: number
): Promise<Achievement | null> {
  const achievements = await getAchievements();
  const achievement = achievements.find((a) => a.id === id);
  if (!achievement) return null;

  achievement.current = Math.max(achievement.current, current);
  if (!achievement.unlocked && achievement.current >= achievement.target) {
    achievement.unlocked = true;
    achievement.unlockedAt = Date.now();
  }

  await saveAchievements(achievements);
  return achievement;
}

export async function incrementAchievement(id: string): Promise<Achievement | null> {
  const achievements = await getAchievements();
  const achievement = achievements.find((a) => a.id === id);
  if (!achievement) return null;

  achievement.current += 1;
  if (!achievement.unlocked && achievement.current >= achievement.target) {
    achievement.unlocked = true;
    achievement.unlockedAt = Date.now();
  }

  await saveAchievements(achievements);
  return achievement;
}

// Check and update all achievements based on current app data
export async function checkAchievements(data: {
  totalMeals: number;
  totalWorkouts: number;
  streakDays: number;
  waterGoalDays: number;
  calorieGoalMet: boolean;
  proteinGoalMet: boolean;
}): Promise<Achievement[]> {
  const achievements = await getAchievements();

  const updates: Record<string, number> = {
    first_meal: data.totalMeals >= 1 ? 1 : 0,
    first_workout: data.totalWorkouts >= 1 ? 1 : 0,
    streak_7: data.streakDays,
    streak_30: data.streakDays,
    meals_10: data.totalMeals,
    meals_50: data.totalMeals,
    meals_100: data.totalMeals,
    workouts_10: data.totalWorkouts,
    workouts_50: data.totalWorkouts,
    water_7: data.waterGoalDays,
    calorie_goal: data.calorieGoalMet ? 1 : 0,
    protein_goal: data.proteinGoalMet ? 1 : 0,
  };

  let changed = false;
  for (const a of achievements) {
    const newVal = updates[a.id];
    if (newVal !== undefined && newVal > a.current) {
      a.current = newVal;
      if (!a.unlocked && a.current >= a.target) {
        a.unlocked = true;
        a.unlockedAt = Date.now();
      }
      changed = true;
    }
  }

  if (changed) {
    await saveAchievements(achievements);
  }

  return achievements;
}

export function getUnlockedCount(achievements: Achievement[]): number {
  return achievements.filter((a) => a.unlocked).length;
}

export function getTotalCount(): number {
  return DEFAULT_ACHIEVEMENTS.length;
}
