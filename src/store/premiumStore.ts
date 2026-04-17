import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREMIUM_KEY = 'fittrack_premium';
const TRIAL_KEY = 'fittrack_trial';
const REFERRAL_REWARD_KEY = 'fittrack_referral_reward_until';

export type PremiumPlan = 'free' | 'monthly' | 'quarterly' | 'yearly' | 'trial' | 'referral' | 'promo';

const VALID_PLANS: readonly PremiumPlan[] = ['free', 'monthly', 'quarterly', 'yearly', 'trial', 'referral', 'promo'];

function sanitizePlan(plan: unknown): PremiumPlan {
  return VALID_PLANS.includes(plan as PremiumPlan) ? (plan as PremiumPlan) : 'free';
}

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
        try {
          const data = JSON.parse(stored);
          const plan = sanitizePlan(data?.plan);
          const expiresAt = typeof data?.expiresAt === 'number' ? data.expiresAt : null;
          if (expiresAt && expiresAt < Date.now()) {
            await AsyncStorage.removeItem(PREMIUM_KEY);
          } else if (plan !== 'free') {
            set({ isPremium: true, plan, expiresAt, isLoading: false });
            return;
          } else {
            await AsyncStorage.removeItem(PREMIUM_KEY);
          }
        } catch {
          await AsyncStorage.removeItem(PREMIUM_KEY);
        }
      }

      // Check trial
      const trial = await AsyncStorage.getItem(TRIAL_KEY);
      if (trial) {
        try {
          const trialData = JSON.parse(trial);
          const expiresAt = typeof trialData?.expiresAt === 'number' ? trialData.expiresAt : 0;
          if (expiresAt > Date.now()) {
            set({ isPremium: true, plan: 'trial', expiresAt, isLoading: false });
            return;
          }
        } catch {
          await AsyncStorage.removeItem(TRIAL_KEY);
        }
      }

      // Check referral reward
      const referralReward = await AsyncStorage.getItem(REFERRAL_REWARD_KEY);
      if (referralReward) {
        const expiry = new Date(referralReward).getTime();
        if (Number.isFinite(expiry) && expiry > Date.now()) {
          set({ isPremium: true, plan: 'referral', expiresAt: expiry, isLoading: false });
          return;
        }
      }

      set({ isPremium: false, plan: 'free', expiresAt: null, isLoading: false });
    } catch {
      set({ isPremium: false, plan: 'free', expiresAt: null, isLoading: false });
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
