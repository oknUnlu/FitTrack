import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format, subDays } from 'date-fns';
import { generateId } from '../utils/helpers';
import { useUserStore } from '../store/userStore';
import { useMealStore } from '../store/mealStore';
import { getUserById } from '../services/database/userDao';
import { getMealLogsByDate, getMealLogsByDateRange } from '../services/database/mealDao';
import { getSessionsByDate, getTotalCaloriesBurnedByDate, getSessionsByDateRange } from '../services/database/workoutDao';
import { getWaterLog, upsertWaterLog } from '../services/database/progressDao';
import { todayString } from '../utils/helpers';
import { calculateStreakDays, calculateWeeklyActiveDays } from '../utils/activityUtils';

export interface DailySummary {
  caloriesConsumed: number;
  calorieTarget: number;
  caloriesBurned: number;
  proteinConsumed: number;
  proteinTarget: number;
  carbsConsumed: number;
  carbsTarget: number;
  fatConsumed: number;
  fatTarget: number;
  waterConsumedMl: number;
  waterTargetMl: number;
  hasWorkoutToday: boolean;
  workoutName: string | null;
  workoutDuration: number | null;
  workoutCalories: number | null;
  streakDays: number;
  weeklyActiveDays: boolean[];
}

const defaultSummary: DailySummary = {
  caloriesConsumed: 0, calorieTarget: 2000, caloriesBurned: 0,
  proteinConsumed: 0, proteinTarget: 150, carbsConsumed: 0, carbsTarget: 200,
  fatConsumed: 0, fatTarget: 70, waterConsumedMl: 0, waterTargetMl: 2500,
  hasWorkoutToday: false, workoutName: null, workoutDuration: null, workoutCalories: null,
  streakDays: 0, weeklyActiveDays: Array(7).fill(false),
};

export function useDashboard() {
  const userId = useUserStore((s) => s.userId);
  const webMeals = useMealStore((s) => s.meals);
  const [summary, setSummary] = useState<DailySummary>(defaultSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      if (Platform.OS === 'web') {
        const today = todayString();
        const todayMeals = webMeals.filter((m) => m.date === today);
        const caloriesConsumed = todayMeals.reduce((s, m) => s + m.caloriesConsumed, 0);
        const proteinConsumed = todayMeals.reduce((s, m) => s + m.proteinConsumed, 0);
        const carbsConsumed = todayMeals.reduce((s, m) => s + m.carbsConsumed, 0);
        const fatConsumed = todayMeals.reduce((s, m) => s + m.fatConsumed, 0);
        setSummary({
          ...defaultSummary,
          caloriesConsumed,
          proteinConsumed,
          carbsConsumed,
          fatConsumed,
        });
        setError(null);
        return;
      }

      const today = todayString();

      const sixtyDaysAgo = format(subDays(new Date(), 59), 'yyyy-MM-dd');

      const [user, meals, workouts, burned, water, recentMeals, recentSessions] = await Promise.all([
        getUserById(userId),
        getMealLogsByDate(userId, today),
        getSessionsByDate(userId, today),
        getTotalCaloriesBurnedByDate(userId, today),
        getWaterLog(userId, today),
        getMealLogsByDateRange(userId, sixtyDaysAgo, today),
        getSessionsByDateRange(userId, sixtyDaysAgo, today),
      ]);

      const caloriesConsumed = meals.reduce((s, m) => s + m.caloriesConsumed, 0);
      const proteinConsumed = meals.reduce((s, m) => s + m.proteinConsumed, 0);
      const carbsConsumed = meals.reduce((s, m) => s + m.carbsConsumed, 0);
      const fatConsumed = meals.reduce((s, m) => s + m.fatConsumed, 0);
      const completedWorkout = workouts.find((w) => w.completedAt !== null);

      // Build set of active dates (has meal or completed workout)
      const activeDates = new Set<string>();
      recentMeals.forEach((m) => activeDates.add(m.date));
      recentSessions.filter((s) => s.completedAt !== null).forEach((s) => activeDates.add(s.date));

      const streakDays = calculateStreakDays(activeDates);
      const weeklyActiveDays = calculateWeeklyActiveDays(activeDates);

      setSummary({
        caloriesConsumed,
        calorieTarget: user?.tdee ?? 2000,
        caloriesBurned: burned,
        proteinConsumed,
        proteinTarget: user?.proteinTargetG ?? 150,
        carbsConsumed,
        carbsTarget: user?.carbsTargetG ?? 200,
        fatConsumed,
        fatTarget: user?.fatTargetG ?? 70,
        waterConsumedMl: water?.totalMl ?? 0,
        waterTargetMl: user?.waterTargetMl ?? 2500,
        hasWorkoutToday: !!completedWorkout,
        workoutName: completedWorkout?.name ?? null,
        workoutDuration: completedWorkout?.durationMinutes ?? null,
        workoutCalories: completedWorkout?.caloriesBurned ?? null,
        streakDays,
        weeklyActiveDays,
      });
      setError(null);
    } catch (e: any) {
      setError(e.message || 'An error occurred while loading data');
    } finally {
      setLoading(false);
    }
  }, [userId, webMeals]);

  useEffect(() => { loadData(); }, [loadData]);

  // Refresh data when the screen regains focus (e.g. switching back from Calorie tab)
  const navigation = useNavigation();
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation, loadData]);

  const addWater = useCallback(async (amountMl: number) => {
    if (Platform.OS !== 'web') {
      const today = todayString();
      const existing = await getWaterLog(userId, today);
      if (existing) {
        const updated = {
          ...existing,
          totalMl: existing.totalMl + amountMl,
          entries: [...existing.entries, { time: Date.now(), amount: amountMl }],
        };
        await upsertWaterLog(updated);
      } else {
        await upsertWaterLog({
          id: generateId(), userId, date: today, totalMl: amountMl,
          entries: [{ time: Date.now(), amount: amountMl }],
        });
      }
    }
    setSummary((prev) => ({ ...prev, waterConsumedMl: prev.waterConsumedMl + amountMl }));
  }, [userId]);

  return { summary, loading, error, refresh: loadData, addWater };
}
