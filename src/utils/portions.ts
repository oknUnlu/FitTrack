import type { FoodItem, FoodPortion } from '../services/database/foodDao';

/**
 * Portion picker — turns a FoodItem into a list of household-measure quick
 * picks for the quantity dialog. The fallback ladder is:
 *
 *   1. Curated `food.commonPortions` (Firestore seed) — wins if non-empty.
 *   2. Category-based defaults (this file) — derived from `food.category`
 *      so a soup gets bowls, a beverage gets glasses, bread gets slices.
 *      When the stored category is missing or unknown (cloud pipelines and
 *      AI-recognized foods often ship `category: null`), the category is
 *      inferred from the food NAME ("… Çorbası" → soup, "… Salatası" →
 *      salad, …) so the right household units still show up.
 *   3. Generic portion-multiplier fallback — uses `food.servingSize` as the
 *      "1 porsiyon" anchor and offers ½×, 1×, 2×, 3×.
 *
 * On top of the category presets, a per-food piece-weight table injects an
 * "Adet" option for foods that are counted by piece but whose category-level
 * piece guesses would be absurd (1 fındık ≈ 1,2 g, not 60 g).
 *
 * Labels are resolved through an i18n bundle so the chips localise. Bundle
 * lookup is opt-in (stored under `calorie.portions.*`); when a translation
 * is missing we fall back to the Turkish source string, since Türkiye is
 * the primary market.
 */

export type UnitType = 'piece' | 'spoon' | 'cup' | 'bowl' | 'slice' | 'handful' | 'portion' | 'gram';

export interface ResolvedPortion {
  /** Human label shown on the chip, already localised. */
  label: string;
  /**
   * Effective amount in the food's base unit (grams for solids, ml for
   * liquids — both stored in the same field because the per-100 macro math
   * is unit-agnostic).
   */
  grams: number;
  /**
   * Optional unit type — used by the UI to group chips into tabs.
   * Absent on legacy curated portions that pre-date this field.
   */
  unitType?: UnitType;
  /**
   * Marks the category's most natural household unit (a soup's medium bowl,
   * a dish's portion). Used as the dialog default when the food's serving
   * size carries no real signal — see `pickDefaultPreset`.
   */
  preferred?: boolean;
}

// ── Preset key catalogue ────────────────────────────────────────────────
// Each key maps to a default Turkish label + (for some) a fixed gram value.
// The fixed grams are used when the preset is selected category-wide; when
// a preset is a multiplier (½ porsiyon), grams are computed at runtime.

type FixedPreset = { key: string; grams: number; unitType: UnitType; preferred?: boolean };
type MultiplierPreset = { key: string; multiplier: number; unitType: UnitType };

const BEVERAGE_PRESETS: FixedPreset[] = [
  { key: 'tea_glass', grams: 150, unitType: 'cup' },
  { key: 'small_glass', grams: 200, unitType: 'cup' },
  { key: 'large_glass', grams: 300, unitType: 'cup' },
  { key: 'bottle_500ml', grams: 500, unitType: 'cup' },
  { key: 'bottle_1l', grams: 1000, unitType: 'cup' },
];

// Presets describe ONE unit per size. Multiples (e.g. "2 kase", "3 dilim")
// are expressed by the count stepper in the quantity dialog, not by separate
// chips — so we only ship single-unit sizes here.
const SOUP_PRESETS: FixedPreset[] = [
  { key: 'ladle', grams: 100, unitType: 'spoon' },
  { key: 'bowl_small', grams: 200, unitType: 'bowl' },
  { key: 'bowl_medium', grams: 300, unitType: 'bowl', preferred: true },
  { key: 'bowl_large', grams: 400, unitType: 'bowl' },
  { key: 'portion_medium', grams: 300, unitType: 'portion' },
  { key: 'plate_full', grams: 350, unitType: 'portion' },
];

const BREAD_PRESETS: FixedPreset[] = [
  { key: 'slice', grams: 30, unitType: 'slice' },
];

const CONDIMENT_PRESETS: FixedPreset[] = [
  { key: 'tea_spoon', grams: 5, unitType: 'spoon' },
  { key: 'table_spoon', grams: 15, unitType: 'spoon' },
];

