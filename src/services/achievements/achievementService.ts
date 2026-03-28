import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getTotalCompletedWorkouts, getSessionsByDateRange } from '../database/workoutDao';
import { getMealLogsByDateRange } from '../database/mealDao';
import { getWaterLogsByDateRange } from '../database/progressDao';
import { getUserById } from '../database/userDao';
import { calculateStreakDays } from '../../utils/activityUtils';
import { todayString } from '../../utils/helpers';

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
  // ── Streak ──────────────────────────────────────────────────────────────
  { id: 'streak_3',   icon: 'fire-circle',   color: '#FFA726', titleKey: 'streak3',   descKey: 'streak3Desc',   target: 3,   current: 0, unlocked: false, unlockedAt: null, category: 'streak' },
  { id: 'streak_7',   icon: 'fire',          color: '#FF7043', titleKey: 'streak7',   descKey: 'streak7Desc',   target: 7,   current: 0, unlocked: false, unlockedAt: null, category: 'streak' },
  { id: 'streak_14',  icon: 'fire',          color: '#F4511E', titleKey: 'streak14',  descKey: 'streak14Desc',  target: 14,  current: 0, unlocked: false, unlockedAt: null, category: 'streak' },
  { id: 'streak_30',  icon: 'fire',          color: '#FF5722', titleKey: 'streak30',  descKey: 'streak30Desc',  target: 30,  current: 0, unlocked: false, unlockedAt: null, category: 'streak' },
  { id: 'streak_60',  icon: 'fire',          color: '#BF360C', titleKey: 'streak60',  descKey: 'streak60Desc',  target: 60,  current: 0, unlocked: false, unlockedAt: null, category: 'streak' },

  // ── Workout ──────────────────────────────────────────────────────────────
  { id: 'first_workout',    icon: 'dumbbell',       color: '#42A5F5', titleKey: 'firstWorkout',    descKey: 'firstWorkoutDesc',    target: 1,   current: 0, unlocked: false, unlockedAt: null, category: 'workout' },
  { id: 'workouts_10',      icon: 'arm-flex',       color: '#29B6F6', titleKey: 'workouts10',      descKey: 'workouts10Desc',      target: 10,  current: 0, unlocked: false, unlockedAt: null, category: 'workout' },
  { id: 'workouts_25',      icon: 'weight-lifter',  color: '#039BE5', titleKey: 'workouts25',      descKey: 'workouts25Desc',      target: 25,  current: 0, unlocked: false, unlockedAt: null, category: 'workout' },
  { id: 'workouts_50',      icon: 'trophy',         color: '#FFC107', titleKey: 'workouts50',      descKey: 'workouts50Desc',      target: 50,  current: 0, unlocked: false, unlockedAt: null, category: 'workout' },
  { id: 'workouts_100',     icon: 'crown',          color: '#FFD700', titleKey: 'workouts100',     descKey: 'workouts100Desc',     target: 100, current: 0, unlocked: false, unlockedAt: null, category: 'workout' },
  { id: 'calorie_burn_1000',icon: 'lightning-bolt', color: '#FF9800', titleKey: 'calorieBurn1000', descKey: 'calorieBurn1000Desc', target: 1000,current: 0, unlocked: false, unlockedAt: null, category: 'workout' },
  { id: 'calorie_burn_5000',icon: 'lightning-bolt', color: '#E65100', titleKey: 'calorieBurn5000', descKey: 'calorieBurn5000Desc', target: 5000,current: 0, unlocked: false, unlockedAt: null, category: 'workout' },

  // ── Meal ─────────────────────────────────────────────────────────────────
  { id: 'first_meal',  icon: 'food-apple',          color: '#66BB6A', titleKey: 'firstMeal',  descKey: 'firstMealDesc',  target: 1,   current: 0, unlocked: false, unlockedAt: null, category: 'meal' },
  { id: 'meals_10',    icon: 'silverware-fork-knife',color: '#8BC34A', titleKey: 'meals10',    descKey: 'meals10Desc',    target: 10,  current: 0, unlocked: false, unlockedAt: null, category: 'meal' },
  { id: 'meals_25',    icon: 'silverware-fork-knife',color: '#6AB04C', titleKey: 'meals25',    descKey: 'meals25Desc',    target: 25,  current: 0, unlocked: false, unlockedAt: null, category: 'meal' },
  { id: 'meals_50',    icon: 'silverware-fork-knife',color: '#4CAF50', titleKey: 'meals50',    descKey: 'meals50Desc',    target: 50,  current: 0, unlocked: false, unlockedAt: null, category: 'meal' },
  { id: 'meals_100',   icon: 'silverware-variant',  color: '#2E7D32', titleKey: 'meals100',   descKey: 'meals100Desc',   target: 100, current: 0, unlocked: false, unlockedAt: null, category: 'meal' },
  { id: 'meals_200',   icon: 'chef-hat',            color: '#1B5E20', titleKey: 'meals200',   descKey: 'meals200Desc',   target: 200, current: 0, unlocked: false, unlockedAt: null, category: 'meal' },

  // ── Water ─────────────────────────────────────────────────────────────────
  { id: 'water_7',  icon: 'water',     color: '#29B6F6', titleKey: 'water7',  descKey: 'water7Desc',  target: 7,  current: 0, unlocked: false, unlockedAt: null, category: 'water' },
  { id: 'water_14', icon: 'water',     color: '#039BE5', titleKey: 'water14', descKey: 'water14Desc', target: 14, current: 0, unlocked: false, unlockedAt: null, category: 'water' },
  { id: 'water_30', icon: 'cup-water', color: '#0277BD', titleKey: 'water30', descKey: 'water30Desc', target: 30, current: 0, unlocked: false, unlockedAt: null, category: 'water' },

  // ── Nutrition ─────────────────────────────────────────────────────────────
  { id: 'calorie_goal',   icon: 'bullseye-arrow', color: '#FF9800', titleKey: 'calorieGoal',  descKey: 'calorieGoalDesc',  target: 1, current: 0, unlocked: false, unlockedAt: null, category: 'nutrition' },
  { id: 'calorie_goal_7', icon: 'bullseye-arrow', color: '#F57C00', titleKey: 'calorieGoal7', descKey: 'calorieGoal7Desc', target: 7, current: 0, unlocked: false, unlockedAt: null, category: 'nutrition' },
  { id: 'protein_goal',   icon: 'food-steak',     color: '#E91E63', titleKey: 'proteinGoal',  descKey: 'proteinGoalDesc',  target: 1, current: 0, unlocked: false, unlockedAt: null, category: 'nutrition' },
  { id: 'protein_goal_7', icon: 'food-steak',     color: '#C2185B', titleKey: 'proteinGoal7', descKey: 'proteinGoal7Desc', target: 7, current: 0, unlocked: false, unlockedAt: null, category: 'nutrition' },
  { id: 'perfect_day',    icon: 'star',           color: '#9C27B0', titleKey: 'perfectDay',   descKey: 'perfectDayDesc',   target: 1, current: 0, unlocked: false, unlockedAt: null, category: 'nutrition' },
];

