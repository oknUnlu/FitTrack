import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREMIUM_KEY = 'fittrack_premium';
const TRIAL_KEY = 'fittrack_trial';
const REFERRAL_REWARD_KEY = 'fittrack_referral_reward_until';

export type PremiumPlan = 'free' | 'monthly' | 'quarterly' | 'yearly' | 'trial' | 'referral' | 'promo';

interface PremiumState {
  isPremium: boolean;
  plan: PremiumPlan;
  expiresAt: number | null;
  isLoading: boolean;
  loadPremiumState: () => Promise<void>;
  setPremium: (plan: PremiumPlan, expiresAt?: number | null) => Promise<void>;
  clearPremium: () => Promise<void>;
  startTrial: (durationDays?: number) => Promise<void>;
  checkReferralReward: () => Promise<boolean>;
}

export const usePremiumStore = create<PremiumState>((set) => ({
  isPremium: false,
  plan: 'free',
  expiresAt: null,
  isLoading: true,

  loadPremiumState: async () => {
    try {
      // Check paid subscription
      const stored = await AsyncStorage.getItem(PREMIUM_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.expiresAt && data.expiresAt < Date.now()) {
          await AsyncStorage.removeItem(PREMIUM_KEY);
        } else {
          set({ isPremium: true, plan: data.plan, expiresAt: data.expiresAt, isLoading: false });
          return;
        }
      }

      // Check trial
      const trial = await AsyncStorage.getItem(TRIAL_KEY);
      if (trial) {
        const trialData = JSON.parse(trial);
        if (trialData.expiresAt > Date.now()) {
          set({ isPremium: true, plan: 'trial', expiresAt: trialData.expiresAt, isLoading: false });
          return;
        }
      }

      // Check referral reward
      const referralReward = await AsyncStorage.getItem(REFERRAL_REWARD_KEY);
      if (referralReward) {
        const expiry = new Date(referralReward).getTime();
        if (expiry > Date.now()) {
          set({ isPremium: true, plan: 'referral', expiresAt: expiry, isLoading: false });
          return;
        }
      }

      set({ isPremium: false, plan: 'free', expiresAt: null, isLoading: false });
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
    await AsyncStorage.removeItem(TRIAL_KEY);
    set({ isPremium: false, plan: 'free', expiresAt: null });
  },

  startTrial: async (durationDays = 3) => {
    const expiresAt = Date.now() + durationDays * 24 * 60 * 60 * 1000;
    await AsyncStorage.setItem(TRIAL_KEY, JSON.stringify({ expiresAt }));
    set({ isPremium: true, plan: 'trial', expiresAt });
  },

  checkReferralReward: async () => {
    try {
      const stored = await AsyncStorage.getItem(REFERRAL_REWARD_KEY);
      if (!stored) return false;
      const expiry = new Date(stored).getTime();
      if (expiry > Date.now()) {
        set({ isPremium: true, plan: 'referral', expiresAt: expiry });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
}));
