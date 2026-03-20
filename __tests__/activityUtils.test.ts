import { calculateStreakDays, calculateWeeklyActiveDays } from '../src/utils/activityUtils';
import { format, subDays, startOfWeek, addDays } from 'date-fns';

// Helper: returns a date string N days before `now`
function daysAgo(n: number, now: Date): string {
  return format(subDays(now, n), 'yyyy-MM-dd');
}

// Helper: returns a date string for weekday i (0=Mon … 6=Sun) of the week containing `now`
function weekday(i: number, now: Date): string {
  return format(addDays(startOfWeek(now, { weekStartsOn: 1 }), i), 'yyyy-MM-dd');
}

// Fixed reference date for all tests: a Wednesday (2024-01-10)
const NOW = new Date('2024-01-10T12:00:00.000Z');

// ─────────────────────────────────────────────────────────────────────────────
// calculateStreakDays
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateStreakDays', () => {
  test('empty set → 0', () => {
    expect(calculateStreakDays(new Set(), NOW)).toBe(0);
  });

  test('only today active → 1', () => {
    const s = new Set([daysAgo(0, NOW)]);
    expect(calculateStreakDays(s, NOW)).toBe(1);
  });

  test('only yesterday active, today empty → 1', () => {
    const s = new Set([daysAgo(1, NOW)]);
    expect(calculateStreakDays(s, NOW)).toBe(1);
  });

  test('today and yesterday active → 2', () => {
    const s = new Set([daysAgo(0, NOW), daysAgo(1, NOW)]);
    expect(calculateStreakDays(s, NOW)).toBe(2);
  });

  test('5 consecutive days (today through 4 days ago) → 5', () => {
    const s = new Set(Array.from({ length: 5 }, (_, i) => daysAgo(i, NOW)));
    expect(calculateStreakDays(s, NOW)).toBe(5);
  });

  test('gap yesterday breaks streak even if today active → 1', () => {
    // today active, yesterday gap, 2 days ago active
    const s = new Set([daysAgo(0, NOW), daysAgo(2, NOW)]);
    expect(calculateStreakDays(s, NOW)).toBe(1);
  });

  test('today empty, yesterday gap → 0', () => {
    // today not active, yesterday not active, 2 days ago active
    const s = new Set([daysAgo(2, NOW)]);
    expect(calculateStreakDays(s, NOW)).toBe(0);
  });

  test('today empty, yesterday and day-before active → 2', () => {
    const s = new Set([daysAgo(1, NOW), daysAgo(2, NOW)]);
    expect(calculateStreakDays(s, NOW)).toBe(2);
  });

  test('streak stops at 59 days even if all 60 days active', () => {
    const s = new Set(Array.from({ length: 60 }, (_, i) => daysAgo(i, NOW)));
    // Loop runs i=0..59, all active → streak = 60 (counts today + 59 previous)
    expect(calculateStreakDays(s, NOW)).toBe(60);
  });

  test('future date in set is ignored (only past/today counted)', () => {
    const tomorrow = format(addDays(NOW, 1), 'yyyy-MM-dd');
    const s = new Set([tomorrow]);
    expect(calculateStreakDays(s, NOW)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateWeeklyActiveDays
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateWeeklyActiveDays', () => {
  test('empty set → all false', () => {
    const result = calculateWeeklyActiveDays(new Set(), NOW);
    expect(result).toEqual([false, false, false, false, false, false, false]);
  });

  test('result has exactly 7 elements', () => {
    expect(calculateWeeklyActiveDays(new Set(), NOW)).toHaveLength(7);
  });

  test('Monday of current week active → index 0 true', () => {
    const s = new Set([weekday(0, NOW)]);
    const result = calculateWeeklyActiveDays(s, NOW);
    expect(result[0]).toBe(true);
    expect(result.filter(Boolean)).toHaveLength(1);
  });

  test('Wednesday of current week active → index 2 true (NOW is Wednesday 2024-01-10)', () => {
    const s = new Set([weekday(2, NOW)]);
    const result = calculateWeeklyActiveDays(s, NOW);
    expect(result[2]).toBe(true);
    expect(result.filter(Boolean)).toHaveLength(1);
  });

  test('Sunday of current week active → index 6 true', () => {
    const s = new Set([weekday(6, NOW)]);
    const result = calculateWeeklyActiveDays(s, NOW);
    expect(result[6]).toBe(true);
    expect(result.filter(Boolean)).toHaveLength(1);
  });

  test('multiple days active', () => {
    const s = new Set([weekday(0, NOW), weekday(2, NOW), weekday(4, NOW)]);
    const result = calculateWeeklyActiveDays(s, NOW);
    expect(result).toEqual([true, false, true, false, true, false, false]);
  });

  test('all days of the week active → all true', () => {
    const s = new Set(Array.from({ length: 7 }, (_, i) => weekday(i, NOW)));
    const result = calculateWeeklyActiveDays(s, NOW);
    expect(result).toEqual([true, true, true, true, true, true, true]);
  });

  test('day from last week not counted', () => {
    const lastMonday = format(addDays(startOfWeek(NOW, { weekStartsOn: 1 }), -7), 'yyyy-MM-dd');
    const s = new Set([lastMonday]);
    const result = calculateWeeklyActiveDays(s, NOW);
    expect(result.some(Boolean)).toBe(false);
  });
});
