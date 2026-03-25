import { create } from 'zustand';
import {
  WellnessEntry,
  getWellnessEntries,
  addWellnessEntry,
  getWellnessEntryByDate,
  getWellnessStats,
} from '../services/wellness/wellnessService';

interface WellnessState {
  entries: WellnessEntry[];
  todayEntry: WellnessEntry | null;
  stats: {
    avgSleep: number;
    avgStress: number;
    avgEnergy: number;
    avgMeditation: number;
    totalEntries: number;
    moodDistribution: Record<string, number>;
  } | null;
  isLoading: boolean;

  loadEntries: () => Promise<void>;
  loadTodayEntry: (date: string) => Promise<void>;
  saveEntry: (entry: WellnessEntry) => Promise<void>;
  loadStats: (days: number) => Promise<void>;
}

export const useWellnessStore = create<WellnessState>((set) => ({
  entries: [],
  todayEntry: null,
  stats: null,
  isLoading: false,

  loadEntries: async () => {
    set({ isLoading: true });
    try {
      const entries = await getWellnessEntries();
      set({ entries, isLoading: false });
    } catch (e) {
      console.warn('Failed to load wellness entries:', e);
      set({ isLoading: false });
    }
  },

  loadTodayEntry: async (date) => {
    try {
      const todayEntry = await getWellnessEntryByDate(date);
      set({ todayEntry });
    } catch (e) {
      console.warn('Failed to load today wellness entry:', e);
    }
  },

  saveEntry: async (entry) => {
    await addWellnessEntry(entry);
    set((state) => {
      const idx = state.entries.findIndex((e) => e.date === entry.date);
      const entries = [...state.entries];
      if (idx >= 0) {
        entries[idx] = entry;
      } else {
        entries.push(entry);
      }
      return {
        entries,
        todayEntry: entry,
      };
    });
  },

  loadStats: async (days) => {
    try {
      const stats = await getWellnessStats(days);
      set({ stats });
    } catch (e) {
      console.warn('Failed to load wellness stats:', e);
    }
  },
}));
