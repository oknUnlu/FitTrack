import type { NativeHealthAdapter, HealthMetrics } from './types';

/**
 * Fallback adapter for web and unsupported platforms.
 * Always returns unavailable — user falls back to manual entry.
 */
export const fallbackAdapter: NativeHealthAdapter = {
  async isAvailable() { return false; },
  async requestPermissions() { return false; },
  async hasPermissions() { return false; },
  async getSteps() { return 0; },
  async getHeartRate() { return null; },
  async getSleep() { return 0; },
  async getActiveCalories() { return 0; },
  async getAllMetrics(): Promise<HealthMetrics> {
    return { steps: 0, heartRate: null, sleep: 0, activeCalories: 0 };
  },
};
