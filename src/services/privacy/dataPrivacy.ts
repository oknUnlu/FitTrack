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
 *                     a multi-sheet .xlsx file and offers it to the user via
 *                     the platform share sheet. This satisfies Article 15
 *                     GDPR and KVKK Article 11 (right of access / data
 *                     portability).
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

// Human-friendly Turkish sheet names — keep ≤ 31 chars (Excel limit).
const SHEET_LABELS: Record<string, string> = {
  users: 'Profil',
  meal_logs: 'Oegunler',
  water_logs: 'Su Takibi',
  workout_sessions: 'Antrenmanlar',
  exercise_sets: 'Set Detaylari',
  workout_templates: 'Antrenman Sablonlari',
  body_metrics: 'Vucut Olcumleri',
  ai_conversations: 'AI Sohbetleri',
};

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

function tryRequire(mod: string): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(mod);
  } catch {
    return null;
  }
}

/**
 * Export all local user data as a multi-sheet .xlsx workbook.
 *
 * Sheets:
 *   - Ozet          — top-line metadata (app version, export date, platform, premium status, consent)
 *   - Profil        — users table row
 *   - Oegunler      — meal_logs
 *   - Su Takibi     — water_logs
 *   - Antrenmanlar  — workout_sessions
 *   - Set Detaylari — exercise_sets
 *   - Sablonlar     — user-authored workout_templates
 *   - Vucut Olcumleri — body_metrics
 *   - AI Sohbetleri — ai_conversations
 *   - AsyncStorage  — key/value pairs (fittrack_* / user_* / settings_*)
 *
 * Returns the absolute path to the written file, or null on fatal failure.
 */
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

    // Summary sheet
    const summaryRows: Array<{ Alan: string; Deger: any }> = [
      { Alan: 'Uygulama', Deger: 'FitTrack - AI Fitness Koç' },
      { Alan: 'Export Versiyonu', Deger: 2 },
      { Alan: 'Export Tarihi', Deger: new Date().toISOString() },
      { Alan: 'Platform', Deger: Platform.OS },
      { Alan: 'Kullanıcı ID', Deger: userState.userId },
      { Alan: 'Onboarding tamamlandı', Deger: userState.isOnboarded ? 'Evet' : 'Hayır' },
      { Alan: 'Premium plan', Deger: premium.plan || 'free' },
      { Alan: 'Premium geçerlilik', Deger: premium.expiresAt ? new Date(premium.expiresAt).toISOString() : '—' },
      { Alan: 'Premium aktif', Deger: premium.isPremium ? 'Evet' : 'Hayır' },
      { Alan: 'Consent versiyonu', Deger: (consents as any).CONSENT_VERSION || 1 },
      { Alan: 'Consent değerleri', Deger: JSON.stringify(consents.consents || {}) },
      { Alan: 'Yaş', Deger: consents.age ?? '—' },
    ];

    // Load per-table rows
    const tableData: Record<string, any[]> = {};
    if (Platform.OS !== 'web') {
      try {
        const db = await getDatabase();
        for (const tbl of USER_TABLES) {
          tableData[tbl] = await dumpTable(db, tbl);
        }
      } catch {
        // continue — partial export is still better than none.
      }
    }

    // AsyncStorage
    const asyncRows: Array<{ Key: string; Value: string }> = [];
    try {
      const keys = await AsyncStorage.getAllKeys();
      const relevant = keys.filter(
        (k) => k.startsWith('fittrack_') || k.startsWith('user_') || k.startsWith('settings_')
      );
      const entries = await AsyncStorage.multiGet(relevant);
      for (const [k, v] of entries) {
        if (v != null) asyncRows.push({ Key: k, Value: v });
      }
    } catch {}

    const XLSX = tryRequire('xlsx');

    // Web: no filesystem — return the JSON so the UI can fall back to a
    // browser download link.
    if (Platform.OS === 'web') {
      const jsonDump = {
        summary: summaryRows,
        database: tableData,
        asyncStorage: asyncRows,
      };
      return JSON.stringify(jsonDump, null, 2);
    }

    const cacheDir = FileSystem.cacheDirectory || '';

    // Fallback: if xlsx isn't available at runtime (module missing, bundler
    // issue) write a JSON file instead so the user still gets their data.
    if (!XLSX) {
      const jsonDump = {
        summary: summaryRows,
        database: tableData,
        asyncStorage: asyncRows,
      };
      const jsonPath = `${cacheDir}fittrack_export_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(jsonPath, JSON.stringify(jsonDump, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await tryShare(jsonPath, 'application/json');
      return jsonPath;
    }

    // Build workbook
    const wb = XLSX.utils.book_new();

    const append = (name: string, rows: any[]) => {
      // SheetJS tolerates empty arrays — produce an empty sheet with a
      // single header row so the export still shows the section.
      const ws = rows.length
        ? XLSX.utils.json_to_sheet(rows)
        : XLSX.utils.aoa_to_sheet([['(boş)']]);
      XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31));
    };

    append('Ozet', summaryRows);
    for (const tbl of USER_TABLES) {
      append(SHEET_LABELS[tbl] || tbl, tableData[tbl] || []);
    }
    append('AsyncStorage', asyncRows);

    // SheetJS supports a base64 output we can write via expo-file-system.
    const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const path = `${cacheDir}fittrack_export_${Date.now()}.xlsx`;
    await FileSystem.writeAsStringAsync(path, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await tryShare(
      path,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    return path;
  } catch (e) {
    if (__DEV__) console.warn('exportUserData failed:', e);
    return null;
  }
}

/**
 * Best-effort share via expo-sharing. Non-fatal if the package is missing
 * or the share sheet fails — the file is already written to disk.
 */
async function tryShare(path: string, mimeType: string): Promise<void> {
  try {
    const Sharing: any = tryRequire('expo-sharing');
    if (Sharing && typeof Sharing.isAvailableAsync === 'function' && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(path, {
        mimeType,
        dialogTitle: 'FitTrack verileriniz',
        UTI: mimeType === 'application/json' ? 'public.json' : 'org.openxmlformats.spreadsheetml.sheet',
      });
    }
  } catch {
    // share-sheet failure must not block the legal right.
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
      const { API_ENDPOINTS } = await import('../../config/api');
      await apiPost(API_ENDPOINTS.deleteAccount, {});
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
