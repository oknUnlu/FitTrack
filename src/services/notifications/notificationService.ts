import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { Supplement } from '../supplements/supplementService';

const WATER_REMINDER_KEY = 'pref_water_reminder';
const MEAL_REMINDER_KEY = 'pref_meal_reminder';
const WORKOUT_REMINDER_KEY = 'pref_workout_reminder';
const SUPPLEMENT_REMINDER_KEY = 'pref_supplement_reminder';

// We track the OS-generated notification identifiers we schedule, per
// category, so disabling a category can cancel exactly the notifications
// we created — even if they were scheduled by an older build that didn't
// tag `data.type` correctly.
const WATER_IDS_KEY = 'pref_water_reminder_ids';
const MEAL_IDS_KEY = 'pref_meal_reminder_ids';
const WORKOUT_IDS_KEY = 'pref_workout_reminder_ids';
const SUPPLEMENT_IDS_KEY = 'pref_supplement_reminder_ids';

// Single Android notification channel for all reminders. Android coalesces and
// defers notifications by channel importance; binding reminders to a HIGH
// importance channel keeps them from being batched/delayed as aggressively
// (the default behaviour when no channel is declared). Required on Android 8+.
const REMINDER_CHANNEL_ID = 'reminders';

type Category = 'meal_reminder' | 'water_reminder' | 'workout_reminder' | 'supplement_reminder';

// Human-facing title fragments we use. Cross-checked against scheduled
// notifications as a belt-and-suspenders fallback when a legacy entry has
// no `data.type` tag and no stored identifier.
const TITLE_FRAGMENTS: Record<Category, string[]> = {
  meal_reminder: ['Breakfast Time', 'Lunch Time', 'Dinner Time'],
  water_reminder: ['Drink Water'],
  workout_reminder: ['Workout Time'],
  supplement_reminder: ['Supplement Time'],
};

async function loadIds(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function saveIds(key: string, ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(ids));
  } catch {}
}

/**
 * Cancel every scheduled notification that belongs to the given category,
 * using three fallbacks in order of reliability:
 *   1. Stored identifiers (most reliable — exact match)
 *   2. `data.type === category` (works for current code path)
 *   3. Title fragment match (catches legacy rows that were scheduled
 *      before `data.type` tagging existed)
 */
async function cancelCategory(
  Notifications: any,
  category: Category,
  idsKey: string,
): Promise<void> {
  // 1. Cancel by stored identifier.
  const stored = await loadIds(idsKey);
  for (const id of stored) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
  }
  await AsyncStorage.removeItem(idsKey);

  // 2 + 3. Scan all scheduled and cancel anything else that looks like ours.
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const fragments = TITLE_FRAGMENTS[category];
    for (const n of scheduled) {
      const typeTag = n?.content?.data?.type;
      const title: string = n?.content?.title || '';
      const matchesType = typeTag === category;
      const matchesTitle = fragments.some((f) => title.includes(f));
      if (matchesType || matchesTitle) {
        try {
          await Notifications.cancelScheduledNotificationAsync(n.identifier);
        } catch {}
      }
    }
  } catch {
    // non-fatal
  }
}

// Check if running in Expo Go (push notifications removed in Expo Go SDK 53+)
const isExpoGo = Constants.appOwnership === 'expo';

// Lazy-load expo-notifications only when needed and not in Expo Go
let _notifications: typeof import('expo-notifications') | null = null;
let _setupDone = false;

async function getNotificationsModule() {
  if (Platform.OS === 'web') return null;
  if (isExpoGo) return null;

  if (!_notifications) {
    try {
      _notifications = require('expo-notifications');
    } catch {
      return null;
    }
  }

  // Setup handler once
  if (_notifications && !_setupDone) {
    try {
      _notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      // Declare the reminders channel up front (Android only). Must exist
      // before any notification is scheduled against it, otherwise Android
      // silently falls back to the default channel.
      if (Platform.OS === 'android') {
        await _notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
          name: 'Reminders',
          importance: _notifications.AndroidImportance.HIGH,
          sound: 'default',
        });
      }

      _setupDone = true;
    } catch {
      // ignore
    }
  }

  return _notifications;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch {
    return false;
  }
}

