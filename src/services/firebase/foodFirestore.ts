import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit as fbLimit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { FoodItem, FoodPortion, insertFoodItem } from '../database/foodDao';

/**
 * Cloud food library — an "endless kitchen" hosted in Firestore that the
 * app falls back to when a user's local SQLite search returns nothing.
 *
 * Collection: `food_library`
 * Doc ID: a stable slug (e.g. `lahmacun`, `pizza_margherita`) so updates
 *         are idempotent and seed scripts can overwrite safely.
 * Schema: mirrors FoodItem plus a `search_tokens` array of lowercase
 *         prefix tokens from the Turkish + English names, used with
 *         `array-contains` to do client-side substring queries without
 *         paying for a full-text search index.
 *
 * Critical: every entry MUST have verified per-100g nutrition. The seed
 * script (scripts/seedFoods.js) is the only writer — the app is read-only
 * against this collection.
 */

const FOOD_LIBRARY_COL = 'food_library';

// Negative cache — a query that missed stays missed for 10 minutes so
// slow-typers don't re-hammer Firestore with the same miss every keystroke.
const NEGATIVE_CACHE_TTL_MS = 10 * 60 * 1000;
const negativeQueryCache = new Map<string, number>();

// In-memory positive cache so repeated renders of the same search term
// don't re-fetch. Keyed by `${query}:${limit}` to respect different page sizes.
const positiveQueryCache = new Map<string, { at: number; results: FoodItem[] }>();
const POSITIVE_CACHE_TTL_MS = 5 * 60 * 1000;

export interface CloudFoodDoc {
  id: string;
  name: string;
  name_tr: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  serving_size: number;
  serving_unit: string;
  category: string | null;
  cuisine: string | null;
  source: string; // e.g. 'usda', 'turkomp', 'curated'
  source_ref: string | null; // e.g. USDA FDC ID
  search_tokens: string[];
  verified: boolean;
  updated_at: number;
  /**
   * Hand-curated household-measure presets shown as quick-pick chips in the
   * quantity dialog. Each entry maps a localized label like "1 dilim" or
   * "1 büyük bardak" to the gram/ml value used to compute macros. Optional —
   * foods without curated presets fall back to category-based defaults.
   */
  common_portions?: FoodPortion[] | null;
}

/**
 * Normalize a query into the same token form the seed script uses, so the
 * `array-contains` lookup can match. Must stay in lockstep with the
 * tokenizer in scripts/seedFoods.js.
 */
function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .trim()
    // Strip parentheticals — seed tokens exclude them, so the query
    // normalizer must too. "pizza (ince)" should search for "pizza".
    .replace(/\(.*?\)/g, ' ')
    // Strip Turkish diacritics so "şiş" matches "sis" etc. Matches the
    // seed-script behaviour; otherwise keyboard layout differences would
    // silently break search.
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function docToFoodItem(d: CloudFoodDoc): FoodItem {
  // Filter out malformed portion entries — Firestore is schemaless so a
  // typo in the seed script could otherwise sneak a NaN into the meal log.
  const portions: FoodPortion[] | null = Array.isArray(d.common_portions)
    ? d.common_portions
        .filter(
          (p): p is FoodPortion =>
            !!p && typeof p.label === 'string' && typeof p.grams === 'number' && p.grams > 0
        )
    : null;
  return {
    id: `cloud_${d.id}`,
    name: d.name,
    nameTr: d.name_tr || d.name,
    calories: d.calories,
    protein: d.protein,
    carbs: d.carbs,
    fat: d.fat,
    fiber: d.fiber ?? null,
    sugar: d.sugar ?? null,
    barcode: null,
    servingSize: d.serving_size || 100,
    servingUnit: d.serving_unit || 'g',
    isCustom: false,
    isFavorite: false,
    source: 'cloud',
    category: d.category ?? null,
    commonPortions: portions && portions.length > 0 ? portions : null,
  };
}

/**
 * Search the cloud food library. Intended as a fallback after the local
 * SQLite search returns empty — NOT as the primary search path.
 *
 * Strategy: take the first normalized token of the query (Firestore's
 * array-contains only accepts a single value) and grab up to `limit`
 * matching docs. We then cache positive hits into local SQLite so the
 * next search for the same term will hit the local DB.
 */
export async function searchFoodsInCloud(rawQuery: string, limit = 20): Promise<FoodItem[]> {
  if (!isFirebaseConfigured()) return [];
  const normalized = normalizeToken(rawQuery);
  if (normalized.length < 2) return [];

  const cacheKey = `${normalized}:${limit}`;
  const now = Date.now();

  // Positive cache hit — return immediately.
  const hit = positiveQueryCache.get(cacheKey);
  if (hit && now - hit.at < POSITIVE_CACHE_TTL_MS) {
    return hit.results;
  }

  // Negative cache hit — skip Firestore entirely for this query.
  const miss = negativeQueryCache.get(normalized);
  if (miss && now - miss < NEGATIVE_CACHE_TTL_MS) {
    return [];
  }

  try {
    // Only the first whole-word token is used for array-contains — this
    // plays nicely with the prefix-token index written by the seed script,
    // which emits every prefix of every word (so "la", "lah", "lahm", ...
    // all map to "lahmacun").
    const primaryToken = normalized.split(' ')[0];
    const q = query(
      collection(db, FOOD_LIBRARY_COL),
      where('search_tokens', 'array-contains', primaryToken),
      fbLimit(limit),
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      negativeQueryCache.set(normalized, now);
      return [];
    }

    const results: FoodItem[] = [];
    snapshot.forEach((snap) => {
      const data = snap.data() as CloudFoodDoc;
      // Extra client-side filter — if the query had multiple words (e.g.
      // "domates çorbası"), make sure all of them appear in the token
      // array. Firestore only filtered by the first token.
      const tokens = data.search_tokens || [];
      const words = normalized.split(' ').filter(Boolean);
      const allMatch = words.every((w) => tokens.some((t) => t.startsWith(w)));
      if (!allMatch) return;
      results.push(docToFoodItem(data));
    });

    if (results.length === 0) {
      negativeQueryCache.set(normalized, now);
      return [];
    }

    // Cache results locally — both in-memory for this session and in
    // SQLite so the next search short-circuits on local.
    positiveQueryCache.set(cacheKey, { at: now, results });
    // Fire-and-forget local persistence; we don't want a slow disk write
    // to block the UI update.
    for (const food of results) {
      insertFoodItem(food).catch(() => {});
    }

    return results;
  } catch (e) {
    if (__DEV__) console.warn('searchFoodsInCloud failed:', e);
    return [];
  }
}

/**
 * Direct lookup by cloud food id. Rarely needed — most flows should use
 * `searchFoodsInCloud` — but useful for deep-linking and debugging.
 */
export async function getFoodFromCloud(cloudId: string): Promise<FoodItem | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const snap = await getDoc(doc(db, FOOD_LIBRARY_COL, cloudId));
    if (!snap.exists()) return null;
    const food = docToFoodItem(snap.data() as CloudFoodDoc);
    insertFoodItem(food).catch(() => {});
    return food;
  } catch (e) {
    if (__DEV__) console.warn('getFoodFromCloud failed:', e);
    return null;
  }
}
