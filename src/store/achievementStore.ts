import { create } from 'zustand';
import {
  Achievement,
  getAchievements,
  refreshAchievements,
  getUnlockedCount,
  getTotalCount,
} from '../services/achievements/achievementService';

interface AchievementState {
  achievements: Achievement[];
  unlockedCount: number;
  totalCount: number;
  isLoading: boolean;
  // Achievements that crossed their threshold during the last refresh and
  // haven't been surfaced to the user yet. The Dashboard drains this queue to
  // show a celebratory unlock toast, then calls clearNewlyUnlocked().
  newlyUnlocked: Achievement[];

  loadAchievements: () => Promise<void>;
  refresh: (userId: string) => Promise<void>;
  clearNewlyUnlocked: () => void;
}

export const useAchievementStore = create<AchievementState>((set) => ({
  achievements: [],
  unlockedCount: 0,
  totalCount: getTotalCount(),
  isLoading: false,
  newlyUnlocked: [],

  loadAchievements: async () => {
    set({ isLoading: true });
    try {
      const achievements = await getAchievements();
      set({
        achievements,
        unlockedCount: getUnlockedCount(achievements),
        isLoading: false,
      });
    } catch (e) {
      if (__DEV__) console.warn('Failed to load achievements:', e);
      set({ isLoading: false });
    }
  },

  refresh: async (userId) => {
    set({ isLoading: true });
    try {
      const { achievements, newlyUnlocked } = await refreshAchievements(userId);
      set((state) => ({
        achievements,
        unlockedCount: getUnlockedCount(achievements),
        newlyUnlocked: [...state.newlyUnlocked, ...newlyUnlocked],
        isLoading: false,
      }));
    } catch (e) {
      if (__DEV__) console.warn('Failed to refresh achievements:', e);
      set({ isLoading: false });
    }
  },

  clearNewlyUnlocked: () => set({ newlyUnlocked: [] }),
}));
