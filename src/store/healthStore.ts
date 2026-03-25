import { create } from 'zustand';
import {
  HealthSyncConfig,
  HealthDataPoint,
  getHealthSyncConfig,
  saveHealthSyncConfig,
  getHealthData,
  addHealthDataPoint,
  getHealthStats,
} from '../services/health/healthService';

interface HealthState {
  config: HealthSyncConfig;
  todayData: HealthDataPoint[];
  stats: {
    avgSteps: number;
    avgHeartRate: number;
    avgSleep: number;
    avgActiveCalories: number;
    totalEntries: number;
  } | null;
  isLoading: boolean;

  loadConfig: () => Promise<void>;
  updateConfig: (config: HealthSyncConfig) => Promise<void>;
  loadTodayData: (date: string) => Promise<void>;
  addDataPoint: (point: HealthDataPoint) => Promise<void>;
  loadStats: (days: number) => Promise<void>;
}

const DEFAULT_CONFIG: HealthSyncConfig = {
  isConnected: false,
  lastSyncDate: null,
  syncSteps: true,
  syncHeartRate: true,
  syncSleep: true,
  syncCalories: true,
};

export const useHealthStore = create<HealthState>((set) => ({
  config: DEFAULT_CONFIG,
  todayData: [],
  stats: null,
  isLoading: false,

  loadConfig: async () => {
    try {
      const config = await getHealthSyncConfig();
      set({ config });
    } catch (e) {
      console.warn('Failed to load health config:', e);
    }
  },

  updateConfig: async (config) => {
    await saveHealthSyncConfig(config);
    set({ config });
  },

  loadTodayData: async (date) => {
    set({ isLoading: true });
    try {
      const todayData = await getHealthData(date);
      set({ todayData, isLoading: false });
    } catch (e) {
      console.warn('Failed to load today health data:', e);
      set({ isLoading: false });
    }
  },

  addDataPoint: async (point) => {
    await addHealthDataPoint(point);
    set((state) => {
      const idx = state.todayData.findIndex(
        (d) => d.date === point.date && d.type === point.type
      );
      const todayData = [...state.todayData];
      if (idx >= 0) {
        todayData[idx] = point;
      } else {
        todayData.push(point);
      }
      return { todayData };
    });
  },

  loadStats: async (days) => {
    try {
      const stats = await getHealthStats(days);
      set({ stats });
    } catch (e) {
      console.warn('Failed to load health stats:', e);
    }
  },
}));
