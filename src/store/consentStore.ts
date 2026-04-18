import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Open-consent (açık rıza) state.
 *
 * KVKK (Law 6698) and GDPR both require informed, granular, and revocable
 * opt-in for each distinct data-processing purpose. This store tracks:
 *
 *   - privacyPolicy / termsOfService: hard requirement to use the app at all.
 *   - kvkk: local-Turkish consent for processing personal data.
 *   - aiDataSharing: opt-in to send prompts/images to Gemini (Google) —
 *     this is an international transfer so it must be explicit.
 *   - healthData: consent for HealthKit / Health Connect integration.
 *   - analytics / crashReports: optional telemetry.
 *   - marketing / personalizedAds: optional; AdMob personalization.
 *   - medicalDisclaimerAcknowledged: user confirmed the app is not a medical
 *     device and does not replace a healthcare professional.
 *   - ageVerified: user confirmed >=13 for app, >=18 for supplements/fasting.
 *
 * Every change is timestamped and version-stamped so we can re-prompt when
 * policy changes, and persist an audit trail for legal compliance.
 */

const CONSENT_KEY = 'fittrack_consent_v1';

export const CONSENT_VERSION = 1;

export type ConsentKey =
  | 'privacyPolicy'
  | 'termsOfService'
  | 'kvkk'
  | 'aiDataSharing'
  | 'healthData'
  | 'analytics'
  | 'crashReports'
  | 'marketing'
  | 'personalizedAds'
  | 'medicalDisclaimerAcknowledged';

interface ConsentRecord {
  granted: boolean;
  updatedAt: number;
  version: number;
}

export type ConsentMap = Partial<Record<ConsentKey, ConsentRecord>>;

interface AgeInfo {
  birthYear: number | null;
  age: number | null;
  verifiedAt: number | null;
}

interface ConsentState {
  consents: ConsentMap;
  age: AgeInfo;
  isLoading: boolean;
  loadConsents: () => Promise<void>;
  setConsent: (key: ConsentKey, granted: boolean) => Promise<void>;
  setConsents: (values: Partial<Record<ConsentKey, boolean>>) => Promise<void>;
  setAge: (age: number) => Promise<void>;
  hasGranted: (key: ConsentKey) => boolean;
  hasCompletedInitialConsent: () => boolean;
  clearAll: () => Promise<void>;
}

const REQUIRED_FOR_APP_USE: ConsentKey[] = [
  'privacyPolicy',
  'termsOfService',
  'kvkk',
  'medicalDisclaimerAcknowledged',
];

export const useConsentStore = create<ConsentState>((set, get) => ({
  consents: {},
  age: { birthYear: null, age: null, verifiedAt: null },
  isLoading: true,

  loadConsents: async () => {
    try {
      const raw = await AsyncStorage.getItem(CONSENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({
          consents: (parsed?.consents || {}) as ConsentMap,
          age: parsed?.age || { birthYear: null, age: null, verifiedAt: null },
          isLoading: false,
        });
        return;
      }
      set({ isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setConsent: async (key, granted) => {
    const consents = {
      ...get().consents,
      [key]: { granted, updatedAt: Date.now(), version: CONSENT_VERSION },
    };
    set({ consents });
    try {
      await AsyncStorage.setItem(
        CONSENT_KEY,
        JSON.stringify({ consents, age: get().age })
      );
    } catch {}
  },

  setConsents: async (values) => {
    const now = Date.now();
    const merged = { ...get().consents };
    for (const k of Object.keys(values) as ConsentKey[]) {
      const v = values[k];
      if (typeof v === 'boolean') {
        merged[k] = { granted: v, updatedAt: now, version: CONSENT_VERSION };
      }
    }
    set({ consents: merged });
    try {
      await AsyncStorage.setItem(
        CONSENT_KEY,
        JSON.stringify({ consents: merged, age: get().age })
      );
    } catch {}
  },

  setAge: async (age) => {
    const birthYear = new Date().getFullYear() - age;
    const ageInfo: AgeInfo = { birthYear, age, verifiedAt: Date.now() };
    set({ age: ageInfo });
    try {
      await AsyncStorage.setItem(
        CONSENT_KEY,
        JSON.stringify({ consents: get().consents, age: ageInfo })
      );
    } catch {}
  },

  hasGranted: (key) => {
    const rec = get().consents[key];
    return !!rec?.granted && rec.version === CONSENT_VERSION;
  },

  hasCompletedInitialConsent: () => {
    const c = get().consents;
    return REQUIRED_FOR_APP_USE.every(
      (k) => c[k]?.granted === true && c[k]?.version === CONSENT_VERSION
    );
  },

  clearAll: async () => {
    set({ consents: {}, age: { birthYear: null, age: null, verifiedAt: null } });
    try { await AsyncStorage.removeItem(CONSENT_KEY); } catch {}
  },
}));

// ── Age helpers ──────────────────────────────────────
export const MIN_APP_AGE = 13;
export const MIN_ADULT_FEATURE_AGE = 18;

export function isMinor(age: number | null): boolean {
  return age == null ? true : age < MIN_ADULT_FEATURE_AGE;
}

export function isUnderMinAge(age: number | null): boolean {
  return age == null ? true : age < MIN_APP_AGE;
}
