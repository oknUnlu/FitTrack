import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDED_KEY = 'fittrack_onboarded';

interface UserState {
  userId: string;
  isOnboarded: boolean;
  isLoading: boolean;
  setUserId: (id: string) => void;
  setOnboarded: (value: boolean) => void;
  resetOnboarding: () => Promise<void>;
  loadOnboardingState: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  userId: 'default_user',
  isOnboarded: false,
  isLoading: true,
  setUserId: (id) => set({ userId: id }),
  setOnboarded: async (value) => {
    try {
      await AsyncStorage.setItem(ONBOARDED_KEY, JSON.stringify(value));
    } catch (e) {
      console.warn('Failed to save onboarding state:', e);
    }
    set({ isOnboarded: value });
  },
  resetOnboarding: async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDED_KEY);
    } catch (e) {
      console.warn('Failed to reset onboarding state:', e);
    }
    set({ isOnboarded: false });
  },
  loadOnboardingState: async () => {
    try {
      const stored = await AsyncStorage.getItem(ONBOARDED_KEY);
      if (stored !== null) {
        set({ isOnboarded: JSON.parse(stored), isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (e) {
      console.warn('Failed to load onboarding state:', e);
      set({ isLoading: false });
    }
  },
}));
