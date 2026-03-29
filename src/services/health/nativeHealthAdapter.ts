import { Platform } from 'react-native';
import type { NativeHealthAdapter, HealthMetrics } from './adapters/types';

export type { NativeHealthAdapter, HealthMetrics } from './adapters/types';

let _adapter: NativeHealthAdapter | null = null;

/**
 * Returns the platform-specific health adapter.
 * iOS → HealthKit, Android → Health Connect, Web → fallback (manual only).
 */
export function getHealthAdapter(): NativeHealthAdapter {
  if (_adapter) return _adapter;

  if (Platform.OS === 'ios') {
    const { iosAdapter } = require('./adapters/iosHealthKit');
    _adapter = iosAdapter;
  } else if (Platform.OS === 'android') {
    const { androidAdapter } = require('./adapters/androidHealthConnect');
    _adapter = androidAdapter;
  } else {
    const { fallbackAdapter } = require('./adapters/fallbackAdapter');
    _adapter = fallbackAdapter;
  }

  return _adapter!;
}

/**
 * Get the health source label based on current platform.
 */
export function getHealthSource(): 'healthkit' | 'googlefit' | 'manual' {
  if (Platform.OS === 'ios') return 'healthkit';
  if (Platform.OS === 'android') return 'googlefit';
  return 'manual';
}

/**
 * Get the platform health service name for display.
 */
export function getHealthServiceName(): string {
  if (Platform.OS === 'ios') return 'Apple Health';
  if (Platform.OS === 'android') return 'Health Connect';
  return 'Manual';
}

/**
 * Get today's date range (start of day to now).
 */
export function getTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  return { start, end: now };
}