export async function getAchievements(): Promise<Achievement[]> {
  try {
    const stored = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
    if (stored) {
      const parsed: Achievement[] = JSON.parse(stored);
      return DEFAULT_ACHIEVEMENTS.map((def) => {
        const existing = parsed.find((a) => a.id === def.id);
        return existing
          ? { ...def, current: existing.current, unlocked: existing.unlocked, unlockedAt: existing.unlockedAt }
          : def;
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
    if (__DEV__) console.warn('Failed to save achievements:', e);
  }
}

export async function updateAchievementProgress(id: string, current: number): Promise<Achievement | null> {
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

export async function checkAchievements(data: {
  totalMeals: number;
  totalWorkouts: number;
  streakDays: number;
  waterGoalDays: number;
  calorieGoalMet: boolean;
  proteinGoalMet: boolean;
  calorieGoalDays: number;
  proteinGoalDays: number;
  totalCaloriesBurned: number;
  allGoalsMet: boolean;
}): Promise<Achievement[]> {
  const achievements = await getAchievements();

  const updates: Record<string, number> = {
    first_meal:         data.totalMeals >= 1 ? 1 : 0,
    meals_10:           data.totalMeals,
    meals_25:           data.totalMeals,
    meals_50:           data.totalMeals,
    meals_100:          data.totalMeals,
    meals_200:          data.totalMeals,
    first_workout:      data.totalWorkouts >= 1 ? 1 : 0,
    workouts_10:        data.totalWorkouts,
    workouts_25:        data.totalWorkouts,
    workouts_50:        data.totalWorkouts,
    workouts_100:       data.totalWorkouts,
    streak_3:           data.streakDays,
    streak_7:           data.streakDays,
    streak_14:          data.streakDays,
    streak_30:          data.streakDays,
    streak_60:          data.streakDays,
    water_7:            data.waterGoalDays,
    water_14:           data.waterGoalDays,
    water_30:           data.waterGoalDays,
    calorie_goal:       data.calorieGoalMet ? 1 : 0,
    calorie_goal_7:     data.calorieGoalDays,
    protein_goal:       data.proteinGoalMet ? 1 : 0,
    protein_goal_7:     data.proteinGoalDays,
    calorie_burn_1000:  data.totalCaloriesBurned,
    calorie_burn_5000:  data.totalCaloriesBurned,
    perfect_day:        data.allGoalsMet ? 1 : 0,
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

  if (changed) await saveAchievements(achievements);
  return achievements;
}

// Auto-refresh: pulls all needed data from DB and calls checkAchievements
export async function refreshAchievements(userId: string): Promise<Achievement[]> {
  if (Platform.OS === 'web') return getAchievements();
  try {
    const farPast = '2020-01-01';
    const today = todayString();

    const [totalWorkouts, user, allSessions, allMeals, waterLogs] = await Promise.all([
      getTotalCompletedWorkouts(userId),
      getUserById(userId),
      getSessionsByDateRange(userId, farPast, today),
      getMealLogsByDateRange(userId, farPast, today),
      getWaterLogsByDateRange(userId, farPast, today),
    ]);

    const completedSessions = allSessions.filter((s) => s.completedAt !== null);
    const totalCaloriesBurned = completedSessions.reduce((sum, s) => sum + s.caloriesBurned, 0);
    const totalMeals = allMeals.length;

    // Streak
    const activeDates = new Set<string>();
    allMeals.forEach((m) => activeDates.add(m.date));
    completedSessions.forEach((s) => activeDates.add(s.date));
    const streakDays = calculateStreakDays(activeDates);

    // Water goal days
    const waterTargetMl = user?.waterTargetMl ?? 2500;
    const waterGoalDays = waterLogs.filter((w) => w.totalMl >= waterTargetMl).length;

    // Calorie & protein goal days (group meals by date)
    const calorieTarget = user?.tdee ?? 2000;
    const proteinTarget = user?.proteinTargetG ?? 150;
    const dayTotals = new Map<string, { cal: number; protein: number }>();
    for (const m of allMeals) {
      const d = dayTotals.get(m.date) ?? { cal: 0, protein: 0 };
      d.cal += m.caloriesConsumed;
      d.protein += m.proteinConsumed;
      dayTotals.set(m.date, d);
    }
    let calorieGoalDays = 0;
    let proteinGoalDays = 0;
    for (const [, d] of dayTotals) {
      if (d.cal >= calorieTarget * 0.85 && d.cal <= calorieTarget * 1.15) calorieGoalDays++;
      if (d.protein >= proteinTarget) proteinGoalDays++;
    }

    // Today's goals
    const todayDay = dayTotals.get(today);
    const todayWater = waterLogs.find((w) => w.date === today);
    const calorieGoalMet = !!todayDay && todayDay.cal >= calorieTarget * 0.85 && todayDay.cal <= calorieTarget * 1.15;
    const proteinGoalMet = !!todayDay && todayDay.protein >= proteinTarget;
    const waterGoalMet = (todayWater?.totalMl ?? 0) >= waterTargetMl;
    const allGoalsMet = calorieGoalMet && proteinGoalMet && waterGoalMet;

    return checkAchievements({
      totalMeals,
      totalWorkouts,
      streakDays,
      waterGoalDays,
      calorieGoalMet,
      proteinGoalMet,
      calorieGoalDays,
      proteinGoalDays,
      totalCaloriesBurned,
      allGoalsMet,
    });
  } catch (e) {
    if (__DEV__) console.warn('refreshAchievements failed:', e);
    return getAchievements();
  }
}

export function getUnlockedCount(achievements: Achievement[]): number {
  return achievements.filter((a) => a.unlocked).length;
}

export function getTotalCount(): number {
  return DEFAULT_ACHIEVEMENTS.length;
}
