import { create } from 'zustand';
import {
  WaterLog,
  getWaterLog,
  upsertWaterLog,
} from '../services/database/progressDao';
import { v4 as uuidv4 } from 'uuid';

interface WaterState {
  todayLog: WaterLog | null;
  isLoading: boolean;

  loadTodayLog: (userId: string, date: string) => Promise<void>;
  addWater: (userId: string, date: string, amountMl: number) => Promise<void>;
  resetWater: (userId: string, date: string) => Promise<void>;
}

function generateId(): string {
  try {
    return uuidv4();
  } catch {
    return `water_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

export const useWaterStore = create<WaterState>((set, get) => ({
  todayLog: null,
  isLoading: false,

  loadTodayLog: async (userId, date) => {
    set({ isLoading: true });
    try {
      const todayLog = await getWaterLog(userId, date);
      set({ todayLog, isLoading: false });
    } catch (e) {
      if (__DEV__) console.warn('Failed to load water log:', e);
      set({ isLoading: false });
    }
  },

  addWater: async (userId, date, amountMl) => {
    const current = get().todayLog;
    const newEntry = { time: Date.now(), amount: amountMl };

    const log: WaterLog = current
      ? {
          ...current,
          totalMl: current.totalMl + amountMl,
          entries: [...current.entries, newEntry],
        }
      : {
          id: generateId(),
          userId,
          date,
          totalMl: amountMl,
          entries: [newEntry],
        };

    await upsertWaterLog(log);
    set({ todayLog: log });
  },

  resetWater: async (userId, date) => {
    const log: WaterLog = {
      id: get().todayLog?.id || generateId(),
      userId,
      date,
      totalMl: 0,
      entries: [],
    };
    await upsertWaterLog(log);
    set({ todayLog: log });
  },
}));
