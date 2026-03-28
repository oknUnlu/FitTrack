import { create } from 'zustand';
import {
  BodyMetric,
  getLatestMetric,
  getAllMetrics,
  getMetricsByRange,
  insertMetric,
} from '../services/database/progressDao';

interface ProgressState {
  metrics: BodyMetric[];
  latestMetric: BodyMetric | null;
  isLoading: boolean;

  loadAllMetrics: (userId: string) => Promise<void>;
  loadLatestMetric: (userId: string) => Promise<void>;
  loadMetricsByRange: (userId: string, start: string, end: string) => Promise<void>;
  saveMetric: (metric: BodyMetric) => Promise<void>;
}

export const useProgressStore = create<ProgressState>((set) => ({
  metrics: [],
  latestMetric: null,
  isLoading: false,

  loadAllMetrics: async (userId) => {
    set({ isLoading: true });
    try {
      const metrics = await getAllMetrics(userId);
      set({ metrics, latestMetric: metrics[0] || null, isLoading: false });
    } catch (e) {
      if (__DEV__) console.warn('Failed to load metrics:', e);
      set({ isLoading: false });
    }
  },

  loadLatestMetric: async (userId) => {
    try {
      const latestMetric = await getLatestMetric(userId);
      set({ latestMetric });
    } catch (e) {
      if (__DEV__) console.warn('Failed to load latest metric:', e);
    }
  },

  loadMetricsByRange: async (userId, start, end) => {
    set({ isLoading: true });
    try {
      const metrics = await getMetricsByRange(userId, start, end);
      set({ metrics, isLoading: false });
    } catch (e) {
      if (__DEV__) console.warn('Failed to load metrics by range:', e);
      set({ isLoading: false });
    }
  },

  saveMetric: async (metric) => {
    await insertMetric(metric);
    set((state) => {
      const idx = state.metrics.findIndex((m) => m.id === metric.id);
      const metrics = [...state.metrics];
      if (idx >= 0) {
        metrics[idx] = metric;
      } else {
        metrics.unshift(metric);
      }
      return { metrics, latestMetric: metrics[0] || null };
    });
  },
}));
