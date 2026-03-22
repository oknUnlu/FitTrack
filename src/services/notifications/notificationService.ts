import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const WATER_REMINDER_KEY = 'pref_water_reminder';
const MEAL_REMINDER_KEY = 'pref_meal_reminder';
const WORKOUT_REMINDER_KEY = 'pref_workout_reminder';

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
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content.data?.type === 'meal_reminder') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    if (!enabled) return;

    const mealTimes = [
      { hour: 8, minute: 0, title: '🍳 Kahvaltı Zamanı', body: 'Güne sağlıklı bir kahvaltıyla başla!' },
      { hour: 12, minute: 30, title: '🥗 Öğle Yemeği', body: 'Öğle yemeğini kaydetmeyi unutma!' },
      { hour: 19, minute: 0, title: '🍽️ Akşam Yemeği', body: 'Akşam yemeğini kaydetmeyi unutma!' },
    ];

    for (const meal of mealTimes) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: meal.title,
          body: meal.body,
          data: { type: 'meal_reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: meal.hour,
          minute: meal.minute,
        },
      });
    }
  } catch {
    // Notification scheduling not available
  }
}

export async function scheduleWaterReminders(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(WATER_REMINDER_KEY, String(enabled));

  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content.data?.type === 'water_reminder') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    if (!enabled) return;

    const waterHours = [9, 11, 13, 15, 17, 19, 21];
    for (const hour of waterHours) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💧 Su İç!',
          body: 'Bir bardak su içmeyi unutma. Vücudun suya ihtiyaç duyuyor!',
          data: { type: 'water_reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute: 0,
        },
      });
    }
  } catch {
    // Notification scheduling not available
  }
}

export async function scheduleWorkoutReminder(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(WORKOUT_REMINDER_KEY, String(enabled));

  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content.data?.type === 'workout_reminder') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    if (!enabled) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💪 Antrenman Zamanı!',
        body: 'Bugün antrenman yapmayı planlamıştın. Haydi harekete geç!',
        data: { type: 'workout_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 17,
        minute: 30,
      },
    });
  } catch {
    // Notification scheduling not available
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
}> {
  const [meal, water, workout] = await Promise.all([
    AsyncStorage.getItem(MEAL_REMINDER_KEY),
    AsyncStorage.getItem(WATER_REMINDER_KEY),
    AsyncStorage.getItem(WORKOUT_REMINDER_KEY),
  ]);
  return {
    meal: meal === 'true',
    water: water === 'true',
    workout: workout === 'true',
  };
}
