import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREMIUM_KEY = 'fittrack_premium';

export type PremiumPlan = 'free' | 'monthly' | 'yearly' | 'lifetime';

interface PremiumState {
  isPremium: boolean;
  plan: PremiumPlan;
  expiresAt: number | null;
  isLoading: boolean;
  loadPremiumState: () => Promise<void>;
  setPremium: (plan: PremiumPlan, expiresAt?: number | null) => Promise<void>;
  clearPremium: () => Promise<void>;
}

export const usePremiumStore = create<PremiumState>((set) => ({
  isPremium: false,
  plan: 'free',
  expiresAt: null,
  isLoading: true,

  loadPremiumState: async () => {
    try {
      const stored = await AsyncStorage.getItem(PREMIUM_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        // Check if subscription expired
        if (data.expiresAt && data.expiresAt < Date.now()) {
          await AsyncStorage.removeItem(PREMIUM_KEY);
          set({ isPremium: false, plan: 'free', expiresAt: null, isLoading: false });
        } else {
          set({ isPremium: true, plan: data.plan, expiresAt: data.expiresAt, isLoading: false });
        }
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  setPremium: async (plan, expiresAt = null) => {
    const data = { plan, expiresAt };
    await AsyncStorage.setItem(PREMIUM_KEY, JSON.stringify(data));
    set({ isPremium: true, plan, expiresAt });
  },

  clearPremium: async () => {
    await AsyncStorage.removeItem(PREMIUM_KEY);
    set({ isPremium: false, plan: 'free', expiresAt: null });
  },
}));