// Fruits and vegetables support both piece (adet) and gram selection.
const FRUIT_PIECE_PRESETS: FixedPreset[] = [
  { key: 'small_piece_adet', grams: 60, unitType: 'piece' },
  { key: 'medium_piece_adet', grams: 120, unitType: 'piece', preferred: true },
  { key: 'large_piece_adet', grams: 200, unitType: 'piece' },
];

const FRUIT_GRAM_PRESETS: FixedPreset[] = [
  { key: 'gram_50', grams: 50, unitType: 'gram' },
  { key: 'gram_100', grams: 100, unitType: 'gram' },
  { key: 'gram_150', grams: 150, unitType: 'gram' },
  { key: 'gram_200', grams: 200, unitType: 'gram' },
];

const VEGETABLE_PRESETS: FixedPreset[] = [
  { key: 'small_piece_adet', grams: 50, unitType: 'piece' },
  { key: 'medium_piece_adet', grams: 100, unitType: 'piece', preferred: true },
  { key: 'large_piece_adet', grams: 180, unitType: 'piece' },
  { key: 'gram_100', grams: 100, unitType: 'gram' },
  { key: 'gram_200', grams: 200, unitType: 'gram' },
];

const MEAT_PRESETS: FixedPreset[] = [
  { key: 'small_piece_adet', grams: 80, unitType: 'piece' },
  { key: 'medium_piece_adet', grams: 150, unitType: 'piece', preferred: true },
  { key: 'large_piece_adet', grams: 250, unitType: 'piece' },
  { key: 'gram_100', grams: 100, unitType: 'gram' },
  { key: 'gram_200', grams: 200, unitType: 'gram' },
];

const DAIRY_PRESETS: FixedPreset[] = [
  { key: 'tea_spoon', grams: 5, unitType: 'spoon' },
  { key: 'table_spoon', grams: 15, unitType: 'spoon' },
  { key: 'tea_glass', grams: 150, unitType: 'cup' },
  { key: 'small_glass', grams: 200, unitType: 'cup' },
  { key: 'gram_100', grams: 100, unitType: 'gram' },
];

const LEGUME_PRESETS: FixedPreset[] = [
  { key: 'table_spoon', grams: 15, unitType: 'spoon' },
  { key: 'bowl_small', grams: 150, unitType: 'bowl' },
  { key: 'bowl_medium', grams: 250, unitType: 'bowl', preferred: true },
  { key: 'bowl_large', grams: 350, unitType: 'bowl' },
  { key: 'portion_medium', grams: 200, unitType: 'portion' },
];

const GRAIN_PRESETS: FixedPreset[] = [
  { key: 'table_spoon', grams: 15, unitType: 'spoon' },
  { key: 'bowl_small', grams: 100, unitType: 'bowl' },
  { key: 'bowl_medium', grams: 200, unitType: 'bowl', preferred: true },
  { key: 'bowl_large', grams: 350, unitType: 'bowl' },
  { key: 'plate_full', grams: 300, unitType: 'portion' },
];

const EGG_PRESETS: FixedPreset[] = [
  { key: 'small_piece_adet', grams: 45, unitType: 'piece' },
  { key: 'medium_piece_adet', grams: 55, unitType: 'piece' },
  { key: 'large_piece_adet', grams: 65, unitType: 'piece' },
];

const NUT_PRESETS: FixedPreset[] = [
  { key: 'small_handful', grams: 15, unitType: 'handful' },
  { key: 'one_handful', grams: 30, unitType: 'handful' },
  { key: 'gram_50', grams: 50, unitType: 'gram' },
  { key: 'gram_100', grams: 100, unitType: 'gram' },
];

const SNACK_PRESETS: FixedPreset[] = [
  { key: 'small_handful', grams: 30, unitType: 'handful' },
  { key: 'one_handful', grams: 50, unitType: 'handful' },
  { key: 'one_package', grams: 100, unitType: 'portion' },
];

// Desserts are eaten by the piece/slice (baklava dilimi, kek dilimi), not by
// the handful — so they get their own table instead of riding on SNACK.
const DESSERT_PRESETS: FixedPreset[] = [
  { key: 'small_piece_adet', grams: 40, unitType: 'piece' },
  { key: 'medium_piece_adet', grams: 80, unitType: 'piece' },
  { key: 'slice', grams: 100, unitType: 'slice' },
  { key: 'portion_medium', grams: 150, unitType: 'portion' },
  { key: 'gram_100', grams: 100, unitType: 'gram' },
];

