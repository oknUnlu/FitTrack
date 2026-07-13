/**
 * Notification scheduling — regression tests for the "some days nothing,
 * some days the same reminder several times at once" bug class.
 *
 * The core guarantees under test:
 *   1. Every scheduled reminder uses a STABLE identifier, so re-scheduling
 *      (which happens on every app launch via the App.tsx reconcile) replaces
 *      the OS entry instead of stacking a duplicate — even when a previous
 *      cancel pass was interrupted.
 *   2. Disabling a category cancels its entries and schedules nothing.
 *   3. Only remindable supplements (daily + fixed time-of-day) get entries.
 */

const store = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => store.get(k) ?? null),
  setItem: jest.fn(async (k: string, v: string) => void store.set(k, v)),
  removeItem: jest.fn(async (k: string) => void store.delete(k)),
  multiSet: jest.fn(async (pairs: [string, string][]) => void pairs.forEach(([k, v]) => store.set(k, v))),
}));

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-constants', () => ({ appOwnership: 'standalone' }));

const scheduled = new Map<string, any>();
const scheduleNotificationAsync = jest.fn(async (req: any) => {
  // Mirror the native behaviour: same identifier replaces the entry.
  const id = req.identifier ?? `auto_${scheduled.size}_${Math.random()}`;
  scheduled.set(id, req);
  return id;
});
const cancelScheduledNotificationAsync = jest.fn(async (id: string) => void scheduled.delete(id));
const getAllScheduledNotificationsAsync = jest.fn(async () =>
  [...scheduled.entries()].map(([identifier, req]) => ({ identifier, content: req.content }))
);

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
  scheduleNotificationAsync,
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
}));

import {
  scheduleWaterReminders,
  scheduleMealReminders,
  scheduleSupplementReminders,
} from '../src/services/notifications/notificationService';
import type { Supplement } from '../src/services/supplements/supplementService';

beforeEach(() => {
  store.clear();
  scheduled.clear();
  jest.clearAllMocks();
});

describe('water reminders', () => {
  test('schedules 7 daily entries with stable identifiers', async () => {
    await scheduleWaterReminders(true);
    expect(scheduled.size).toBe(7);
    expect([...scheduled.keys()]).toEqual([9, 11, 13, 15, 17, 19, 21].map((h) => `water_reminder_${h}`));
    for (const req of scheduled.values()) {
      expect(req.trigger).toMatchObject({ type: 'daily', minute: 0, channelId: 'reminders' });
    }
  });

  test('re-scheduling on every app launch never stacks duplicates', async () => {
    await scheduleWaterReminders(true);
    await scheduleWaterReminders(true); // App.tsx reconcile
    await scheduleWaterReminders(true); // next launch
    expect(scheduled.size).toBe(7);
  });

  test('duplicates survive even a failed cancel pass thanks to identifier replacement', async () => {
    await scheduleWaterReminders(true);
    // Simulate the worst case: the previous batch is untracked (ids lost)
    // AND the cancel scan errors out.
    store.delete('pref_water_reminder_ids');
    getAllScheduledNotificationsAsync.mockRejectedValueOnce(new Error('os error'));
    await scheduleWaterReminders(true);
    expect(scheduled.size).toBe(7); // identifier reuse replaced, not stacked
  });

  test('disabling cancels everything and schedules nothing', async () => {
    await scheduleWaterReminders(true);
    await scheduleWaterReminders(false);
    expect(scheduled.size).toBe(0);
  });
});

describe('meal reminders', () => {
  test('uses stable per-meal identifiers', async () => {
    await scheduleMealReminders(true);
    expect([...scheduled.keys()].sort()).toEqual([
      'meal_reminder_breakfast',
      'meal_reminder_dinner',
      'meal_reminder_lunch',
    ]);
  });
});

describe('supplement reminders', () => {
  const supp = (o: Partial<Supplement>): Supplement => ({
    id: 'x', name: 'X', dosage: '', frequency: 'daily', timeOfDay: 'morning', createdAt: 0,
    ...o,
  } as Supplement);

  test('schedules only daily supplements with fixed times, keyed by supplement id', async () => {
    await scheduleSupplementReminders(true, [
      supp({ id: 'a', name: 'D Vitamini', timeOfDay: 'morning' }),
      supp({ id: 'b', name: 'Kreatin', timeOfDay: 'pre_workout' as any }), // no fixed time → skipped
      supp({ id: 'c', name: 'Magnezyum', timeOfDay: 'evening', frequency: 'weekly' as any }), // not daily → skipped
    ]);
    expect([...scheduled.keys()]).toEqual(['supplement_reminder_a']);
  });

  test('removed supplements disappear on re-sync', async () => {
    await scheduleSupplementReminders(true, [supp({ id: 'a' }), supp({ id: 'b', timeOfDay: 'evening' })]);
    expect(scheduled.size).toBe(2);
    await scheduleSupplementReminders(true, [supp({ id: 'a' })]);
    expect([...scheduled.keys()]).toEqual(['supplement_reminder_a']);
  });
});
