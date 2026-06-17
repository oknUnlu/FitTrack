import { getPortionPresets, pickDefaultPreset } from '../src/utils/portions';
import type { FoodItem } from '../src/services/database/foodDao';

// Builds a minimal FoodItem stub — every field nullable enough for the
// portion picker to function. Tests override only what they care about.
function makeFood(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 'test',
    name: 'Test Food',
    nameTr: 'Test Yemek',
    calories: 100,
    protein: 5,
    carbs: 20,
    fat: 2,
    fiber: null,
    sugar: null,
    barcode: null,
    servingSize: 100,
    servingUnit: 'g',
    isCustom: false,
    isFavorite: false,
    source: 'local',
    category: null,
    commonPortions: null,
    ...overrides,
  };
}

// No translations bundle — utility falls back to default Turkish labels.
const NO_T = undefined;

describe('getPortionPresets', () => {
  test('curated portions lead, then category presets are merged in their own tabs', () => {
    const food = makeFood({
      category: 'soup', // soup → bowl presets, a non-portion unit type
      commonPortions: [
        { label: 'Özel boy', grams: 175 },
        { label: 'Devasa', grams: 999 },
      ],
    });
    const presets = getPortionPresets(food, NO_T);
    // Curated entries come first (under the 'portion' tab)…
    expect(presets[0]).toEqual({ label: 'Özel boy', grams: 175, unitType: 'portion' });
    expect(presets[1]).toEqual({ label: 'Devasa', grams: 999, unitType: 'portion' });
    // …followed by the soup (bowl) category presets so the user gets both.
    expect(presets.slice(2).map((p) => p.grams)).toEqual([125, 250, 400]);
    expect(presets.slice(2).every((p) => p.unitType === 'bowl')).toBe(true);
  });

  test('soup category produces kase chips when no curated portions', () => {
    const presets = getPortionPresets(makeFood({ category: 'soup' }), NO_T);
    expect(presets.map((p) => p.grams)).toEqual([125, 250, 400]);
    // Default labels are Turkish — soup → kase
    expect(presets[1].label).toContain('kase');
  });

  test('beverage category produces glass/bottle chips', () => {
    const presets = getPortionPresets(makeFood({ category: 'beverage' }), NO_T);
    // Includes the Turkish çay bardağı (150 ml) added in the beverage presets.
    expect(presets.map((p) => p.grams)).toEqual([150, 200, 300, 500, 1000]);
  });

  test('drink alias maps to the same beverage presets', () => {
    const a = getPortionPresets(makeFood({ category: 'drink' }), NO_T);
    const b = getPortionPresets(makeFood({ category: 'beverage' }), NO_T);
    expect(a).toEqual(b);
  });

  test('unknown/null category falls back to portion multipliers anchored to servingSize', () => {
    const presets = getPortionPresets(
      makeFood({ category: null, servingSize: 200 }),
      NO_T
    );
    // Multipliers: 0.5x, 1x → 100, 200 g (2x/3x handled by count stepper)
    expect(presets.map((p) => p.grams)).toEqual([100, 200]);
  });

  test('zero or missing servingSize defaults the multiplier anchor to 100 g', () => {
    const presets = getPortionPresets(
      makeFood({ category: null, servingSize: 0 }),
      NO_T
    );
    expect(presets.map((p) => p.grams)).toEqual([50, 100]);
  });

  test('curated portions with NaN or non-positive grams are filtered out', () => {
    const food = makeFood({
      commonPortions: [
        { label: 'OK', grams: 100 },
        { label: 'Bad', grams: NaN as any },
        { label: 'Zero', grams: 0 },
        { label: 'Negative', grams: -50 },
        { label: 'Also OK', grams: 250 },
      ],
    });
    const presets = getPortionPresets(food, NO_T);
    expect(presets.map((p) => p.label)).toEqual(['OK', 'Also OK']);
  });

  test('empty curated portions falls through to category defaults', () => {
    const food = makeFood({ category: 'soup', commonPortions: [] });
    const presets = getPortionPresets(food, NO_T);
    expect(presets.map((p) => p.grams)).toEqual([125, 250, 400]);
  });

  test('i18n bundle override wins over default labels', () => {
    const t = {
      calorie: {
        portions: {
          half_bowl: '½ кassa',
          bowl: 'EnglishBowl',
        },
      },
    };
    const presets = getPortionPresets(makeFood({ category: 'soup' }), t);
    expect(presets[0].label).toBe('½ кassa');
    expect(presets[1].label).toBe('EnglishBowl');
    // Untranslated keys still fall back to Turkish defaults
    expect(presets[2].label).toContain('büyük kase');
  });
});

describe('pickDefaultPreset', () => {
  test('empty preset list returns -1', () => {
    expect(pickDefaultPreset([], 100)).toBe(-1);
  });

  test('picks the preset closest to servingSize', () => {
    const presets = [
      { label: '½ kase', grams: 125 },
      { label: '1 kase', grams: 250 },
      { label: '1 büyük kase', grams: 400 },
      { label: '2 kase', grams: 500 },
    ];
    // 250g serving → "1 kase" (idx 1)
    expect(pickDefaultPreset(presets, 250)).toBe(1);
    // 300g serving → "1 kase" (closer than 400)
    expect(pickDefaultPreset(presets, 300)).toBe(1);
    // 380g serving → "1 büyük kase" (closer than 250)
    expect(pickDefaultPreset(presets, 380)).toBe(2);
  });

  test('zero/negative servingSize defaults to 100 g target', () => {
    const presets = [
      { label: 'A', grams: 50 },
      { label: 'B', grams: 120 },
      { label: 'C', grams: 300 },
    ];
    // Target=100, closest is B(120)
    expect(pickDefaultPreset(presets, 0)).toBe(1);
    expect(pickDefaultPreset(presets, -50)).toBe(1);
  });

  test('ties prefer the earlier (smaller) preset', () => {
    const presets = [
      { label: 'A', grams: 100 },
      { label: 'B', grams: 200 },
    ];
    // 150g target → equidistant; earlier wins
    expect(pickDefaultPreset(presets, 150)).toBe(0);
  });
});
