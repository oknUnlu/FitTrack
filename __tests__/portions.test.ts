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
    // …followed by the soup category presets (ladle / sized bowls / plate) so
    // the user gets both. The soup set mixes spoon, bowl and portion types.
    expect(presets.slice(2).map((p) => p.grams)).toEqual([100, 200, 300, 400, 300, 350]);
    expect(presets.slice(2).some((p) => p.unitType === 'bowl')).toBe(true);
  });

  test('soup category produces sized kase presets when no curated portions', () => {
    const presets = getPortionPresets(makeFood({ category: 'soup' }), NO_T);
    expect(presets.map((p) => p.grams)).toEqual([100, 200, 300, 400, 300, 350]);
    // Default labels are Turkish — soup → Kepçe + sized Kase + Tabak
    expect(presets[0].label).toBe('Kepçe');
    expect(presets[1].label).toContain('Kase');
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
    expect(presets.map((p) => p.grams)).toEqual([100, 200, 300, 400, 300, 350]);
  });

  // ── Name-based category inference (cloud/AI foods with null category) ──

  test('null-category soup ("Beyran Çorbası") infers soup from the name and gets kase presets', () => {
    const presets = getPortionPresets(
      makeFood({ nameTr: 'Beyran Çorbası', name: 'Beyran Çorbası', category: null }),
      NO_T
    );
    expect(presets.some((p) => p.label.includes('Kase'))).toBe(true);
    expect(presets.map((p) => p.grams)).toEqual([100, 200, 300, 400, 300, 350]);
  });

  test('name inference handles Turkish suffixes and diacritics ("Mercimek çorbası")', () => {
    const presets = getPortionPresets(
      makeFood({ nameTr: 'Mercimek çorbası', category: null }),
      NO_T
    );
    expect(presets.some((p) => p.unitType === 'bowl')).toBe(true);
  });

  test('stored category wins over name inference when it maps to a table', () => {
    // "İçli köfte çorbası"-style conflicts: explicit category takes priority.
    const presets = getPortionPresets(
      makeFood({ nameTr: 'Tavuk Çorbası', category: 'meat' }),
      NO_T
    );
    expect(presets.some((p) => p.unitType === 'bowl')).toBe(false);
  });

  // ── Pipeline category aliases ──────────────────────────────────────────

  test('main_dish (cloud seed category) maps to dish presets instead of the porsiyon fallback', () => {
    const presets = getPortionPresets(makeFood({ category: 'main_dish' }), NO_T);
    expect(presets.some((p) => p.unitType === 'spoon')).toBe(true);
    expect(presets.some((p) => p.label.includes('Porsiyon'))).toBe(true);
  });

  test('fruits_vegetables (diyetkolik pipeline) maps to fruit piece+gram presets', () => {
    const presets = getPortionPresets(makeFood({ category: 'fruits_vegetables' }), NO_T);
    expect(presets.some((p) => p.unitType === 'piece')).toBe(true);
    expect(presets.some((p) => p.unitType === 'gram')).toBe(true);
  });

  // ── Per-food piece weights ─────────────────────────────────────────────

  test('fındık (nut) gains a true-weight Adet preset alongside avuç', () => {
    const presets = getPortionPresets(
      makeFood({ nameTr: 'Fındık', name: 'Hazelnuts', category: 'nut', servingSize: 30 }),
      NO_T
    );
    expect(presets[0]).toEqual({ label: 'Adet', grams: 1.2, unitType: 'piece' });
    expect(presets.some((p) => p.unitType === 'handful')).toBe(true);
  });

  test('AI-recognized fındık with null category still resolves to nut + Adet', () => {
    const presets = getPortionPresets(
      makeFood({ nameTr: 'Kavrulmuş Fındık', category: null }),
      NO_T
    );
    expect(presets[0].label).toBe('Adet');
    expect(presets[0].grams).toBeCloseTo(1.2);
  });

  test('true piece weight replaces the generic small/medium/large piece guesses (zeytin)', () => {
    const presets = getPortionPresets(
      makeFood({ nameTr: 'Zeytin', category: 'vegetable', servingSize: 30 }),
      NO_T
    );
    const pieces = presets.filter((p) => p.unitType === 'piece');
    expect(pieces).toEqual([{ label: 'Adet', grams: 4, unitType: 'piece' }]);
  });

  test('derived products are not given a piece preset (fıstık ezmesi, badem sütü)', () => {
    const ezme = getPortionPresets(
      makeFood({ nameTr: 'Fıstık Ezmesi', category: 'nut' }),
      NO_T
    );
    expect(ezme.some((p) => p.unitType === 'piece')).toBe(false);

    const sut = getPortionPresets(
      makeFood({ nameTr: 'Badem Sütü', category: 'beverage' }),
      NO_T
    );
    expect(sut.some((p) => p.unitType === 'piece')).toBe(false);
  });

  test('reported bug: 1 büyük zeytin is ~5 kcal, not 207', () => {
    // Zeytin: 115 kcal/100g. Old behavior offered "Adet (Büyük)" = 180 g
    // → 207 kcal for one olive. Now the only piece option is the true 4 g.
    const presets = getPortionPresets(
      makeFood({ nameTr: 'Zeytin', name: 'Olive', category: 'vegetable', servingSize: 30, calories: 115 }),
      NO_T
    );
    const pieces = presets.filter((p) => p.unitType === 'piece');
    expect(pieces).toHaveLength(1);
    expect(Math.round(115 * (pieces[0].grams / 100) * 10) / 10).toBeLessThan(6);
    expect(presets.some((p) => p.label.includes('Büyük') && p.unitType === 'piece')).toBe(false);
  });

  test('piece-counted meat/fish get true piece weights (köfte, hamsi, karides)', () => {
    const kofte = getPortionPresets(makeFood({ nameTr: 'Köfte', category: 'meat' }), NO_T);
    expect(kofte.filter((p) => p.unitType === 'piece')).toEqual([{ label: 'Adet', grams: 30, unitType: 'piece' }]);

    const hamsi = getPortionPresets(makeFood({ nameTr: 'Hamsi', category: 'fish' }), NO_T);
    expect(hamsi[0]).toEqual({ label: 'Adet', grams: 15, unitType: 'piece' });

    const karides = getPortionPresets(makeFood({ nameTr: 'Karides', category: 'seafood' }), NO_T);
    expect(karides[0].grams).toBe(10);
  });

  test('small vegetables/fruits get true piece weights (sarımsak, vişne, kayısı)', () => {
    const sarimsak = getPortionPresets(makeFood({ nameTr: 'Sarımsak', category: 'vegetable' }), NO_T);
    expect(sarimsak[0]).toEqual({ label: 'Adet', grams: 5, unitType: 'piece' });

    const visne = getPortionPresets(makeFood({ nameTr: 'Vişne', category: 'fruit' }), NO_T);
    expect(visne[0].grams).toBe(6);

    // Dried variant keeps its own (lighter) weight over the fresh rule.
    const kuruKayisi = getPortionPresets(makeFood({ nameTr: 'Kuru Kayısı', category: 'fruit' }), NO_T);
    expect(kuruKayisi[0].grams).toBe(8);
    const kayisi = getPortionPresets(makeFood({ nameTr: 'Kayısı', category: 'fruit' }), NO_T);
    expect(kayisi[0].grams).toBe(35);
  });

  test('composite carriers keep their full size ("Çiğ Köfte Dürüm", "Balık Ekmek")', () => {
    // The köfte inside a dürüm must not shrink the whole wrap to 30 g.
    const durum = getPortionPresets(makeFood({ nameTr: 'Çiğ Köfte Dürüm', category: 'meat' }), NO_T);
    expect(durum.some((p) => p.grams < 40 && p.unitType === 'piece')).toBe(false);

    const balikEkmek = getPortionPresets(makeFood({ nameTr: 'Balık Ekmek', category: 'fish' }), NO_T);
    expect(balikEkmek.some((p) => p.grams < 40 && p.unitType === 'piece')).toBe(false);
  });

  test('composite dish names do not trigger nut piece weights ("Fıstıklı Baklava")', () => {
    const presets = getPortionPresets(
      makeFood({ nameTr: 'Fıstıklı Baklava', category: null }),
      NO_T
    );
    // Inferred as dessert (baklava) → dilim/adet presets, but no 0,7 g pistachio piece.
    expect(presets.every((p) => p.grams >= 40)).toBe(true);
  });

  test('i18n bundle override wins over default labels', () => {
    const t = {
      calorie: {
        portions: {
          ladle: 'Ladle',
          bowl_small: 'EnglishSmallBowl',
        },
      },
    };
    const presets = getPortionPresets(makeFood({ category: 'soup' }), t);
    expect(presets[0].label).toBe('Ladle');
    expect(presets[1].label).toBe('EnglishSmallBowl');
    // Untranslated keys still fall back to Turkish defaults
    expect(presets[3].label).toContain('Büyük');
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

  test('preferred preset wins when serving size is the 100 g pipeline filler', () => {
    // Cloud Beyran: servingSize 100 (filler) → default should be the medium
    // bowl, not the ladle that happens to weigh exactly 100 g.
    const presets = getPortionPresets(
      makeFood({ nameTr: 'Beyran Çorbası', category: null, servingSize: 100 }),
      NO_T
    );
    const idx = pickDefaultPreset(presets, 100);
    expect(presets[idx].label).toBe('Kase (Orta)');
  });

  test('an AI-recognition chip at exactly 100 g stays the default (not the category preset)', () => {
    // Photo flow: single curated chip carrying the AI's estimate. Even when
    // that estimate is exactly 100 g it must win over "Kase (Orta) 300 g".
    const presets = getPortionPresets(
      makeFood({
        nameTr: 'Mercimek Çorbası',
        category: null,
        servingSize: 100,
        commonPortions: [{ label: 'AI tahmini · 1 kepçe', grams: 100 }],
      }),
      NO_T
    );
    const idx = pickDefaultPreset(presets, 100);
    expect(presets[idx].label).toContain('AI tahmini');
    // Kase options are still available in the list for manual switching.
    expect(presets.some((p) => p.unitType === 'bowl')).toBe(true);
  });

  test('a real serving size overrides the preferred flag', () => {
    // Local soups carry a genuine 250 g serving → closest preset wins as before.
    const presets = getPortionPresets(makeFood({ category: 'soup' }), NO_T);
    const idx = pickDefaultPreset(presets, 250);
    expect(presets[idx].grams).toBe(200); // Kase (Küçük), closest to 250 with tie → earlier
  });
});
