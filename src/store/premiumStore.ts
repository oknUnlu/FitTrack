import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Premium subscription state.
 *
 * Hardened storage:
 *   - Persisted in expo-secure-store (Android Keystore / iOS Keychain) instead
 *     of AsyncStorage, so it is encrypted at rest and tied to the app.
 *   - Legacy records stored in plain AsyncStorage are migrated once and then
 *     wiped so a rooted device that already had the old format can't keep
 *     exploiting it.
 *   - Web falls back to AsyncStorage (SecureStore is unavailable there).
 *
 * The server (Redis, populated by /api/verify-purchase and /api/promo) is the
 * source of truth. Local state is only a cache — gated features should still
 * re-check with the server periodically.
 */

const PREMIUM_KEY = 'fittrack_premium_v2';
const TRIAL_KEY = 'fittrack_trial_v2';
const REFERRAL_REWARD_KEY = 'fittrack_referral_reward_until_v2';

// Legacy keys that existed in AsyncStorage — migrate + wipe once.
const LEGACY_PREMIUM_KEY = 'fittrack_premium';
const LEGACY_TRIAL_KEY = 'fittrack_trial';
const LEGACY_REFERRAL_KEY = 'fittrack_referral_reward_until';

export type PremiumPlan = 'free' | 'monthly' | 'quarterly' | 'yearly' | 'trial' | 'referral' | 'promo';

const VALID_PLANS: readonly PremiumPlan[] = [
  'free', 'monthly', 'quarterly', 'yearly', 'trial', 'referral', 'promo',
];

function sanitizePlan(plan: unknown): PremiumPlan {
  return VALID_PLANS.includes(plan as PremiumPlan) ? (plan as PremiumPlan) : 'free';
}

// ── Storage shim ─────────────────────────────────────
// Native: SecureStore (Keystore/Keychain, encrypted at rest).
// Web: AsyncStorage (SecureStore is not supported on web).
const useSecureStore = Platform.OS !== 'web';

const storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (useSecureStore) {
        const v = await SecureStore.getItemAsync(key);
        return v ?? null;
      }
      return (await AsyncStorage.getItem(key)) ?? null;
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      if (useSecureStore) {
        await SecureStore.setItemAsync(key, value);
        return;
      }
      await AsyncStorage.setItem(key, value);
    } catch {
      // Best-effort; failure here should not crash the app.
    }
  },
  async remove(key: string): Promise<void> {
    try {
      if (useSecureStore) {
        await SecureStore.deleteItemAsync(key);
      }
    } catch {}
    try { await AsyncStorage.removeItem(key); } catch {}
  },
};

