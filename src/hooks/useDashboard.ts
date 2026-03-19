import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { useUserStore } from '../store/userStore';
import { getUserById } from '../services/database/userDao';
import { getMealLogsByDate } from '../services/database/mealDao';
import { getSessionsByDate, getTotalCaloriesBurnedByDate } from '../services/database/workoutDao';
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

      const [user, meals, workouts, burned, water] = await Promise.all([
        getUserById(userId),
        getMealLogsByDate(userId, today),
        getSessionsByDate(userId, today),
        getTotalCaloriesBurnedByDate(userId, today),
        getWaterLog(userId, today),
      ]);

      const caloriesConsumed = meals.reduce((s, m) => s + m.caloriesConsumed, 0);
      const proteinConsumed = meals.reduce((s, m) => s + m.proteinConsumed, 0);
      const carbsConsumed = meals.reduce((s, m) => s + m.carbsConsumed, 0);
      const fatConsumed = meals.reduce((s, m) => s + m.fatConsumed, 0);
      const completedWorkout = workouts.find((w) => w.completedAt !== null);

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
        streakDays: 0,
        weeklyActiveDays: Array(7).fill(false),
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
