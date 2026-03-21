import { format, subDays, startOfWeek, addDays } from 'date-fns';

/**
 * Calculates the current activity streak in days.
 * Streak = consecutive days going backwards from today/yesterday.
 * If today has no activity yet, it's skipped (day isn't over).
 */
export function calculateStreakDays(activeDates: Set<string>, now: Date = new Date()): number {
  let streak = 0;
  for (let i = 0; i <= 59; i++) {
    const d = format(subDays(now, i), 'yyyy-MM-dd');
    if (activeDates.has(d)) {
      streak++;
    } else if (i === 0) {
      continue; // Today may not be over yet — don't break streak
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Returns a 7-element boolean array for Mon–Sun of the week containing `now`.
 * true = user was active on that day (has at least one meal or workout).
 */
export function calculateWeeklyActiveDays(activeDates: Set<string>, now: Date = new Date()): boolean[] {
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => {
    const d = format(addDays(monday, i), 'yyyy-MM-dd');
    return activeDates.has(d);
  });
}
