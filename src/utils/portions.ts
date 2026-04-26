import type { FoodItem, FoodPortion } from '../services/database/foodDao';

/**
 * Portion picker — turns a FoodItem into a list of household-measure quick
 * picks for the quantity dialog. The fallback ladder is:
 *
 *   1. Curated `food.commonPortions` (Firestore seed) — wins if non-empty.
 *   2. Category-based defaults (this file) — derived from `food.category`
 *      so a soup gets bowls, a beverage gets glasses, bread gets slices.
 *   3. Generic portion-multiplier fallback — uses `food.servingSize` as the
 *      "1 porsiyon" anchor and offers ½×, 1×, 2×, 3×.
 *
 * Labels are resolved through an i18n bundle so the chips localise. Bundle
 * lookup is opt-in (stored under `calorie.portions.*`); when a translation
 * is missing we fall back to the Turkish source string, since Türkiye is
 * the primary market.
 */

export interface ResolvedPortion {
  /** Human label shown on the chip, already localised. */
  label: string;
  /**
   * Effective amount in the food's base unit (grams for solids, ml for
   * liquids — both stored in the same field because the per-100 macro math
   * is unit-agnostic).
   */
  grams: number;
}

// ── Preset key catalogue ────────────────────────────────────────────────
// Each key maps to a default Turkish label + (for some) a fixed gram value.
// The fixed grams are used when the preset is selected category-wide; when
// a preset is a multiplier (½ porsiyon), grams are computed at runtime.

type FixedPreset = { key: string; grams: number };
type MultiplierPreset = { key: string; multiplier: number };

const BEVERAGE_PRESETS: FixedPreset[] = [
  { key: 'small_glass', grams: 200 },
  { key: 'large_glass', grams: 300 },
  { key: 'bottle_500ml', grams: 500 },
  { key: 'bottle_1l', grams: 1000 },
];

const SOUP_PRESETS: FixedPreset[] = [
  { key: 'half_bowl', grams: 125 },
  { key: 'bowl', grams: 250 },
  { key: 'large_bowl', grams: 400 },
  { key: 'two_bowls', grams: 500 },
];

const BREAD_PRESETS: FixedPreset[] = [
  { key: 'slice', grams: 30 },
  { key: 'two_slices', grams: 60 },
  { key: 'three_slices', grams: 90 },
];

const CONDIMENT_PRESETS: FixedPreset[] = [
  { key: 'tea_spoon', grams: 5 },
  { key: 'table_spoon', grams: 15 },
  { key: 'two_table_spoons', grams: 30 },
];

const FRUIT_PRESETS: FixedPreset[] = [
  { key: 'small_piece', grams: 100 },
  { key: 'medium_piece', grams: 150 },
  { key: 'large_piece', grams: 200 },
];

const SNACK_PRESETS: FixedPreset[] = [
  { key: 'small_handful', grams: 30 },
  { key: 'one_handful', grams: 50 },
  { key: 'one_package', grams: 100 },
];

// Generic multipliers used when no category match — anchored to the food's
// own `servingSize` so "1 porsiyon" actually means what the food says it
// means (e.g. 200 g for pilav, 120 g for pizza, etc.).
const PORTION_MULTIPLIERS: MultiplierPreset[] = [
  { key: 'half_portion', multiplier: 0.5 },
  { key: 'one_portion', multiplier: 1 },
  { key: 'two_portions', multiplier: 2 },
  { key: 'three_portions', multiplier: 3 },
];

const CATEGORY_TABLE: Record<string, FixedPreset[]> = {
  beverage: BEVERAGE_PRESETS,
  drink: BEVERAGE_PRESETS,
  soup: SOUP_PRESETS,
  bread: BREAD_PRESETS,
  bakery: BREAD_PRESETS,
  condiment: CONDIMENT_PRESETS,
  sauce: CONDIMENT_PRESETS,
  fruit: FRUIT_PRESETS,
  snack: SNACK_PRESETS,
  candy: SNACK_PRESETS,
};

