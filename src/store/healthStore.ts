import { create } from 'zustand';
import {
  HealthSyncConfig,
  HealthDataPoint,
  getHealthSyncConfig,
  saveHealthSyncConfig,
  getHealthData,
  addHealthDataPoint,
  getHealthStats,
  isNativeHealthAvailable,
  connectNativeHealth,
  disconnectNativeHealth,
  syncFromNativeHealth,
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
  isSyncing: boolean;
  isNativeAvailable: boolean;
  connectionError: string | null;

  loadConfig: () => Promise<void>;
  updateConfig: (config: HealthSyncConfig) => Promise<void>;
  loadTodayData: (date: string) => Promise<void>;
  addDataPoint: (point: HealthDataPoint) => Promise<void>;
  loadStats: (days: number) => Promise<void>;
  checkNativeAvailability: () => Promise<void>;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  syncNative: () => Promise<void>;
}

const DEFAULT_CONFIG: HealthSyncConfig = {
  isConnected: false,
  lastSyncDate: null,
  syncSteps: true,
  syncHeartRate: true,
  syncSleep: true,
  syncCalories: true,
};

export const useHealthStore = create<HealthState>((set, get) => ({
  config: DEFAULT_CONFIG,
  todayData: [],
  stats: null,
  isLoading: false,
  isSyncing: false,
  isNativeAvailable: false,
  connectionError: null,

  loadConfig: async () => {
    try {
      const config = await getHealthSyncConfig();
      set({ config });
    } catch (e) {
      if (__DEV__) console.warn('Failed to load health config:', e);
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
      if (__DEV__) console.warn('Failed to load today health data:', e);
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
      if (__DEV__) console.warn('Failed to load health stats:', e);
    }
  },

  checkNativeAvailability: async () => {
    try {
      const available = await isNativeHealthAvailable();
      set({ isNativeAvailable: available });
    } catch {
      set({ isNativeAvailable: false });
    }
  },

  connect: async () => {
    set({ connectionError: null });
    try {
      const success = await connectNativeHealth();
      if (success) {
        const config = await getHealthSyncConfig();
        set({ config, connectionError: null });
        // Auto-sync after connecting
        await get().syncNative();
        return true;
      } else {
        set({ connectionError: 'permission_denied' });
        return false;
      }
    } catch (e: any) {
      set({ connectionError: e.message || 'connection_failed' });
      return false;
    }
  },

  disconnect: async () => {
    await disconnectNativeHealth();
    const config = await getHealthSyncConfig();
    set({ config, connectionError: null });
  },

  syncNative: async () => {
    const { config } = get();
    if (!config.isConnected) return;

    set({ isSyncing: true });
    try {
      const { synced } = await syncFromNativeHealth();
      if (synced) {
        // Reload today data and config after sync
        const today = new Date().toISOString().slice(0, 10);
        const [todayData, updatedConfig] = await Promise.all([
          getHealthData(today),
          getHealthSyncConfig(),
        ]);
        set({ todayData, config: updatedConfig, isSyncing: false });
      } else {
        set({ isSyncing: false });
      }
    } catch (e) {
      if (__DEV__) console.warn('Native health sync failed:', e);
      set({ isSyncing: false });
    }
  },
}));
