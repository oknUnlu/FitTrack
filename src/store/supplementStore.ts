import { create } from 'zustand';
import {
  Supplement,
  SupplementLog,
  getSupplements,
  addSupplement,
  removeSupplement,
  getSupplementLogs,
  toggleSupplementLog,
} from '../services/supplements/supplementService';

interface SupplementState {
  supplements: Supplement[];
  todayLogs: SupplementLog[];
  isLoading: boolean;

  loadSupplements: () => Promise<void>;
  loadTodayLogs: (date: string) => Promise<void>;
  addNewSupplement: (supplement: Supplement) => Promise<void>;
  deleteSupplement: (id: string) => Promise<void>;
  toggleLog: (supplementId: string, date: string) => Promise<void>;
}

export const useSupplementStore = create<SupplementState>((set) => ({
  supplements: [],
  todayLogs: [],
  isLoading: false,

  loadSupplements: async () => {
    set({ isLoading: true });
    try {
      const supplements = await getSupplements();
      set({ supplements, isLoading: false });
    } catch (e) {
      console.warn('Failed to load supplements:', e);
      set({ isLoading: false });
    }
  },

  loadTodayLogs: async (date) => {
    try {
      const todayLogs = await getSupplementLogs(date);
      set({ todayLogs });
    } catch (e) {
      console.warn('Failed to load supplement logs:', e);
    }
  },

  addNewSupplement: async (supplement) => {
    await addSupplement(supplement);
    set((state) => ({
      supplements: [...state.supplements, supplement],
    }));
  },

  deleteSupplement: async (id) => {
    await removeSupplement(id);
    set((state) => ({
      supplements: state.supplements.filter((s) => s.id !== id),
    }));
  },

  toggleLog: async (supplementId, date) => {
    await toggleSupplementLog(supplementId, date);
    const todayLogs = await getSupplementLogs(date);
    set({ todayLogs });
  },
}));
