import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { format, subDays, startOfWeek, addDays } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { useUserStore } from '../store/userStore';
import { getUserById } from '../services/database/userDao';
import { getMealLogsByDate, getMealLogsByDateRange } from '../services/database/mealDao';
import { getSessionsByDate, getTotalCaloriesBurnedByDate, getSessionsByDateRange } from '../services/database/workoutDao';
import { getWaterLog, upsertWaterLog } from '../services/database/progressDao';
import { todayString } from '../utils/helpers';

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
  const [summary, setSummary] = useState<DailySummary>(defaultSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      if (Platform.OS === 'web') {
        // SQLite not available on web — use defaults
        setSummary(defaultSummary);
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

      // Weekly active days: Mon–Sun of current week
      const weekMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weeklyActiveDays = Array(7).fill(false).map((_, i) => {
        const d = format(addDays(weekMonday, i), 'yyyy-MM-dd');
        return activeDates.has(d);
      });

      // Streak: consecutive days going backwards (skip today if not yet active)
      let streakDays = 0;
      for (let i = 0; i <= 59; i++) {
        const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
        if (activeDates.has(d)) {
          streakDays++;
        } else if (i === 0) {
          continue; // Today may not be done yet
        } else {
          break;
        }
      }

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
      setError(e.message || 'Veri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

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
          id: uuidv4(), userId, date: today, totalMl: amountMl,
          entries: [{ time: Date.now(), amount: amountMl }],
        });
      }
    }
    setSummary((prev) => ({ ...prev, waterConsumedMl: prev.waterConsumedMl + amountMl }));
  }, [userId]);

  return { summary, loading, error, refresh: loadData, addWater };
}
