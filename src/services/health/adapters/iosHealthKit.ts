import type { NativeHealthAdapter, HealthMetrics } from './types';

let AppleHealthKit: any = null;

function getHK(): any {
  if (!AppleHealthKit) {
    try {
      AppleHealthKit = require('react-native-health').default;
    } catch {
      return null;
    }
  }
  return AppleHealthKit;
}

const PERMISSIONS = {
  permissions: {
    read: [
      'StepCount',
      'HeartRate',
      'SleepAnalysis',
      'ActiveEnergyBurned',
    ],
    write: [],
  },
};

export const iosAdapter: NativeHealthAdapter = {
  async isAvailable(): Promise<boolean> {
    const hk = getHK();
    if (!hk) return false;
    return new Promise((resolve) => {
      hk.isAvailable((err: any, available: boolean) => {
        resolve(!err && available);
      });
    });
  },

  async requestPermissions(): Promise<boolean> {
    const hk = getHK();
    if (!hk) return false;
    return new Promise((resolve) => {
      hk.initHealthKit(PERMISSIONS, (err: any) => {
        resolve(!err);
      });
    });
  },

  async hasPermissions(): Promise<boolean> {
    // HealthKit doesn't expose a direct permission check API.
    // We try initializing — if it succeeds, we have access.
    return this.requestPermissions();
  },

  async getSteps(startDate: Date, endDate: Date): Promise<number> {
    const hk = getHK();
    if (!hk) return 0;
    return new Promise((resolve) => {
      hk.getStepCount(
        { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        (err: any, results: { value: number }) => {
          resolve(err ? 0 : Math.round(results.value || 0));
        },
      );
    });
  },

  async getHeartRate(startDate: Date, endDate: Date): Promise<{ avg: number; min: number; max: number } | null> {
    const hk = getHK();
    if (!hk) return null;
    return new Promise((resolve) => {
      hk.getHeartRateSamples(
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          ascending: false,
          limit: 100,
        },
        (err: any, results: Array<{ value: number }>) => {
          if (err || !results || results.length === 0) {
            resolve(null);
            return;
          }
          const values = results.map((r) => r.value);
          resolve({
            avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
            min: Math.round(Math.min(...values)),
            max: Math.round(Math.max(...values)),
          });
        },
      );
    });
  },

  async getSleep(startDate: Date, endDate: Date): Promise<number> {
    const hk = getHK();
    if (!hk) return 0;
    return new Promise((resolve) => {
      hk.getSleepSamples(
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: 50,
        },
        (err: any, results: Array<{ startDate: string; endDate: string; value: string }>) => {
          if (err || !results || results.length === 0) {
            resolve(0);
            return;
          }
          // Filter only actual sleep (ASLEEP, not IN_BED)
          const sleepSamples = results.filter(
            (r) => r.value === 'ASLEEP' || r.value === 'CORE' || r.value === 'DEEP' || r.value === 'REM'
          );
          const totalMs = sleepSamples.reduce((sum, s) => {
            return sum + (new Date(s.endDate).getTime() - new Date(s.startDate).getTime());
          }, 0);
          const hours = Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10;
          resolve(hours);
        },
      );
    });
  },

  async getActiveCalories(startDate: Date, endDate: Date): Promise<number> {
    const hk = getHK();
    if (!hk) return 0;
    return new Promise((resolve) => {
      hk.getActiveEnergyBurned(
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        (err: any, results: Array<{ value: number }>) => {
          if (err || !results || results.length === 0) {
            resolve(0);
            return;
          }
          const total = results.reduce((sum, r) => sum + (r.value || 0), 0);
          resolve(Math.round(total));
        },
      );
    });
  },

  async getAllMetrics(startDate: Date, endDate: Date): Promise<HealthMetrics> {
    const [steps, heartRate, sleep, activeCalories] = await Promise.all([
      this.getSteps(startDate, endDate),
      this.getHeartRate(startDate, endDate),
      this.getSleep(startDate, endDate),
      this.getActiveCalories(startDate, endDate),
    ]);
    return { steps, heartRate, sleep, activeCalories };
  },
};
