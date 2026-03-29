import type { NativeHealthAdapter, HealthMetrics } from './types';

let HealthConnect: any = null;

function getHC(): any {
  if (!HealthConnect) {
    try {
      HealthConnect = require('react-native-health-connect');
    } catch {
      return null;
    }
  }
  return HealthConnect;
}

export const androidAdapter: NativeHealthAdapter = {
  async isAvailable(): Promise<boolean> {
    const hc = getHC();
    if (!hc) return false;
    try {
      const status = await hc.getSdkStatus();
      // SDK_AVAILABLE = 3
      return status === 3;
    } catch {
      return false;
    }
  },

  async requestPermissions(): Promise<boolean> {
    const hc = getHC();
    if (!hc) return false;
    try {
      await hc.initialize();
      const granted = await hc.requestPermission([
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'read', recordType: 'HeartRate' },
        { accessType: 'read', recordType: 'SleepSession' },
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      ]);
      return granted && granted.length > 0;
    } catch {
      return false;
    }
  },

  async hasPermissions(): Promise<boolean> {
    const hc = getHC();
    if (!hc) return false;
    try {
      await hc.initialize();
      // Try reading a small sample to check permissions
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      await hc.readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: oneHourAgo.toISOString(),
          endTime: now.toISOString(),
        },
      });
      return true;
    } catch {
      return false;
    }
  },

  async getSteps(startDate: Date, endDate: Date): Promise<number> {
    const hc = getHC();
    if (!hc) return 0;
    try {
      await hc.initialize();
      const result = await hc.readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      });
      if (!result?.records) return 0;
      return result.records.reduce((sum: number, r: any) => sum + (r.count || 0), 0);
    } catch {
      return 0;
    }
  },

  async getHeartRate(startDate: Date, endDate: Date): Promise<{ avg: number; min: number; max: number } | null> {
    const hc = getHC();
    if (!hc) return null;
    try {
      await hc.initialize();
      const result = await hc.readRecords('HeartRate', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      });
      if (!result?.records || result.records.length === 0) return null;

      const values: number[] = [];
      for (const record of result.records) {
        if (record.samples) {
          for (const sample of record.samples) {
            if (sample.beatsPerMinute) values.push(sample.beatsPerMinute);
          }
        }
      }
      if (values.length === 0) return null;
      return {
        avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
        min: Math.round(Math.min(...values)),
        max: Math.round(Math.max(...values)),
      };
    } catch {
      return null;
    }
  },

  async getSleep(startDate: Date, endDate: Date): Promise<number> {
    const hc = getHC();
    if (!hc) return 0;
    try {
      await hc.initialize();
      const result = await hc.readRecords('SleepSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      });
      if (!result?.records || result.records.length === 0) return 0;

      let totalMs = 0;
      for (const session of result.records) {
        const start = new Date(session.startTime).getTime();
        const end = new Date(session.endTime).getTime();
        totalMs += end - start;
      }
      return Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10;
    } catch {
      return 0;
    }
  },

  async getActiveCalories(startDate: Date, endDate: Date): Promise<number> {
    const hc = getHC();
    if (!hc) return 0;
    try {
      await hc.initialize();
      const result = await hc.readRecords('ActiveCaloriesBurned', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      });
      if (!result?.records) return 0;
      return Math.round(
        result.records.reduce((sum: number, r: any) => sum + (r.energy?.inKilocalories || 0), 0)
      );
    } catch {
      return 0;
    }
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
