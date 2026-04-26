import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Open-consent (açık rıza) state.
 *
 * KVKK (Law 6698) and GDPR both require informed, specific, freely-given,
 * and revocable consent for each data-processing purpose that needs explicit
 * opt-in. This store tracks the FIVE consents that genuinely require
 * explicit opt-in under those laws:
 *
 *   - privacyPolicy / termsOfService: hard requirement to use the app.
 *   - kvkk: local-Turkish aydınlatma + rıza for personal data processing.
 *   - medicalDisclaimerAcknowledged: user confirmed the app is not a medical
 *     device and does not replace a healthcare professional.
 *   - aiDataSharing: opt-in to send prompts/images to Google Gemini (USA) —
 *     KVKK m.9 (international transfer) + m.6 (special category, since
 *     prompts contain health-related text/photos) require explicit consent.
 *
 * Everything else has been moved out of the consent model:
 *   - healthData → handled by OS-level HealthKit / Health Connect prompts.
 *     We don't keep a duplicate consent in-app; the OS already enforces it.
 *   - analytics / crashReports → processed under "legitimate interest"
 *     (GDPR Art. 6(1)(f), KVKK m.5(2)(f)). No in-app toggle; opt-out path
 *     is documented in the privacy policy as an email contact, satisfying
 *     the right-to-object (Art. 21 / m.11) without UI clutter.
 *   - marketing → no marketing infrastructure today. When introduced, a
 *     dedicated opt-in checkbox at the relevant signup form will capture
 *     consent contextually.
 *   - personalizedAds → handled by Google's User Messaging Platform (UMP)
 *     SDK, which delivers a TCF v2.2-compliant form to EU/TR users and
 *     persists the choice in AdMob's own consent storage.
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
  | 'medicalDisclaimerAcknowledged'
  | 'aiDataSharing';

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