// Cooked/main dishes (sulu yemek, kebap, fast food…) — the cloud seed
// pipelines emit categories like 'main_dish' and 'street_food' for these.
const DISH_PRESETS: FixedPreset[] = [
  { key: 'table_spoon', grams: 30, unitType: 'spoon' },
  { key: 'portion_medium', grams: 250, unitType: 'portion', preferred: true },
  { key: 'plate_full', grams: 350, unitType: 'portion' },
  { key: 'gram_100', grams: 100, unitType: 'gram' },
  { key: 'gram_200', grams: 200, unitType: 'gram' },
];

// Börek, poğaça, açma… — counted by piece or slice.
const PASTRY_PRESETS: FixedPreset[] = [
  { key: 'small_piece_adet', grams: 45, unitType: 'piece' },
  { key: 'medium_piece_adet', grams: 80, unitType: 'piece', preferred: true },
  { key: 'large_piece_adet', grams: 150, unitType: 'piece' },
  { key: 'slice', grams: 100, unitType: 'slice' },
  { key: 'gram_100', grams: 100, unitType: 'gram' },
];

// Mezeler & dipler — spooned onto the plate, small portions.
const MEZE_PRESETS: FixedPreset[] = [
  { key: 'table_spoon', grams: 20, unitType: 'spoon' },
  { key: 'portion_medium', grams: 130, unitType: 'portion', preferred: true },
  { key: 'gram_50', grams: 50, unitType: 'gram' },
  { key: 'gram_100', grams: 100, unitType: 'gram' },
];

// Generic multipliers used when no category match — anchored to the food's
// own `servingSize` so "1 porsiyon" actually means what the food says it
// means (e.g. 200 g for pilav, 120 g for pizza, etc.).
const PORTION_MULTIPLIERS: MultiplierPreset[] = [
  { key: 'half_portion', multiplier: 0.5, unitType: 'portion' },
  { key: 'one_portion', multiplier: 1, unitType: 'portion' },
];

const CATEGORY_TABLE: Record<string, FixedPreset[]> = {
  // Beverages
  beverage: BEVERAGE_PRESETS,
  drink: BEVERAGE_PRESETS,
  // Soups
  soup: SOUP_PRESETS,
  // Breads & Bakery
  bread: BREAD_PRESETS,
  bakery: BREAD_PRESETS,
  // Condiments & Sauces
  condiment: CONDIMENT_PRESETS,
  sauce: CONDIMENT_PRESETS,
  oil: CONDIMENT_PRESETS,
  // Fruits
  fruit: [...FRUIT_PIECE_PRESETS, ...FRUIT_GRAM_PRESETS],
  // Vegetables
  vegetable: VEGETABLE_PRESETS,
  salad: VEGETABLE_PRESETS,
  // Meat, Poultry & Fish
  meat: MEAT_PRESETS,
  poultry: MEAT_PRESETS,
  fish: MEAT_PRESETS,
  seafood: MEAT_PRESETS,
  // Dairy
  dairy: DAIRY_PRESETS,
  cheese: DAIRY_PRESETS,
  yogurt: DAIRY_PRESETS,
  // Legumes
  legume: LEGUME_PRESETS,
  beans: LEGUME_PRESETS,
  // Grains, Rice & Pasta
  grain: GRAIN_PRESETS,
  rice: GRAIN_PRESETS,
  pasta: GRAIN_PRESETS,
  cereal: GRAIN_PRESETS,
  // Eggs
  egg: EGG_PRESETS,
  // Nuts & Seeds
  nut: NUT_PRESETS,
  seed: NUT_PRESETS,
  // Snacks & Candy
  snack: SNACK_PRESETS,
  candy: SNACK_PRESETS,
  dessert: DESSERT_PRESETS,
  // ── Aliases for categories emitted by the cloud seed pipelines ────────
  // (scripts/seedFoods.js ← foods_expanded.json, and
  //  food_calories/upload_to_firestore.py ← diyetkolik scraper).
  // Without these every such food fell through to the generic "½/1
  // porsiyon" multiplier fallback.
  main_dish: DISH_PRESETS,
  dish: DISH_PRESETS,
  fast_food: DISH_PRESETS,
  street_food: DISH_PRESETS,
  kebab: DISH_PRESETS,
  breakfast: DISH_PRESETS,
  side_dish: DISH_PRESETS,
  sandwich: DISH_PRESETS,
  noodle: GRAIN_PRESETS,
  pastry: PASTRY_PRESETS,
  meze: MEZE_PRESETS,
  appetizer: MEZE_PRESETS,
  dip: MEZE_PRESETS,
  pickle: VEGETABLE_PRESETS,
  fruits_vegetables: [...FRUIT_PIECE_PRESETS, ...FRUIT_GRAM_PRESETS],
  protein: MEAT_PRESETS,
};

