import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export function todayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDate(date: Date | string, fmt = 'dd MMMM yyyy'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, fmt, { locale: tr });
}

export function formatCalories(value: number): string {
  return `${Math.round(value)} kcal`;
}

export function formatGrams(value: number): string {
  return `${Math.round(value)}g`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getProgressColor(progress: number): string {
  if (progress <= 0.8) return '#66BB6A';
  if (progress <= 1.05) return '#FFCA28';
  return '#EF5350';
}

export const MEAL_TYPES = [
  { key: 'breakfast' as const, label: 'Kahvalti', icon: 'coffee' },
  { key: 'lunch' as const, label: 'Ogle Yemegi', icon: 'food' },
  { key: 'dinner' as const, label: 'Aksam Yemegi', icon: 'food-variant' },
  { key: 'snack' as const, label: 'Ara Ogun', icon: 'food-apple' },
];

export const DAYS_TR = ['Pt', 'Sa', 'Ca', 'Pe', 'Cu', 'Ct', 'Pz'];