export async function scheduleMealReminders(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(MEAL_REMINDER_KEY, String(enabled));

  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  try {
    // Always cancel first — including legacy entries without data.type tags.
    await cancelCategory(Notifications, 'meal_reminder', MEAL_IDS_KEY);

    if (!enabled) return;

    const mealTimes = [
      { id: 'meal_reminder_breakfast', hour: 8, minute: 0, title: '🍳 Breakfast Time', body: 'Start your day with a healthy breakfast!' },
      { id: 'meal_reminder_lunch', hour: 12, minute: 30, title: '🥗 Lunch Time', body: "Don't forget to log your lunch!" },
      { id: 'meal_reminder_dinner', hour: 19, minute: 0, title: '🍽️ Dinner Time', body: "Don't forget to log your dinner!" },
    ];

    const newIds: string[] = [];
    for (const meal of mealTimes) {
      const id = await Notifications.scheduleNotificationAsync({
        // Stable identifier — rescheduling REPLACES the existing entry
        // instead of piling up a duplicate, even if a previous cancel pass
        // was interrupted (app killed mid-run, OS error, …).
        identifier: meal.id,
        content: {
          title: meal.title,
          body: meal.body,
          data: { type: 'meal_reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: meal.hour,
          minute: meal.minute,
          channelId: REMINDER_CHANNEL_ID,
        },
      });
      if (id) newIds.push(id);
    }
    await saveIds(MEAL_IDS_KEY, newIds);
  } catch {
    // Notification scheduling not available
  }
}

export async function scheduleWaterReminders(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(WATER_REMINDER_KEY, String(enabled));

  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  try {
    await cancelCategory(Notifications, 'water_reminder', WATER_IDS_KEY);

    if (!enabled) return;

    const waterHours = [9, 11, 13, 15, 17, 19, 21];
    const newIds: string[] = [];
    for (const hour of waterHours) {
      const id = await Notifications.scheduleNotificationAsync({
        // Stable identifier — see scheduleMealReminders for rationale.
        identifier: `water_reminder_${hour}`,
        content: {
          title: '💧 Drink Water!',
          body: "Don't forget to drink a glass of water. Your body needs hydration!",
          data: { type: 'water_reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute: 0,
          channelId: REMINDER_CHANNEL_ID,
        },
      });
      if (id) newIds.push(id);
    }
    await saveIds(WATER_IDS_KEY, newIds);
  } catch {
    // Notification scheduling not available
  }
}

export async function scheduleWorkoutReminder(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(WORKOUT_REMINDER_KEY, String(enabled));

  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  try {
    await cancelCategory(Notifications, 'workout_reminder', WORKOUT_IDS_KEY);

    if (!enabled) return;

    const id = await Notifications.scheduleNotificationAsync({
      // Stable identifier — see scheduleMealReminders for rationale.
      identifier: 'workout_reminder_daily',
      content: {
        title: '💪 Workout Time!',
        body: "You planned a workout today. Let's get moving!",
        data: { type: 'workout_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 17,
        minute: 30,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
    if (id) await saveIds(WORKOUT_IDS_KEY, [id]);
  } catch {
    // Notification scheduling not available
  }
}

// Only supplements with a fixed daily time can be reminded reliably. Pre/post
// workout timings are relative to a workout (no fixed clock time) and
// non-daily frequencies can't be resolved to specific days, so both are
// intentionally skipped — see the design discussion.
const SUPPLEMENT_TIME_HOURS: Partial<Record<Supplement['timeOfDay'], number>> = {
  morning: 8,
  afternoon: 14,
  evening: 20,
};

function isRemindableSupplement(s: Supplement): boolean {
  return s.frequency === 'daily' && SUPPLEMENT_TIME_HOURS[s.timeOfDay] !== undefined;
}

/**
 * Master toggle for supplement reminders. When enabled, schedules one daily
 * notification per remindable supplement (daily frequency + a fixed
 * morning/afternoon/evening time). Always cancels the existing batch first so
 * this is safe to call repeatedly to re-sync after the supplement list changes.
 */
export async function scheduleSupplementReminders(
  enabled: boolean,
  supplements: Supplement[],
): Promise<void> {
  await AsyncStorage.setItem(SUPPLEMENT_REMINDER_KEY, String(enabled));

  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  try {
    await cancelCategory(Notifications, 'supplement_reminder', SUPPLEMENT_IDS_KEY);

    if (!enabled) return;

    const newIds: string[] = [];
    for (const s of supplements) {
      if (!isRemindableSupplement(s)) continue;
      const hour = SUPPLEMENT_TIME_HOURS[s.timeOfDay]!;
      const dosage = s.dosage?.trim();
      const id = await Notifications.scheduleNotificationAsync({
        // Stable identifier — see scheduleMealReminders for rationale.
        identifier: `supplement_reminder_${s.id}`,
        content: {
          title: '💊 Supplement Time',
          body: dosage ? `Time to take ${s.name} (${dosage})` : `Time to take ${s.name}`,
          data: { type: 'supplement_reminder', supplementId: s.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute: 0,
          channelId: REMINDER_CHANNEL_ID,
        },
      });
      if (id) newIds.push(id);
    }
    await saveIds(SUPPLEMENT_IDS_KEY, newIds);
  } catch {
    // Notification scheduling not available
  }
}

/**
 * Re-syncs supplement reminders to the current list, but only if the user has
 * the category enabled. Called after a supplement is added or removed so the
 * scheduled batch always reflects what's actually in the list. No-op (beyond a
 * cheap pref read) when reminders are off.
 */
export async function refreshSupplementReminders(supplements: Supplement[]): Promise<void> {
  const enabled = (await AsyncStorage.getItem(SUPPLEMENT_REMINDER_KEY)) === 'true';
  if (!enabled) return;
  await scheduleSupplementReminders(true, supplements);
}

/**
 * Nuclear option — cancels every scheduled notification the app knows
 * about (meal, water, workout, supplement). Useful as a "master off" or when
 * disabling notifications at the OS level from the profile screen.
 */
export async function cancelAllReminders(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    await cancelCategory(Notifications, 'meal_reminder', MEAL_IDS_KEY);
    await cancelCategory(Notifications, 'water_reminder', WATER_IDS_KEY);
    await cancelCategory(Notifications, 'workout_reminder', WORKOUT_IDS_KEY);
    await cancelCategory(Notifications, 'supplement_reminder', SUPPLEMENT_IDS_KEY);
    // As a final safety net, wipe any scheduled notifications that
    // slipped past all three categorised cancels (e.g. motivation).
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {}
    // Reset prefs so UI reflects disabled state on next load.
    await AsyncStorage.multiSet([
      [MEAL_REMINDER_KEY, 'false'],
      [WATER_REMINDER_KEY, 'false'],
      [WORKOUT_REMINDER_KEY, 'false'],
      [SUPPLEMENT_REMINDER_KEY, 'false'],
    ]);
  } catch {
    // non-fatal
  }
}

export async function sendMotivationNotification(message: string): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔥 FitTrack',
        body: message,
        data: { type: 'motivation' },
      },
      trigger: null,
    });
  } catch {
    // Notification not available
  }
}

export async function getNotificationPreferences(): Promise<{
  meal: boolean;
  water: boolean;
  workout: boolean;
  supplement: boolean;
}> {
  const [meal, water, workout, supplement] = await Promise.all([
    AsyncStorage.getItem(MEAL_REMINDER_KEY),
    AsyncStorage.getItem(WATER_REMINDER_KEY),
    AsyncStorage.getItem(WORKOUT_REMINDER_KEY),
    AsyncStorage.getItem(SUPPLEMENT_REMINDER_KEY),
  ]);
  return {
    meal: meal === 'true',
    water: water === 'true',
    workout: workout === 'true',
    supplement: supplement === 'true',
  };
}