// Default Turkish labels — used when the i18n bundle has no override. Kept
// in this file (rather than tr.ts) because the utility may run in contexts
// where the i18n module isn't loaded (e.g. unit tests).
const DEFAULT_LABELS: Record<string, string> = {
  half_slice: '½ dilim',
  slice: '1 dilim',
  two_slices: '2 dilim',
  three_slices: '3 dilim',
  whole: 'Tamamı',
  small_glass: 'Küçük bardak',
  large_glass: 'Büyük bardak',
  bottle_500ml: '1 şişe (500ml)',
  bottle_1l: '1 L şişe',
  half_bowl: '½ kase',
  bowl: '1 kase',
  large_bowl: '1 büyük kase',
  two_bowls: '2 kase',
  tea_spoon: '1 çay kaşığı',
  table_spoon: '1 yemek kaşığı',
  two_table_spoons: '2 yemek kaşığı',
  small_handful: '1 küçük avuç',
  one_handful: '1 avuç',
  one_package: '1 paket',
  small_piece: '1 küçük',
  medium_piece: '1 orta',
  large_piece: '1 büyük',
  half_portion: '½ porsiyon',
  one_portion: '1 porsiyon',
  two_portions: '2 porsiyon',
  three_portions: '3 porsiyon',
};

/**
 * Looks up a preset key in the i18n bundle. Returns the localised string if
 * the bundle has an entry under `calorie.portions.<key>`, otherwise the
 * default Turkish label, otherwise the key itself (which should never
 * happen for known keys).
 */
function localiseKey(key: string, t: any): string {
  const fromBundle = t?.calorie?.portions?.[key];
  if (typeof fromBundle === 'string' && fromBundle.length > 0) return fromBundle;
  return DEFAULT_LABELS[key] || key;
}

/**
 * Build the chip list shown in the quantity dialog. Caller passes the food
 * and the active i18n bundle; the returned array is ordered from smallest
 * to largest amount and is safe to render directly.
 */
export function getPortionPresets(food: FoodItem, t: any): ResolvedPortion[] {
  // 1. Curated portions win. The Firestore seed ships labels already
  //    localised (Turkish), so we pass them through unchanged. Filter out
  //    malformed entries defensively — a NaN here would corrupt the meal log.
  if (food.commonPortions && food.commonPortions.length > 0) {
    const cleaned: ResolvedPortion[] = food.commonPortions
      .filter((p): p is FoodPortion => !!p && typeof p.label === 'string' && Number.isFinite(p.grams) && p.grams > 0)
      .map((p) => ({ label: p.label, grams: Math.round(p.grams) }));
    if (cleaned.length > 0) return cleaned;
  }

  // 2. Category-based fixed presets (bowl, glass, slice, ...).
  const categoryKey = (food.category || '').toLowerCase();
  const fixed = CATEGORY_TABLE[categoryKey];
  if (fixed) {
    return fixed.map((p) => ({ label: localiseKey(p.key, t), grams: p.grams }));
  }

  // 3. Multiplier fallback anchored to the food's serving size. If the food
  //    has no sensible serving size (0 or missing), use 100 g so the math
  //    still produces something the user can adjust.
  const anchor = food.servingSize && food.servingSize > 0 ? food.servingSize : 100;
  return PORTION_MULTIPLIERS.map((p) => ({
    label: localiseKey(p.key, t),
    grams: Math.round(anchor * p.multiplier),
  }));
}

/**
 * Pick the preset that best matches the food's stated serving size — the
 * dialog opens with this preset preselected so the user can confirm with
 * a single tap when the default is right.
 *
 * Strategy: smallest absolute gram delta. Ties go to the earlier entry
 * (typically the smaller portion), which mirrors how users tend to
 * under-estimate by default.
 */
export function pickDefaultPreset(presets: ResolvedPortion[], servingSize: number): number {
  if (presets.length === 0) return -1;
  const target = servingSize > 0 ? servingSize : 100;
  let bestIdx = 0;
  let bestDelta = Math.abs(presets[0].grams - target);
  for (let i = 1; i < presets.length; i++) {
    const delta = Math.abs(presets[i].grams - target);
    if (delta < bestDelta) {
      bestIdx = i;
      bestDelta = delta;
    }
  }
  return bestIdx;
}
