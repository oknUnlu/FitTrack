import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DARK_MODE_KEY = 'fittrack_dark_mode';

interface ThemeState {
  isDarkMode: boolean;
  /** Whether the persisted preference has been loaded yet. UI can avoid a
   * one-frame light→dark flicker by waiting on this if needed. */
  isLoaded: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
  /** Hydrates the store from AsyncStorage. Idempotent — App.tsx calls it
   * once on boot. Safe to call again later (e.g. after a reset). */
  loadDarkMode: () => Promise<void>;
}

/**
 * Theme store.
 *
 * Originally this store kept `isDarkMode` only in memory. That turned every
 * cold start into "back to light mode" no matter what the user picked,
 * which combined with the analogous water-reminder bug to give the
 * impression that "settings don't stick". The store now persists to
 * AsyncStorage with the same fire-and-forget pattern used by the other
 * pref stores (consent, premium): writes are async but UI updates are
 * synchronous.
 */
export const useThemeStore = create<ThemeState>((set, get) => ({
  isDarkMode: false,
  isLoaded: false,

  toggleDarkMode: () => {
    const next = !get().isDarkMode;
    set({ isDarkMode: next });
    AsyncStorage.setItem(DARK_MODE_KEY, JSON.stringify(next)).catch((e) => {
      if (__DEV__) console.warn('themeStore: persist toggle failed:', e);
    });
  },

  setDarkMode: (value) => {
    set({ isDarkMode: value });
    AsyncStorage.setItem(DARK_MODE_KEY, JSON.stringify(value)).catch((e) => {
      if (__DEV__) console.warn('themeStore: persist set failed:', e);
    });
  },

  loadDarkMode: async () => {
    try {
      const raw = await AsyncStorage.getItem(DARK_MODE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'boolean') {
          set({ isDarkMode: parsed, isLoaded: true });
          return;
        }
      }
      set({ isLoaded: true });
    } catch (e) {
      if (__DEV__) console.warn('themeStore: load failed:', e);
      set({ isLoaded: true });
    }
  },
}));
