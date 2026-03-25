// Centralized type definitions for FitTrack
// Re-exports from DAO/service layers + shared types

// ── Database Models (re-exported from DAOs) ─────────────────────────────────
export type { User } from '../services/database/userDao';
export type { FoodItem } from '../services/database/foodDao';
export type { MealLog } from '../services/database/mealDao';
export type { WorkoutSession, ExerciseSet, Exercise, WorkoutTemplate } from '../services/database/workoutDao';
export type { BodyMetric, WaterLog } from '../services/database/progressDao';
export type { AIConversation } from '../services/database/aiDao';

// ── Service Models (re-exported from services) ──────────────────────────────
export type { Supplement, SupplementLog } from '../services/supplements/supplementService';
export type { WellnessEntry } from '../services/wellness/wellnessService';
export type { HealthSyncConfig, HealthDataPoint } from '../services/health/healthService';
export type { Challenge } from '../services/social/challengeService';
export type { Achievement } from '../services/achievements/achievementService';
export type { MealSuggestion } from '../services/mealPlanner/mealPlanService';

// ── Shared Enums & Literal Types ────────────────────────────────────────────
export type Gender = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
export type Goal = 'lose' | 'maintain' | 'gain' | 'muscle';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type Mood = 'great' | 'good' | 'neutral' | 'bad' | 'terrible';
export type SupplementFrequency = 'daily' | 'workout_days' | 'custom';
export type SupplementTimeOfDay = 'morning' | 'afternoon' | 'evening' | 'pre_workout' | 'post_workout';
export type HealthDataType = 'steps' | 'heartRate' | 'sleep' | 'activeCalories';
export type HealthSource = 'manual' | 'healthkit' | 'googlefit';
export type ChallengeType = 'steps' | 'workout' | 'calories' | 'water' | 'meditation' | 'custom';
export type AchievementCategory = 'meal' | 'workout' | 'streak' | 'water' | 'nutrition';
export type Rating = 1 | 2 | 3 | 4 | 5;

// ── Daily Summary (used by Dashboard) ───────────────────────────────────────
export interface DailySummary {
  date: string;
  caloriesConsumed: number;
  caloriesBurned: number;
  caloriesTarget: number;
  proteinConsumed: number;
  proteinTarget: number;
  carbsConsumed: number;
  carbsTarget: number;
  fatConsumed: number;
  fatTarget: number;
  waterMl: number;
  waterTarget: number;
  workoutsCompleted: number;
  stepsCount: number;
}

// ── Macro Targets ───────────────────────────────────────────────────────────
export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
