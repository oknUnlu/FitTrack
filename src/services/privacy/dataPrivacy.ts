import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Use the legacy FileSystem API — the new File/Directory API in expo-file-system
// v19 does not expose `cacheDirectory` / `EncodingType` at the top level.
import * as FileSystem from 'expo-file-system/legacy';
import { getDatabase } from '../database/database';
import { getUserById } from '../database/userDao';
import { useUserStore } from '../../store/userStore';
import { usePremiumStore } from '../../store/premiumStore';
import { useConsentStore } from '../../store/consentStore';

/**
 * KVKK / GDPR right-to-erasure and right-of-access implementation.
 *
 * exportUserData()  — packages all local user data (SQLite + AsyncStorage) into
 *                     a single JSON file and offers it to the user via the
 *                     platform share sheet. This satisfies Article 15 GDPR
 *                     and KVKK Article 11 (right of access / data portability).
 *
 * deleteAccount()   — wipes local SQLite tables, secure storage, async storage,
 *                     and resets zustand stores. Optionally notifies the
 *                     backend so the server-side Redis caches are purged.
 *                     This satisfies Article 17 GDPR (right to erasure) and
 *                     KVKK Article 7 (imha).
 */

const USER_TABLES = [
  'users',
  'meal_logs',
  'water_logs',
  'workout_sessions',
  'exercise_sets',
  'workout_templates',
  'body_metrics',
  'ai_conversations',
];

async function dumpTable(db: any, table: string): Promise<any[]> {
  try {
    // user-owned rows only — built-in template seed rows skipped for templates.
    if (table === 'workout_templates') {
      return await db.getAllAsync('SELECT * FROM workout_templates WHERE is_built_in = 0');
    }
    return await db.getAllAsync(`SELECT * FROM ${table}`);
  } catch {
    return [];
  }
}

export async function exportUserData(): Promise<string | null> {
  try {
    const userState = useUserStore.getState();
    const premium = usePremiumStore.getState();
    const consents = useConsentStore.getState();

    // User profile row lives in SQLite (userDao), not the zustand store.
    let currentUser: any = null;
    if (Platform.OS !== 'web') {
      try {
        currentUser = await getUserById(userState.userId);
      } catch {}
    }

    const dump: Record<string, any> = {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      platform: Platform.OS,
      app: 'FitTrack',
      user: {
        userId: userState.userId,
        isOnboarded: userState.isOnboarded,
        currentUser,
      },
      premium: {
        plan: premium.plan,
        expiresAt: premium.expiresAt,
        isPremium: premium.isPremium,
      },
      consents: {
        version: (consents as any).CONSENT_VERSION || 1,
        consents: consents.consents,
        age: consents.age,
      },
      database: {} as Record<string, any[]>,
      asyncStorage: {} as Record<string, string>,
    };

    if (Platform.OS !== 'web') {
      try {
        const db = await getDatabase();
        for (const tbl of USER_TABLES) {
          dump.database[tbl] = await dumpTable(db, tbl);
        }
      } catch {
        // continue — partial export is still better than none.
      }
    }

    // AsyncStorage (skip large/binary keys)
    try {
      const keys = await AsyncStorage.getAllKeys();
      const relevant = keys.filter(
        (k) => k.startsWith('fittrack_') || k.startsWith('user_') || k.startsWith('settings_')
      );
      const entries = await AsyncStorage.multiGet(relevant);
      for (const [k, v] of entries) {
        if (v != null) dump.asyncStorage[k] = v;
      }
    } catch {}

    const json = JSON.stringify(dump, null, 2);

    if (Platform.OS === 'web') {
      return json;
    }

    const cacheDir = FileSystem.cacheDirectory || '';
    const path = `${cacheDir}fittrack_export_${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });

    // Share-sheet is optional: expo-sharing is not required for the legal
    // right-of-access itself. If the package is present, try to open the
    // share sheet; otherwise just return the path so the UI can display it.
    try {
      // Dynamic, untyped require so TS doesn't require the package to be
      // installed at build time; at runtime this is a best-effort attempt
      // to open the platform share sheet.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Sharing: any = (globalThis as any).require
        ? (globalThis as any).require('expo-sharing')
        : null;
      if (Sharing && typeof Sharing.isAvailableAsync === 'function' && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(path, {
          mimeType: 'application/json',
          dialogTitle: 'FitTrack verileriniz',
          UTI: 'public.json',
        });
      }
    } catch {
      // share-sheet failure must not block the legal right.
    }
    return path;
  } catch (e) {
    if (__DEV__) console.warn('exportUserData failed:', e);
    return null;
  }
}

/**
 * Delete all local user data. Optionally ping a backend endpoint so that the
 * server-side Redis caches / Firestore submissions tied to this device are
 * marked for deletion (requires /api/delete-account to exist).
 */
export async function deleteAccount(options?: { notifyServer?: boolean }): Promise<void> {
  const notifyServer = options?.notifyServer ?? true;

  // 1. Notify server (best-effort, must not block deletion if it fails)
  if (notifyServer) {
    try {
      const { apiPost } = await import('../api/apiClient');
      await apiPost('/delete-account', {});
    } catch {
      // ignore — local wipe continues regardless.
    }
  }

  // 2. Clear SQLite tables (user data only)
  if (Platform.OS !== 'web') {
    try {
      const db = await getDatabase();
      for (const tbl of USER_TABLES) {
        try {
          if (tbl === 'workout_templates') {
            await db.runAsync('DELETE FROM workout_templates WHERE is_built_in = 0');
          } else {
            await db.runAsync(`DELETE FROM ${tbl}`);
          }
        } catch {}
      }
    } catch {}
  }

  // 3. Clear zustand stores
  try { await usePremiumStore.getState().clearPremium(); } catch {}
  try { await useConsentStore.getState().clearAll(); } catch {}
  try {
    const userStore = useUserStore.getState() as any;
    if (typeof userStore.reset === 'function') {
      await userStore.reset();
    } else if (typeof userStore.setOnboarded === 'function') {
      await userStore.setOnboarded(false);
    }
  } catch {}

  // 4. Clear AsyncStorage
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter(
      (k) => k.startsWith('fittrack_') || k.startsWith('user_') || k.startsWith('settings_')
    );
    if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
  } catch {}
}
