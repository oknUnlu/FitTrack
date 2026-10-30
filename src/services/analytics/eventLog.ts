import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiPost } from '../api/apiClient';
import { API_ENDPOINTS } from '../../config/api';

export type AnalyticsEventName =
  | 'onboarding_completed'
  | 'first_calorie_entry'
  | 'first_photo_analysis'
  | 'paywall_seen'
  | 'purchase_started'
  | 'purchase_completed';

type EventProps = Record<string, string | number | boolean>;

/**
 * Fire-and-forget funnel event. Never throws, never awaited by callers —
 * a dropped event is an acceptable loss, a blocked UI is not.
 */
export function logEvent(name: AnalyticsEventName, props?: EventProps): void {
  apiPost(API_ENDPOINTS.event, { name, ...(props ? { props } : {}) }).catch((e) => {
    if (__DEV__) console.warn('[eventLog] failed to log', name, e);
  });
}

const FIRST_EVENT_KEY_PREFIX = 'fittrack_first_event_';

/**
 * Logs `name` only the first time it's ever called on this device — for
 * "first_*" funnel events, which must fire once per device, not on every
 * occurrence (e.g. every meal logged).
 */
export async function logFirstEvent(name: AnalyticsEventName, props?: EventProps): Promise<void> {
  const key = `${FIRST_EVENT_KEY_PREFIX}${name}`;
  try {
    const already = await AsyncStorage.getItem(key);
    if (already) return;
    await AsyncStorage.setItem(key, '1');
  } catch {
    // Can't confirm this is actually the first occurrence — skip rather
    // than risk logging "first" more than once.
    return;
  }
  logEvent(name, props);
}
