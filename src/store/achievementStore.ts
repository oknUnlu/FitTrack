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

  loadAchievements: () => Promise<void>;
  refresh: (userId: string) => Promise<void>;
}

export const useAchievementStore = create<AchievementState>((set) => ({
  achievements: [],
  unlockedCount: 0,
  totalCount: getTotalCount(),
  isLoading: false,

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
      const achievements = await refreshAchievements(userId);
      set({
        achievements,
        unlockedCount: getUnlockedCount(achievements),
        isLoading: false,
      });
    } catch (e) {
      if (__DEV__) console.warn('Failed to refresh achievements:', e);
      set({ isLoading: false });
    }
  },
}));