// ── Name-based category inference ───────────────────────────────────────
// Cloud-library docs and AI-recognized foods frequently arrive with
// `category: null`. Rather than dumping them into the generic porsiyon
// fallback, infer the category from the (Turkish) name. Patterns run on a
// diacritics-folded lowercase name; order matters — first match wins, so
// "Tavuk Çorbası" is a soup, not meat.

/** Lowercase + strip Turkish diacritics/punctuation so regexes stay ASCII. */
function foldName(s: string): string {
  return s
    .toLowerCase()
    // 'İ'.toLowerCase() leaves a combining dot (U+0307) behind — drop it.
    .replace(/\u0307/g, '')
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

const NAME_CATEGORY_RULES: Array<[RegExp, string]> = [
  // Dairy brands first — "Activia Badem…" is a yogurt, not a nut.
  [/\b(activia|alpro|danone|sutas|pinar|icim|yoruksut)\b/, 'dairy'],
  [/\bcorba(si)?\b/, 'soup'],
  [/\bsalata(si)?\b/, 'salad'],
  [/\b(cay|kahve|latte|espresso|americano|kola|gazoz|soda|ayran|salgam|limonata|smoothie|milkshake|bira|sarap|raki|icecek|icecegi|serbet(i)?|sut|sutu)\b|\bsuyu\b/, 'beverage'],
  [/\b(pilav|pilavi|makarna(si)?|bulgur|eriste|spagetti|noodle|risotto)\b/, 'grain'],
  // Bread-based DISHES before the bread rule — "Etli Ekmek" is a ~250 g
  // Konya dish, not a 30 g slice of bread.
  [/etli ekmek|balik ekmek|kumru/, 'dish'],
  [/\b(ekmek|ekmegi|simit|bazlama|lavas)\b/, 'bread'],
  [/\b(borek|boregi|pogaca|acma|gozleme|katmer|milfoy|kruvasan|bagel)\b/, 'pastry'],
  [/\b(baklava|kunefe|kadayif|sutlac|muhallebi|puding|helva(si)?|lokum|tatli(si)?|kek(i)?|kurabiye(si)?|pasta(si)?|dondurma|cikolata|gofret|sekeri|krema(si|li)?|kakao|vanilya(li)?|algida|magnum|cornetto)\b/, 'dessert'],
  [/\b(kebap|kebab(i)?|doner|pide(si)?|lahmacun|pizza|hamburger|burger|tost|sandvic|durum|wrap|kofte(si)?|sarma(si)?|dolma(si)?|manti)\b/, 'dish'],
  [/\byumurta(si)?\b/, 'egg'],
  [/\b(findik|findigi|badem(i)?|ceviz(i)?|kaju|fistik|fistigi|leblebi|kuruyemis)\b/, 'nut'],
  [/\b(yogurt|yogurdu|peynir(i)?)\b/, 'dairy'],
  [/\b(cips|kraker|biskuvi|gevrek|bar)\b/, 'snack'],
];

/**
 * Resolve the preset-table key for a food: the stored category when it maps
 * to a known table, otherwise a name-inferred category, otherwise '' (which
 * sends the caller to the multiplier fallback).
 */
// Topped pides & co. are frequently categorized as 'bread' by the data
// pipelines, but a Kıymalı Pide is a ~400 g dish, not a 30 g slice. The
// "<something>lı/lu pide" shape separates them from plain Pide Ekmeği.
const BREAD_DISH_OVERRIDE = /\b\w+l[iu] pide(si)?\b|\blahmacun\b|etli ekmek|balik ekmek|\bkumru\b/;

function resolveCategoryKey(food: FoodItem): string {
  const raw = (food.category || '').toLowerCase().trim();
  const folded = foldName(`${food.nameTr || ''} ${food.name || ''}`);
  if ((raw === 'bread' || raw === 'bakery') && BREAD_DISH_OVERRIDE.test(folded)) return 'dish';
  if (raw && CATEGORY_TABLE[raw]) return raw;
  for (const [re, cat] of NAME_CATEGORY_RULES) {
    if (re.test(folded)) return cat;
  }
  return raw;
}

// ── Per-food piece weights ──────────────────────────────────────────────
// Foods that are counted by piece but whose real piece weight is far from
// the category-level small/medium/large guesses. When a rule matches, a
// single "Adet" option with the true weight REPLACES the generic piece
// presets (a hazelnut is ~1,2 g — offering "Adet (Küçük) 60 g" is worse
// than nothing). Only applied to whole-food categories; "fıstık ezmesi",
// "badem sütü" and other derivatives are blocked by name or category.

const PIECE_CATEGORY_ALLOW = new Set([
  'nut', 'seed', 'fruit', 'vegetable', 'salad', 'snack', 'fruits_vegetables',
  'meat', 'poultry', 'fish', 'seafood', 'egg', 'dish',
  'bread', 'bakery', 'pastry',
]);
// Three families of false positives: derivative products (fıstık EZMESİ,
// badem SÜTÜ), composite carriers where the matched word is only a filling
// (çiğ köfte DÜRÜM, balık EKMEK, sosisli SANDVİÇ), and packaged/processed
// goods that merely mention an ingredient (fındık kremalı GOFRET, fruit BAR).
const PIECE_NAME_BLOCK =
  /\b(ezme(si|li)?|pure(si)?|sos(u|lu)?|yag(i|li)?|sut(u|lu)?|un(u|lu)?|krema(si|li)?|recel(i|li)?|marmelat|durum|wrap|burger|hamburger|sandvic|tost|pizza|pide(si)?|doner|ekmek|ekmegi|corba(si)?|salata(si)?|gofret|cikolata(li)?|dondurma|kek(i|li)?|kurabiye(si)?|biskuvi|kraker|gevrek|bar|sekeri?|serbet(i)?|icecek|icecegi|parcacikli|pestil(i)?|cips|kakao|vanilya(li)?|algida|magnum|cornetto)\b/;

// [pattern, grams, unit] — unit defaults to 'piece' (Adet); cold cuts use
// 'slice' (Dilim) since that's how they're spoken of in Turkish.
const PIECE_WEIGHT_RULES: Array<[RegExp, number] | [RegExp, number, UnitType]> = [
  // Nuts (kernel weights) — specific multi-word rules before generic ones.
  [/antep fistigi|sam fistigi/, 0.7],
  [/yer fistigi/, 0.9],
  [/\bfistik\b|\bfistigi\b/, 0.8],
  [/\bfindik\b|\bfindigi\b/, 1.2],
  [/\bbadem\b/, 1.2],
  [/\bceviz\b/, 4],
  [/\bkaju\b/, 1.5],
  [/\bleblebi\b/, 0.5],
  [/\bkestane\b/, 10],
  // Small fruits & olives — dried variants before fresh.
  [/kuru kayisi|kayisi kurusu/, 8],
  [/kuru incir|incir kurusu/, 20],
  [/kuru uzum|uzum kurusu/, 0.5],
  [/kuru erik|erik kurusu/, 10],
  [/\bzeytin\b/, 4],
  [/\bhurma\b/, 8],
  [/\bcilek\b/, 12],
  [/\bkiraz\b/, 6],
  [/\bvisne\b/, 6],
  [/\buzum\b/, 5],
  [/\berik\b/, 30],
  [/\bkayisi\b/, 35],
  [/\bincir\b/, 45],
  // Small vegetables.
  [/\bsarimsak\b/, 5], // 1 diş
  [/\bmantar\b/, 20],
  // Meat/fish/seafood items eaten by the piece — the generic MEAT presets
  // assume an 80–250 g cut, which is 5–15× off for these.
  [/icli kofte/, 60],
  [/\bkofte(si)?\b/, 30],
  [/\bkanat\b/, 30],
  [/\bsosis\b/, 50],
  [/\bnugget\b/, 18],
  [/\bfalafel\b/, 20],
  [/\bhamsi\b/, 15],
  [/\bsardalya\b/, 25],
  [/\bkarides\b/, 10],
  [/midye dolma/, 35],
  [/\bmidye\b/, 10],
  [/\bsushi\b/, 30],
  [/yaprak sarma|etli sarma/, 18],
  // Whole bakery pieces — sold and eaten as one piece, not as 30 g slices.
  [/\bsimit\b/, 100],
  [/\bpogaca\b/, 80],
  [/\bacma\b/, 90],
  [/\bkruvasan\b/, 60],
  [/\bbagel\b/, 90],
  [/\bbazlama\b/, 150],
  [/\blavas\b/, 60],
  // Cold cuts — eaten as thin slices, not 80–250 g cuts.
  [/\bsalam\b/, 15, 'slice'],
  [/\bjambon\b/, 15, 'slice'],
  [/\bpastirma\b/, 8, 'slice'],
  [/\bbacon\b/, 12, 'slice'],
  [/fume somon|somon fume/, 30, 'slice'],
];

function findPieceWeight(food: FoodItem): { grams: number; unit: UnitType } | null {
  const folded = foldName(`${food.nameTr || ''} ${food.name || ''}`);
  if (PIECE_NAME_BLOCK.test(folded)) return null;
  for (const [re, grams, unit] of PIECE_WEIGHT_RULES) {
    if (re.test(folded)) return { grams, unit: unit ?? 'piece' };
  }
  return null;
}

// Default Turkish labels — used when the i18n bundle has no override. Kept
// in this file (rather than tr.ts) because the utility may run in contexts
// where the i18n module isn't loaded (e.g. unit tests).
const DEFAULT_LABELS: Record<string, string> = {
  half_slice: '½ dilim',
  slice: '1 dilim',
  two_slices: '2 dilim',
  three_slices: '3 dilim',
  whole: 'Tamamı',
  tea_glass: '1 çay bardağı',
  small_glass: 'Küçük bardak',
  large_glass: 'Büyük bardak',
  bottle_500ml: '1 şişe (500ml)',
  bottle_1l: '1 L şişe',
  half_bowl: '½ kase',
  bowl: '1 kase',
  large_bowl: '1 büyük kase',
  two_bowls: '2 kase',
  // Sized bowls + soup-style measures (newer, parenthetical naming)
  ladle: 'Kepçe',
  bowl_small: 'Kase (Küçük)',
  bowl_medium: 'Kase (Orta)',
  bowl_large: 'Kase (Büyük)',
  portion_medium: 'Porsiyon (Orta)',
  plate_full: 'Tabak (Tam)',
  tea_spoon: '1 çay kaşığı',
  table_spoon: '1 yemek kaşığı',
  two_table_spoons: '2 yemek kaşığı',
  small_handful: '1 küçük avuç',
  one_handful: '1 avuç',
  one_package: '1 paket',
  // Legacy gram-labelled piece keys (kept for backward compat with existing curated portions)
  small_piece: '1 küçük',
  medium_piece: '1 orta',
  large_piece: '1 büyük',
  // New adet (piece count) keys — parenthetical size naming reads cleanly
  // next to the "Miktar" count in the redesigned quantity dialog.
  small_piece_adet: 'Adet (Küçük)',
  medium_piece_adet: 'Adet (Orta)',
  large_piece_adet: 'Adet (Büyük)',
  // Single "Adet" — used when the per-food piece-weight table knows the
  // food's true piece weight (1 fındık, 1 zeytin…), so no size variants.
  piece_adet: 'Adet',
  // Gram shortcuts
  gram_50: '50 g',
  gram_100: '100 g',
  gram_150: '150 g',
  gram_200: '200 g',
  // Portions
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
  // Resolve via stored category first, then name inference — cloud and AI
  // foods often carry `category: null` or pipeline-specific values.
  const categoryKey = resolveCategoryKey(food);
  const categoryFixed = CATEGORY_TABLE[categoryKey];

  // Per-food piece weight (1 fındık ≈ 1,2 g…). When known, a single "Adet"
  // preset leads the list and the category's generic small/medium/large
  // piece guesses are dropped — they'd be wildly wrong for these foods.
  const pieceWeight = PIECE_CATEGORY_ALLOW.has(categoryKey) ? findPieceWeight(food) : null;
  const piecePreset: ResolvedPortion | null = pieceWeight
    ? {
        label: localiseKey(pieceWeight.unit === 'slice' ? 'slice' : 'piece_adet', t),
        grams: pieceWeight.grams,
        unitType: pieceWeight.unit,
      }
    : null;
  const mapCategoryPresets = (presets: FixedPreset[]): ResolvedPortion[] => {
    const mapped = presets
      .filter((p) => !(piecePreset && p.unitType === 'piece'))
      .map((p) => ({ label: localiseKey(p.key, t), grams: p.grams, unitType: p.unitType, preferred: p.preferred }));
    return piecePreset ? [piecePreset, ...mapped] : mapped;
  };

  // 1. Curated portions from Firestore seed. Tagged as 'portion' so they
  //    appear under their own tab when category presets are also present.
  //    If the food has no matching category, curated portions are returned
  //    as-is (no tab bar shown — same UX as before this feature).
  if (food.commonPortions && food.commonPortions.length > 0) {
    const curated: ResolvedPortion[] = food.commonPortions
      .filter((p): p is FoodPortion => !!p && typeof p.label === 'string' && Number.isFinite(p.grams) && p.grams > 0)
      .map((p) => ({ label: p.label, grams: Math.round(p.grams), unitType: 'portion' as UnitType }));

    // A single curated portion is a food-specific estimate (typically the
    // AI-recognition chip). Mark it preferred so a 100 g AI estimate isn't
    // mistaken for the pipelines' 100 g filler and overridden by a category
    // default. Multi-size curated lists keep the closest-match behaviour.
    if (curated.length === 1) curated[0].preferred = true;

    if (curated.length > 0) {
      // If the food's category maps to non-portion unit types (adet, gram,
      // kaşık…), merge curated under 'portion' tab + category presets in
      // their own tabs, giving the user both options.
      if (categoryFixed) {
        const catPresets = mapCategoryPresets(categoryFixed);
        const hasExtraTypes = catPresets.some((p) => p.unitType !== 'portion');
        if (hasExtraTypes) {
          return [...curated, ...catPresets];
        }
      }
      return curated;
    }
  }

  // 2. Category-based fixed presets (bowl, glass, slice, adet, ...).
  if (categoryFixed) {
    return mapCategoryPresets(categoryFixed);
  }

  // 3. Multiplier fallback anchored to the food's serving size. If the food
  //    has no sensible serving size (0 or missing), use 100 g so the math
  //    still produces something the user can adjust.
  const anchor = food.servingSize && food.servingSize > 0 ? food.servingSize : 100;
  return PORTION_MULTIPLIERS.map((p) => ({
    label: localiseKey(p.key, t),
    grams: Math.round(anchor * p.multiplier),
    unitType: p.unitType,
  }));
}

/**
 * Returns the distinct unit types present in a preset list, in display order.
 * Used by the UI to render the unit-type tab bar.
 */
export function getUnitTypes(presets: ResolvedPortion[]): UnitType[] {
  const seen = new Set<UnitType>();
  const order: UnitType[] = [];
  for (const p of presets) {
    if (p.unitType && !seen.has(p.unitType)) {
      seen.add(p.unitType);
      order.push(p.unitType);
    }
  }
  return order;
}

/**
 * Pick the preset that best matches the food's stated serving size — the
 * dialog opens with this preset preselected so the user can confirm with
 * a single tap when the default is right.
 *
 * Strategy: smallest absolute gram delta. Ties go to the earlier entry
 * (typically the smaller portion), which mirrors how users tend to
 * under-estimate by default.
 *
 * Exception: when the serving size carries no real signal — missing, ≤0, or
 * exactly 100 (the flat filler value the cloud seed pipelines write when the
 * true portion is unknown) — a preset marked `preferred` wins, so a soup
 * opens on "Kase (Orta)" instead of whatever happens to sit near 100 g.
 */
export function pickDefaultPreset(presets: ResolvedPortion[], servingSize: number): number {
  if (presets.length === 0) return -1;
  const noSignal = !servingSize || servingSize <= 0 || servingSize === 100;
  if (noSignal) {
    const prefIdx = presets.findIndex((p) => p.preferred);
    if (prefIdx >= 0) return prefIdx;
  }
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