// ── Legacy migration: move old AsyncStorage records into SecureStore ──
async function migrateLegacy(): Promise<void> {
  try {
    const legacyPremium = await AsyncStorage.getItem(LEGACY_PREMIUM_KEY);
    if (legacyPremium) {
      try {
        const parsed = JSON.parse(legacyPremium);
        const plan = sanitizePlan(parsed?.plan);
        const expiresAt = typeof parsed?.expiresAt === 'number' ? parsed.expiresAt : null;
        if (plan !== 'free' && (!expiresAt || expiresAt > Date.now())) {
          await storage.set(PREMIUM_KEY, JSON.stringify({ plan, expiresAt }));
        }
      } catch {}
      await AsyncStorage.removeItem(LEGACY_PREMIUM_KEY);
    }

    const legacyTrial = await AsyncStorage.getItem(LEGACY_TRIAL_KEY);
    if (legacyTrial) {
      try {
        const parsed = JSON.parse(legacyTrial);
        const expiresAt = typeof parsed?.expiresAt === 'number' ? parsed.expiresAt : 0;
        if (expiresAt > Date.now()) {
          await storage.set(TRIAL_KEY, JSON.stringify({ expiresAt }));
        }
      } catch {}
      await AsyncStorage.removeItem(LEGACY_TRIAL_KEY);
    }

    const legacyReferral = await AsyncStorage.getItem(LEGACY_REFERRAL_KEY);
    if (legacyReferral) {
      const expiry = new Date(legacyReferral).getTime();
      if (Number.isFinite(expiry) && expiry > Date.now()) {
        await storage.set(REFERRAL_REWARD_KEY, JSON.stringify({ expiresAt: expiry }));
      }
      await AsyncStorage.removeItem(LEGACY_REFERRAL_KEY);
    }
  } catch {
    // Best-effort migration.
  }
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
      await migrateLegacy();

      // 1. Paid subscription
      const stored = await storage.get(PREMIUM_KEY);
      if (stored) {
        try {
          const data = JSON.parse(stored);
          const plan = sanitizePlan(data?.plan);
          const expiresAt = typeof data?.expiresAt === 'number' ? data.expiresAt : null;
          if (expiresAt && expiresAt < Date.now()) {
            await storage.remove(PREMIUM_KEY);
          } else if (plan !== 'free') {
            set({ isPremium: true, plan, expiresAt, isLoading: false });
            return;
          } else {
            await storage.remove(PREMIUM_KEY);
          }
        } catch {
          await storage.remove(PREMIUM_KEY);
        }
      }

      // 2. Trial
      const trial = await storage.get(TRIAL_KEY);
      if (trial) {
        try {
          const trialData = JSON.parse(trial);
          const expiresAt = typeof trialData?.expiresAt === 'number' ? trialData.expiresAt : 0;
          if (expiresAt > Date.now()) {
            set({ isPremium: true, plan: 'trial', expiresAt, isLoading: false });
            return;
          }
          await storage.remove(TRIAL_KEY);
        } catch {
          await storage.remove(TRIAL_KEY);
        }
      }

      // 3. Referral reward
      const referral = await storage.get(REFERRAL_REWARD_KEY);
      if (referral) {
        try {
          const data = JSON.parse(referral);
          const expiry = typeof data?.expiresAt === 'number' ? data.expiresAt : 0;
          if (Number.isFinite(expiry) && expiry > Date.now()) {
            set({ isPremium: true, plan: 'referral', expiresAt: expiry, isLoading: false });
            return;
          }
          await storage.remove(REFERRAL_REWARD_KEY);
        } catch {
          await storage.remove(REFERRAL_REWARD_KEY);
        }
      }

      set({ isPremium: false, plan: 'free', expiresAt: null, isLoading: false });
    } catch {
      set({ isPremium: false, plan: 'free', expiresAt: null, isLoading: false });
    }
  },

  setPremium: async (plan, expiresAt = null) => {
    const safePlan = sanitizePlan(plan);
    const payload = { plan: safePlan, expiresAt };
    await storage.set(PREMIUM_KEY, JSON.stringify(payload));
    set({ isPremium: safePlan !== 'free', plan: safePlan, expiresAt });
  },

  clearPremium: async () => {
    await storage.remove(PREMIUM_KEY);
    await storage.remove(TRIAL_KEY);
    await storage.remove(REFERRAL_REWARD_KEY);
    set({ isPremium: false, plan: 'free', expiresAt: null });
  },

  startTrial: async (durationDays = 3) => {
    const expiresAt = Date.now() + durationDays * 24 * 60 * 60 * 1000;
    await storage.set(TRIAL_KEY, JSON.stringify({ expiresAt }));
    set({ isPremium: true, plan: 'trial', expiresAt });
  },

  checkReferralReward: async () => {
    try {
      const stored = await storage.get(REFERRAL_REWARD_KEY);
      if (!stored) return false;
      const data = JSON.parse(stored);
      const expiry = typeof data?.expiresAt === 'number' ? data.expiresAt : 0;
      if (Number.isFinite(expiry) && expiry > Date.now()) {
        set({ isPremium: true, plan: 'referral', expiresAt: expiry });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
}));
