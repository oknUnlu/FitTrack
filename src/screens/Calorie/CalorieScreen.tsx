import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, ScrollView, StyleSheet, FlatList, TouchableOpacity, Platform, Alert, KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Text, Card, Searchbar, useTheme, Dialog, Portal, TextInput, Button, IconButton, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '../../store/userStore';
import { useMealStore } from '../../store/mealStore';
import { getUserById, User } from '../../services/database/userDao';
import { getMealLogsByDate, MealLog, insertMealLog, deleteMealLog } from '../../services/database/mealDao';
import { searchFoodItems, FoodItem, getFoodByBarcode } from '../../services/database/foodDao';
import { getPortionPresets, pickDefaultPreset, type ResolvedPortion, type UnitType } from '../../utils/portions';
import { getProductByBarcode } from '../../services/api/openFoodFacts';
import { insertBarcodeSubmission, checkAndPromoteBarcode, getVerifiedProductFromCloud } from '../../services/database/barcodeDao';
import { searchFoodsInCloud } from '../../services/firebase/foodFirestore';
import { getDeviceToken } from '../../services/api/apiClient';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { recognizeFoodFromImage, RecognizedFood } from '../../services/ai/foodRecognition';
import { estimateFoodFromText } from '../../services/ai/foodEstimate';
import { ensureAiConsent } from '../../services/privacy/aiConsent';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { todayString, MEAL_TYPES, generateId } from '../../utils/helpers';
import { useLanguage } from '../../i18n';
import { usePremiumStore } from '../../store/premiumStore';
import { PaywallModal } from '../../components/PaywallModal';
import { checkDailyLimit } from '../../services/premium/featureGate';
import { incrementUsage, getRemainingUsage } from '../../services/ai/rateLimiter';

// Clamp the free-text unit count to a sane integer range (1..99). Empty or
// garbage input falls back to 1 so the dialog never resolves to NaN grams.
const COUNT_MIN = 1;
const COUNT_MAX = 99;
function clampCount(raw: string): number {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return COUNT_MIN;
  return Math.min(COUNT_MAX, Math.max(COUNT_MIN, n));
}

// Web fallback: load foods JSON directly for search
const foodsJsonData: any[] = require('../../assets/data/foods_tr.json');

function searchFoodsLocal(query: string, limit = 20): FoodItem[] {
  const q = query.toLowerCase();
  return foodsJsonData
    .filter((f: any) => f.name.toLowerCase().includes(q) || f.nameTr.toLowerCase().includes(q))
    .slice(0, limit)
    .map((f: any) => ({
      id: f.id, name: f.name, nameTr: f.nameTr,
      calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat,
      fiber: f.fiber, sugar: f.sugar, barcode: null,
      servingSize: f.servingSize, servingUnit: f.servingUnit,
      isCustom: false, isFavorite: false, source: 'local',
      category: f.category ?? null,
      commonPortions: Array.isArray(f.commonPortions) ? f.commonPortions : null,
    }));
}

function normalizeFoodName(s: string | null): string {
  return (s ?? '').toLowerCase().trim();
}

/**
 * Merge cloud food results into the local ones, keeping local entries first
 * (they're cached/favorited/curated) and appending only cloud foods that
 * aren't already present. Deduped by id and by normalized name so a cloud
 * copy of a food the user already has locally doesn't show up twice.
 */
function mergeFoods(local: FoodItem[], cloud: FoodItem[]): FoodItem[] {
  const seenIds = new Set(local.map((f) => f.id));
  const seenNames = new Set(
    local.map((f) => normalizeFoodName(f.nameTr) || normalizeFoodName(f.name))
  );
  const merged = [...local];
  for (const c of cloud) {
    const nameKey = normalizeFoodName(c.nameTr) || normalizeFoodName(c.name);
    if (seenIds.has(c.id)) continue;
    if (nameKey && seenNames.has(nameKey)) continue;
    merged.push(c);
    seenIds.add(c.id);
    if (nameKey) seenNames.add(nameKey);
  }
  return merged;
}

const MEAL_TYPE_KEYS: Record<string, 'breakfast' | 'lunch' | 'dinner' | 'snack'> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snack',
};

const MEAL_COLORS: Record<string, string> = {
  breakfast: '#FF9800',
  lunch: '#4CAF50',
  dinner: '#5C6BC0',
  snack: '#AB47BC',
};

const MEAL_CALORIE_RATIOS: Record<string, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.30,
  snack: 0.10,
};

export function CalorieScreen() {
  const userId = useUserStore((s) => s.userId);
  const { meals: webMeals, addMeal: addWebMeal, removeMeal: removeWebMeal } = useMealStore();
  const theme = useTheme();
  const { t, language } = useLanguage();
  const [date, setDate] = useState(todayString());
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [activeMealType, setActiveMealType] = useState<string>('breakfast');
  const [barcodeVisible, setBarcodeVisible] = useState(false);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [aiResults, setAiResults] = useState<RecognizedFood[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState('');
  const isPremium = usePremiumStore((s) => s.isPremium);
  const [user, setUser] = useState<User | null>(null);
  const [manualEntryVisible, setManualEntryVisible] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualCalories, setManualCalories] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat] = useState('');

  // AI text estimate (premium): user types a food + portion and the model
  // fills the editable manual-entry form. `aiEstimateVisible` is the small
  // query dialog used by the standalone entry points; `aiEstimateLoading`
  // is shared with the in-dialog "fill with AI" button.
  const [aiEstimateVisible, setAiEstimateVisible] = useState(false);
  const [aiEstimateQuery, setAiEstimateQuery] = useState('');
  const [aiEstimateLoading, setAiEstimateLoading] = useState(false);

  // Bug #13: quantity dialog — every food selection routes through
  // this dialog so the user can pick exactly how many grams they ate.
  // Without this, every meal is silently logged at the food's default
  // serving size, which wildly under/overcounts calories.
  //
  // The dialog has two modes:
  //   - chip mode (default): household-measure quick picks ("1 dilim",
  //     "1 kase", "1 büyük bardak") computed by `getPortionPresets` from
  //     the food's curated portions or category-based defaults.
  //   - manual mode: classic gram TextInput, kept for power users / edge
  //     foods. Toggled with a "Tam gramajı biliyorum" link.
  const [quantityDialogVisible, setQuantityDialogVisible] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [quantityPresets, setQuantityPresets] = useState<ResolvedPortion[]>([]);
  const [selectedPortionIdx, setSelectedPortionIdx] = useState<number>(-1);
  const [selectedUnitType, setSelectedUnitType] = useState<UnitType | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [quantityAmount, setQuantityAmount] = useState('');
  // How many of the selected unit (e.g. 7 olives, 2 bowls). Kept as text so
  // the field can be edited freely; clamped to 1..99 wherever it's consumed.
  const [quantityCount, setQuantityCount] = useState('1');
  // Whether the unit dropdown in the quantity dialog is expanded.
  const [unitMenuVisible, setUnitMenuVisible] = useState(false);


  const loadMeals = useCallback(async () => {
    if (Platform.OS === 'web') {
      setMeals(webMeals.filter((m) => m.date === date));
      return;
    }
    try {
      const [data, u] = await Promise.all([
        getMealLogsByDate(userId, date),
        user ? Promise.resolve(user) : getUserById(userId),
      ]);
      setMeals(data);
      if (u && !user) setUser(u);
    } catch (e) {
      if (__DEV__) console.warn('loadMeals failed:', e);
    }
  }, [userId, date, webMeals, user]);

  useEffect(() => { loadMeals(); }, [loadMeals]);


  // Tracks the query that kicked off the most recent search so async
  // results from stale keystrokes can't stomp on fresher ones. Without
  // this, a slow Firestore round-trip for "piz" could overwrite the
  // local results already rendered for "pizza".
  const searchSeqRef = useRef(0);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const mySeq = ++searchSeqRef.current;
    try {
      let results: FoodItem[] = [];
      if (Platform.OS === 'web') {
        results = searchFoodsLocal(query);
      } else {
        results = await searchFoodItems(query);
      }
      // Publish local results immediately — they're fast, the user
      // shouldn't have to wait for a network round-trip for the common
      // case where the food is already cached.
      if (mySeq === searchSeqRef.current) {
        setSearchResults(results);
      }

      // Always also query Firestore's `food_library` collection and merge
      // the hits in, so foods that only exist in the cloud library (USDA +
      // curated entries seeded by scripts/seedFoods.js) show up alongside
      // the local matches — not only when local returns nothing. Hits are
      // cached back into local SQLite so the next search short-circuits.
      const cloudResults = await searchFoodsInCloud(query);
      // Only render if the user is still looking for the same query —
      // otherwise they've already moved on.
      if (mySeq === searchSeqRef.current && cloudResults.length > 0) {
        setSearchResults(mergeFoods(results, cloudResults));
      }
    } catch (e) {
      if (__DEV__) console.warn('searchFoodItems failed:', e);
    }
  }, []);

  // Opens the quantity dialog. We compute the household-measure presets
  // upfront (curated portions → category defaults → portion multipliers)
  // and pre-select the one closest to the food's stated serving size, so
  // the user can confirm with a single tap when the default is right.
  // The actual meal insert happens in `handleConfirmQuantity` after the
  // user picks a chip or manually overrides the gram amount.
  const handleAddFood = useCallback((food: FoodItem) => {
    Keyboard.dismiss();
    setSelectedFood(food);

    const presets = getPortionPresets(food, t);
    let defaultIdx = pickDefaultPreset(presets, food.servingSize);
    // The unit dropdown lists real household units (adet, kase, …); exact
    // grams are a dedicated "Gram" option that switches to manual entry. So
    // if the closest preset is a gram shortcut, open on the category's
    // preferred unit (medium adet/porsiyon/kase) when one exists, else the
    // first real unit; only fall back to manual mode when none exists.
    const noUnitPresets = presets.every((p) => p.unitType === 'gram');
    if (defaultIdx >= 0 && presets[defaultIdx].unitType === 'gram' && !noUnitPresets) {
      const preferredIdx = presets.findIndex((p) => p.preferred && p.unitType !== 'gram');
      defaultIdx = preferredIdx >= 0 ? preferredIdx : presets.findIndex((p) => p.unitType !== 'gram');
    }
    setQuantityPresets(presets);
    setSelectedPortionIdx(defaultIdx);
    setSelectedUnitType(defaultIdx >= 0 ? presets[defaultIdx].unitType ?? null : null);
    // Start in unit mode unless the food only offers gram amounts.
    setManualMode(noUnitPresets);
    setUnitMenuVisible(false);
    // Default to a single unit; the user changes it in the "Miktar" field.
    setQuantityCount('1');
    // Seed the manual-mode input with the default preset's grams (or the
    // food's serving size as a fallback) so the field isn't empty if the
    // user toggles into manual mode.
    const seedAmount =
      defaultIdx >= 0 ? presets[defaultIdx].grams : food.servingSize && food.servingSize > 0 ? food.servingSize : 100;
    setQuantityAmount(String(seedAmount));

    // Close any open modal so the dialog sits cleanly on top.
    setSearchVisible(false);
    setSearchQuery('');
    setSearchResults([]);
    setAiModalVisible(false);
    setAiResults([]);
    setQuantityDialogVisible(true);
  }, [t]);

  /**
   * Resolves the gram amount currently selected in the dialog. In chip mode
   * we trust the preset; in manual mode we parse the TextInput, accepting
   * either "120" or "120,5" since Turkish locale uses commas. Returns NaN
   * if the input is unusable, which the caller surfaces as an alert.
   */
  const resolveSelectedGrams = useCallback((): number => {
    if (manualMode) {
      return parseFloat(quantityAmount.replace(',', '.'));
    }
    const preset = quantityPresets[selectedPortionIdx];
    if (!preset) return NaN;
    // 'gram' chips are an absolute amount; everything else is per-unit and
    // gets multiplied by how many units the user entered.
    const count = preset.unitType === 'gram' ? 1 : clampCount(quantityCount);
    return preset.grams * count;
  }, [manualMode, quantityAmount, quantityPresets, selectedPortionIdx, quantityCount]);

  // Computes macros proportionally to the chosen gram amount (the
  // food object stores per-100g values) and inserts the meal log.
  const handleConfirmQuantity = useCallback(async () => {
    if (!selectedFood) return;
    const grams = resolveSelectedGrams();
    if (isNaN(grams) || grams <= 0) {
      Alert.alert('', t.calorie.quantityInvalid || 'Enter a valid amount');
      return;
    }
    try {
      const ratio = grams / 100;
      const meal: MealLog = {
        id: generateId(),
        userId,
        date,
        mealType: activeMealType as any,
        foodItemId: selectedFood.nameTr || selectedFood.name,
        servingAmount: grams,
        servingUnit: 'g',
        caloriesConsumed: selectedFood.calories * ratio,
        proteinConsumed: selectedFood.protein * ratio,
        carbsConsumed: selectedFood.carbs * ratio,
        fatConsumed: selectedFood.fat * ratio,
        createdAt: Date.now(),
      };
      if (Platform.OS === 'web') {
        addWebMeal(meal);
      } else {
        await insertMealLog(meal);
        loadMeals();
      }
      setQuantityDialogVisible(false);
      setSelectedFood(null);
      setQuantityPresets([]);
      setSelectedPortionIdx(-1);
      setManualMode(false);
      setUnitMenuVisible(false);
      setQuantityAmount('');
      setQuantityCount('1');
    } catch (e) {
      if (__DEV__) console.warn('handleConfirmQuantity failed:', e);
    }
  }, [selectedFood, resolveSelectedGrams, userId, date, activeMealType, loadMeals, t, addWebMeal]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      if (Platform.OS === 'web') {
        removeWebMeal(id);
      } else {
        await deleteMealLog(id);
        loadMeals();
      }
    } catch (e) {
      if (__DEV__) console.warn('handleDelete failed:', e);
    }
  }, [loadMeals]);

  const checkPremiumAccess = useCallback((feature: string): boolean => {
    if (isPremium) return true;
    setPaywallFeature(feature);
    setPaywallVisible(true);
    return false;
  }, [isPremium]);

  const handleBarcodeScan = useCallback(async (barcode: string) => {
    setBarcodeLoading(true);
    try {
      // 1. Check local DB first (community-verified or previously saved)
      if (Platform.OS !== 'web') {
        const localFood = await getFoodByBarcode(barcode);
        if (localFood) {
          setBarcodeVisible(false);
          setBarcodeLoading(false);
          handleAddFood(localFood);
          return;
        }
      }

      // 2. Check Firestore verified products (community data)
      if (Platform.OS !== 'web') {
        const cloudFood = await getVerifiedProductFromCloud(barcode);
        if (cloudFood) {
          setBarcodeVisible(false);
          setBarcodeLoading(false);
          handleAddFood(cloudFood);
          return;
        }
      }

      // 3. Check Open Food Facts API
      const product = await getProductByBarcode(barcode);
      if (product) {
        const food: FoodItem = {
          id: product.id,
          name: product.name,
          nameTr: product.nameTr,
          calories: product.calories,
          protein: product.protein,
          carbs: product.carbs,
          fat: product.fat,
          fiber: product.fiber,
          sugar: product.sugar,
          barcode: product.barcode,
          servingSize: 100,
          servingUnit: 'g',
          isCustom: false,
          isFavorite: false,
          source: 'openfoodfacts',
          category: null,
          commonPortions: null,
        };
        setBarcodeVisible(false);
        setBarcodeLoading(false);
        handleAddFood(food);
      } else {
        // 3. Not found anywhere → show manual entry form
        setBarcodeLoading(false);
        setBarcodeVisible(false);
        setScannedBarcode(barcode);
        setManualName('');
        setManualCalories('');
        setManualProtein('');
        setManualCarbs('');
        setManualFat('');
        setManualEntryVisible(true);
      }
    } catch (e) {
      setBarcodeLoading(false);
      setBarcodeVisible(false);
      setScannedBarcode(barcode);
      setManualName('');
      setManualCalories('');
      setManualProtein('');
      setManualCarbs('');
      setManualFat('');
      setManualEntryVisible(true);
    }
  }, [activeMealType, handleAddFood, t]);

  const handleManualBarcodeSubmit = useCallback(async () => {
    const name = manualName.trim();
    const cal = parseFloat(manualCalories);
    const pro = parseFloat(manualProtein);
    const carb = parseFloat(manualCarbs);
    const fat = parseFloat(manualFat);

    if (!name || isNaN(cal) || isNaN(pro) || isNaN(carb) || isNaN(fat) || cal < 0 || pro < 0 || carb < 0 || fat < 0) {
      Alert.alert('', t.barcode.fillAllFields);
      return;
    }

    // Use immediately as meal entry
    const food: FoodItem = {
      id: `manual_${scannedBarcode || 'entry'}_${Date.now()}`,
      name,
      nameTr: name,
      calories: cal,
      protein: pro,
      carbs: carb,
      fat,
      fiber: null,
      sugar: null,
      barcode: scannedBarcode || null,
      servingSize: 100,
      servingUnit: 'g',
      isCustom: true,
      isFavorite: false,
      source: 'manual',
      category: null,
      commonPortions: null,
    };

    setManualEntryVisible(false);
    // Routes the new food through the quantity dialog so the user
    // can pick a portion size (defaults to 100g).
    handleAddFood(food);

    // Save submission and check verification in background — only
    // meaningful for barcode scans. For standalone manual entries
    // (scannedBarcode === '') we skip the crowdsourced submission.
    if (Platform.OS !== 'web' && scannedBarcode) {
      try {
        const deviceId = await getDeviceToken();
        await insertBarcodeSubmission(scannedBarcode, name, cal, pro, carb, fat, deviceId);
        await checkAndPromoteBarcode(scannedBarcode);
      } catch (e) {
        if (__DEV__) console.warn('Barcode submission failed:', e);
      }
    }
  }, [scannedBarcode, manualName, manualCalories, manualProtein, manualCarbs, manualFat, handleAddFood, t]);

  // Opens the manual-entry dialog WITHOUT a barcode — triggered from
  // the search modal when the user can't find the food they want.
  const handleOpenManualEntry = useCallback(() => {
    Keyboard.dismiss();
    setSearchVisible(false);
    setSearchQuery('');
    setSearchResults([]);
    setScannedBarcode('');
    setManualName('');
    setManualCalories('');
    setManualProtein('');
    setManualCarbs('');
    setManualFat('');
    setManualEntryVisible(true);
  }, []);

  // Core AI text-estimate routine (premium). Sends the query to Gemini,
  // converts the returned portion TOTALS back to per-100g, and fills the
  // editable manual-entry form so the user can review/correct before adding.
  // Both entry points (the standalone query dialog and the in-dialog "fill
  // with AI" button) funnel through here.
  const runFoodEstimate = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) {
      Alert.alert('', (t as any).calorie?.aiEstimateEmpty || t.barcode.fillAllFields);
      return;
    }
    if (!checkPremiumAccess('food_estimate')) return;

    const { allowed } = await checkDailyLimit('food_estimate');
    if (!allowed) {
      Alert.alert(t.premium.limitReached, t.premium.dailyLimitFoodMsg);
      return;
    }
    if (!(await ensureAiConsent())) return;

    Keyboard.dismiss();
    try {
      setAiEstimateLoading(true);
      const food = await estimateFoodFromText(q);
      await incrementUsage('food_estimate');
      if (!food) {
        Alert.alert('', (t as any).calorie?.aiEstimateNotFound || t.calorie.noResults);
        return;
      }

      // Convert AI portion TOTALS → per-100g for the manual form fields.
      const grams = food.servingSize > 0 ? food.servingSize : 100;
      const ratio = grams / 100;
      const per100 = (n: number): number => (ratio > 0 ? n / ratio : n);
      const round1 = (n: number): string => String(Math.round(n * 10) / 10);

      setScannedBarcode('');
      setManualName(food.name || q);
      setManualCalories(String(Math.round(per100(food.calories))));
      setManualProtein(round1(per100(food.protein)));
      setManualCarbs(round1(per100(food.carbs)));
      setManualFat(round1(per100(food.fat)));

      setAiEstimateVisible(false);
      setAiEstimateQuery('');
      setManualEntryVisible(true);
    } catch (e: any) {
      if (e?.message === 'AI_CONSENT_REQUIRED') return;
      Alert.alert(t.common.error, e?.message || ((t as any).calorie?.aiEstimateError || t.common.errorOccurred));
    } finally {
      setAiEstimateLoading(false);
    }
  }, [checkPremiumAccess, t]);

  // Opens the standalone AI estimate query dialog (from the search action row
  // / empty-results CTA). Premium is gated here so non-subscribers see the
  // paywall instead of an empty input.
  const handleOpenAiEstimate = useCallback(() => {
    if (!checkPremiumAccess('food_estimate')) return;
    Keyboard.dismiss();
    setSearchVisible(false);
    setManualEntryVisible(false);
    setAiEstimateQuery(searchQuery.trim());
    setAiEstimateVisible(true);
  }, [checkPremiumAccess, searchQuery]);

  const handlePhotoRecognition = useCallback(async () => {
    if (!checkPremiumAccess('food_recognition')) return;

    const { allowed } = await checkDailyLimit('food_recognition');
    if (!allowed) {
      Alert.alert(t.premium.limitReached, t.premium.dailyLimitFoodMsg);
      return;
    }

    if (!(await ensureAiConsent())) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets[0]) return;

      setAiLoading(true);
      setAiModalVisible(true);
      const foods = await recognizeFoodFromImage(result.assets[0].uri);
      await incrementUsage('food_recognition');
      setAiResults(foods);
      setAiLoading(false);
    } catch (e: any) {
      setAiLoading(false);
      if (e?.message === 'AI_CONSENT_REQUIRED') return;
      Alert.alert(t.common.error, e.message || t.calorie.aiRecognition);
    }
  }, [t, isPremium]);

  /**
   * Routes an AI calorie estimate into the same quantity dialog used for
   * typed/searched foods, so confirmation, multi-portion editing, and the
   * macro preview all stay in one place.
   *
   * The wire shape from Gemini is "TOTALS for the visible portion" (post
   * AI Kalori Tanıma refactor). FoodItem internally stores per-100g
   * because the portion picker scales `grams / 100`. We do the conversion
   * here once: per-100g = total / (estimatedGrams / 100).
   *
   * The AI's portion estimate is surfaced as a single curated chip in the
   * portion picker (e.g. "AI tahmini · 1 dilim") so the user can confirm
   * with one tap. The "Tam gramajı biliyorum" toggle still gives a manual
   * escape hatch when the estimate is off.
   */
  const handleAddAiFood = useCallback((food: RecognizedFood) => {
    const visibleGrams = food.servingSize > 0 ? food.servingSize : 100;
    const ratio = visibleGrams / 100;
    // Convert AI's totals back to per-100g representation for FoodItem.
    // Guard against divide-by-zero by enforcing ratio>0 above.
    const per100 = (n: number): number => (ratio > 0 ? n / ratio : n);

    const aiLabel = food.servingDescription
      ? `${(t as any).calorie?.aiEstimateBadge || 'AI estimate'} · ${food.servingDescription}`
      : (t as any).calorie?.aiEstimateBadge || 'AI estimate';

    const foodItem: FoodItem = {
      id: `ai_${Date.now()}_${food.name}`,
      name: food.name,
      nameTr: food.name,
      calories: per100(food.calories),
      protein: per100(food.protein),
      carbs: per100(food.carbs),
      fat: per100(food.fat),
      fiber: null,
      sugar: null,
      barcode: null,
      servingSize: visibleGrams,
      servingUnit: food.servingUnit || 'g',
      isCustom: false,
      isFavorite: false,
      source: 'ai_recognition',
      category: null,
      // Single curated portion chip carrying the AI's estimate. The portion
      // picker will also surface a "Tam gramajı biliyorum" toggle for users
      // who want to override.
      commonPortions: [{ label: aiLabel, grams: visibleGrams }],
    };
    handleAddFood(foodItem);
    setAiModalVisible(false);
    setAiResults([]);
  }, [handleAddFood, t]);

  const dailyTarget = user?.tdee ?? 2000;

  const getMealLabel = (key: string): string => {
    const labelKey = MEAL_TYPE_KEYS[key];
    return labelKey ? t.calorie[labelKey] : key;
  };

  const displayDate = useMemo(() => {
    const d = new Date(date + 'T00:00:00');
    const formatted = d.toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, [date, language]);

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      {/* Date Header */}
      <View style={styles.dateHeader}>
        <TouchableOpacity
          style={styles.dateNavBtn}
          onPress={() => {
            const d = new Date(date);
            d.setDate(d.getDate() - 1);
            setDate(d.toISOString().split('T')[0]);
          }}
          activeOpacity={0.6}
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.dateDisplay}>
          <Text style={styles.dateText}>{displayDate}</Text>
        </View>
        <TouchableOpacity
          style={styles.dateNavBtn}
          onPress={() => {
            const d = new Date(date);
            d.setDate(d.getDate() + 1);
            setDate(d.toISOString().split('T')[0]);
          }}
          activeOpacity={0.6}
        >
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Meal Sections */}
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {MEAL_TYPES.map((mt) => {
          const sectionMeals = meals.filter((m) => m.mealType === mt.key);
          const sectionCal = sectionMeals.reduce((s, m) => s + m.caloriesConsumed, 0);
          const mealColor = MEAL_COLORS[mt.key] || colors.primary;
          const mealTarget = Math.round(dailyTarget * (MEAL_CALORIE_RATIOS[mt.key] ?? 0.25));
          const mealProgress = mealTarget > 0 ? Math.min(sectionCal / mealTarget, 1) : 0;
          const isOver = sectionCal > mealTarget;

          return (
            <Card key={mt.key} style={styles.mealCard} mode="elevated">
              <View style={[styles.mealAccent, { backgroundColor: mealColor }]} />
              <Card.Content style={styles.mealContent}>
                {/* Meal Header */}
                <View style={styles.mealHeader}>
                  <View style={[styles.mealIconWrap, { backgroundColor: `${mealColor}15` }]}>
                    <MaterialCommunityIcons name={mt.icon as any} size={20} color={mealColor} />
                  </View>
                  <Text style={styles.mealTitle}>{getMealLabel(mt.key)}</Text>
                  <View style={[styles.mealCalBadge, { backgroundColor: `${mealColor}10` }]}>
                    <Text style={[styles.mealCalText, { color: isOver ? colors.red : mealColor }]}>
                      {Math.round(sectionCal)} / {mealTarget} {t.common.kcal}
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, {
                    width: `${Math.round(mealProgress * 100)}%`,
                    backgroundColor: isOver ? colors.red : mealColor,
                  }]} />
                </View>

                {/* Food Items */}
                {sectionMeals.map((m, i) => (
                  <View
                    key={m.id}
                    style={[styles.foodItem, i === sectionMeals.length - 1 && { borderBottomWidth: 0 }]}
                  >
                    <View style={styles.foodInfo}>
                      <Text style={styles.foodName} numberOfLines={1}>{m.foodItemId}</Text>
                      <View style={styles.foodMacroRow}>
                        <Text style={[styles.macroTag, { color: colors.protein }]}>
                          P:{Math.round(m.proteinConsumed)}g
                        </Text>
                        <Text style={styles.macroDivider}>&middot;</Text>
                        <Text style={[styles.macroTag, { color: colors.carbs }]}>
                          K:{Math.round(m.carbsConsumed)}g
                        </Text>
                        <Text style={styles.macroDivider}>&middot;</Text>
                        <Text style={[styles.macroTag, { color: colors.fat }]}>
                          Y:{Math.round(m.fatConsumed)}g
                        </Text>
                      </View>
                    </View>
                    <View style={styles.foodCalWrap}>
                      <Text style={styles.foodCalValue}>{Math.round(m.caloriesConsumed)}</Text>
                      <Text style={styles.foodCalLabel}>{t.common.kcal}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDelete(m.id)} style={styles.deleteBtn} activeOpacity={0.6}>
                      <MaterialCommunityIcons name="close" size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add Food Button */}
                <TouchableOpacity
                  style={[styles.addFoodBtn, { borderColor: `${mealColor}30` }]}
                  onPress={() => { setActiveMealType(mt.key); setSearchVisible(true); }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="plus" size={18} color={mealColor} />
                  <Text style={[styles.addFoodText, { color: mealColor }]}>{t.calorie.addFood}</Text>
                </TouchableOpacity>
              </Card.Content>
            </Card>
          );
        })}
      </ScrollView>

      {/* AI Food Recognition Modal */}
      {aiModalVisible && (
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior="padding"
        >
          <TouchableWithoutFeedback onPress={() => { setAiModalVisible(false); setAiResults([]); }}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalSheet, { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom || spacing.md }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={[styles.modalTitleIcon, { backgroundColor: `${colors.orange}15` }]}>
                  <MaterialCommunityIcons name="brain" size={20} color={colors.orange} />
                </View>
                <Text style={styles.modalTitle}>{t.calorie.aiRecognition}</Text>
              </View>
              <TouchableOpacity onPress={() => { setAiModalVisible(false); setAiResults([]); }} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {aiLoading ? (
              <View style={styles.modalLoadingWrap}>
                <MaterialCommunityIcons name="food-variant" size={40} color={colors.orange} />
                <Text style={styles.modalLoadingText}>{t.common.loading}</Text>
              </View>
            ) : aiResults.length === 0 ? (
              <Text style={styles.modalEmptyText}>{t.calorie.noResults}</Text>
            ) : (
              <FlatList
                data={aiResults}
                keyExtractor={(_, i) => `ai_${i}`}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                ListHeaderComponent={
                  // Sum tile — when the AI returns multiple items (a plate
                  // with rice + chicken + salad), show their combined total
                  // so the user sees "the meal as a whole is ~620 kcal"
                  // before they tap individual entries.
                  aiResults.length > 1 ? (
                    <View style={styles.aiTotalTile}>
                      <Text style={styles.aiTotalLabel}>
                        {(t as any).calorie?.aiTotalLabel || 'Plate total'}
                      </Text>
                      <Text style={styles.aiTotalKcal}>
                        {Math.round(aiResults.reduce((s, r) => s + (r.calories || 0), 0))} {t.common.kcal}
                      </Text>
                    </View>
                  ) : null
                }
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => handleAddAiFood(item)} style={styles.aiResultRow} activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.searchResultNameRow}>
                        <Text style={styles.searchResultName}>{item.name}</Text>
                        <View style={[
                          styles.confidenceBadge,
                          { backgroundColor: item.confidence === 'high' ? colors.successBg : item.confidence === 'medium' ? colors.warningBg : colors.errorBg },
                        ]}>
                          <Text style={[
                            styles.confidenceText,
                            { color: item.confidence === 'high' ? '#2E7D32' : item.confidence === 'medium' ? '#E65100' : '#C62828' },
                          ]}>
                            {item.confidence}
                          </Text>
                        </View>
                      </View>
                      {/* Headline: total estimated calories for what the AI
                          saw — the whole point of this feature. */}
                      <Text style={styles.aiResultKcal}>
                        ~{Math.round(item.calories)} {t.common.kcal}
                      </Text>
                      <Text style={styles.aiResultPortion}>
                        {item.servingDescription
                          ? `${item.servingDescription} · ~${Math.round(item.servingSize)} ${item.servingUnit || 'g'}`
                          : `~${Math.round(item.servingSize)} ${item.servingUnit || 'g'}`}
                      </Text>
                      <Text style={styles.aiResultMacros}>
                        P:{Math.round(item.protein)}g &middot; K:{Math.round(item.carbs)}g &middot; Y:{Math.round(item.fat)}g
                      </Text>
                    </View>
                    <View style={styles.addCircle}>
                      <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Barcode Scanner */}
      {barcodeVisible && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => { setBarcodeVisible(false); setBarcodeLoading(false); }}
          loading={barcodeLoading}
        />
      )}

      {/* Search Modal */}
      {searchVisible && (
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior="height"
        >
          <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setSearchVisible(false); }}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalSheet, { flex: 1, backgroundColor: theme.colors.surface, paddingBottom: insets.bottom || spacing.md }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.calorie.searchFood}</Text>
              <TouchableOpacity onPress={() => { Keyboard.dismiss(); setSearchVisible(false); }} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search Bar + Action Buttons */}
            <Searchbar
              placeholder={t.calorie.searchPlaceholder}
              value={searchQuery}
              onChangeText={handleSearch}
              style={styles.searchBar}
              inputStyle={styles.searchBarInput}
            />

            {Platform.OS !== 'web' && (
              <View style={styles.actionBtnRow}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    Keyboard.dismiss(); setSearchVisible(false); setBarcodeVisible(true);
                  }}
                  activeOpacity={0.7}
                  accessibilityLabel="Scan barcode"
                  accessibilityRole="button"
                >
                  <View style={[styles.actionBtnIcon, { backgroundColor: colors.primary }]}>
                    <MaterialCommunityIcons name="barcode-scan" size={22} color="#fff" />
                  </View>
                  <Text style={styles.actionBtnLabel}>{t.barcode.scanBarcode}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => { Keyboard.dismiss(); setSearchVisible(false); handlePhotoRecognition(); }}
                  activeOpacity={0.7}
                  accessibilityLabel="Take photo for food recognition"
                  accessibilityRole="button"
                >
                  <View style={[styles.actionBtnIcon, { backgroundColor: colors.orange }]}>
                    <MaterialCommunityIcons name="camera" size={22} color="#fff" />
                  </View>
                  <Text style={styles.actionBtnLabel}>{t.calorie.aiRecognition}</Text>
                  {!isPremium && (
                    <MaterialCommunityIcons name="lock" size={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => { Keyboard.dismiss(); handleOpenAiEstimate(); }}
                  activeOpacity={0.7}
                  accessibilityLabel="AI nutrition estimate"
                  accessibilityRole="button"
                >
                  <View style={[styles.actionBtnIcon, { backgroundColor: colors.purple }]}>
                    <MaterialCommunityIcons name="robot-happy-outline" size={22} color="#fff" />
                  </View>
                  <Text style={styles.actionBtnLabel}>{(t as any).calorie?.aiEstimate || 'AI estimate'}</Text>
                  {!isPremium && (
                    <MaterialCommunityIcons name="lock" size={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={handleOpenManualEntry}
                  activeOpacity={0.7}
                  accessibilityLabel="Manual entry"
                  accessibilityRole="button"
                >
                  <View style={[styles.actionBtnIcon, { backgroundColor: colors.calorieGreen }]}>
                    <MaterialCommunityIcons name="pencil-plus-outline" size={22} color="#fff" />
                  </View>
                  <Text style={styles.actionBtnLabel}>{t.calorie.manualEntry || 'Manual Entry'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Search Results */}
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              style={{ flex: 1 }}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => handleAddFood(item)} style={styles.searchResultItem} activeOpacity={0.7}>
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultName}>{item.nameTr || item.name}</Text>
                    <Text style={styles.searchResultMacro}>
                      {item.calories} {t.common.kcal}/100g &middot; P:{item.protein}g &middot; K:{item.carbs}g &middot; Y:{item.fat}g
                    </Text>
                  </View>
                  <View style={styles.addCircle}>
                    <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                searchQuery.length >= 2 ? (
                  <View style={styles.emptyResultsWrap}>
                    <Text style={styles.modalEmptyText}>{t.calorie.noResults}</Text>
                    <Text style={styles.modalEmptyHint}>{t.calorie.manualEntryDesc || ''}</Text>
                    <TouchableOpacity
                      style={[styles.manualEntryCta, { backgroundColor: colors.purple }]}
                      onPress={handleOpenAiEstimate}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="robot-happy-outline" size={18} color="#fff" />
                      <Text style={styles.manualEntryCtaText}>
                        {(t as any).calorie?.aiEstimateCta || 'Estimate with AI'}
                      </Text>
                      {!isPremium && (
                        <MaterialCommunityIcons name="lock" size={12} color="#fff" style={{ marginLeft: 4 }} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.manualEntryCta}
                      onPress={handleOpenManualEntry}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="pencil-plus" size={18} color="#fff" />
                      <Text style={styles.manualEntryCtaText}>
                        {t.calorie.addManually || 'Add Manually'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null
              }
            />
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Manual Barcode Entry Dialog.
          NOTE: every editable field in these dialogs is deliberately
          UNCONTROLLED (defaultValue + onChangeText, no value prop). With the
          New Architecture, controlled TextInputs re-sync native text on every
          keystroke re-render, which resets the cursor to the start and makes
          mid-string edits (deleting the 1 in "100") nearly impossible.
          Dialog content unmounts on close, so defaultValue re-seeds on every
          open; programmatic fills (AI estimate) happen before opening. */}
      <Portal>
        <Dialog visible={manualEntryVisible} onDismiss={() => setManualEntryVisible(false)}>
          <Dialog.Title>{t.barcode.manualEntryTitle}</Dialog.Title>
          <Dialog.Content style={{ gap: 8 }}>
            <TextInput
              label={t.barcode.productName}
              defaultValue={manualName}
              onChangeText={setManualName}
              mode="outlined"
              dense
              maxLength={100}
            />
            <TextInput
              label={t.barcode.caloriesPer100g}
              defaultValue={manualCalories}
              onChangeText={setManualCalories}
              keyboardType="numeric"
              mode="outlined"
              dense
              maxLength={6}
            />
            <TextInput
              label={t.barcode.proteinPer100g}
              defaultValue={manualProtein}
              onChangeText={setManualProtein}
              keyboardType="numeric"
              mode="outlined"
              dense
              maxLength={6}
            />
            <TextInput
              label={t.barcode.carbsPer100g}
              defaultValue={manualCarbs}
              onChangeText={setManualCarbs}
              keyboardType="numeric"
              mode="outlined"
              dense
              maxLength={6}
            />
            <TextInput
              label={t.barcode.fatPer100g}
              defaultValue={manualFat}
              onChangeText={setManualFat}
              keyboardType="numeric"
              mode="outlined"
              dense
              maxLength={6}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setManualEntryVisible(false)}>{t.common.cancel}</Button>
            <Button mode="contained" onPress={handleManualBarcodeSubmit}>{t.barcode.submit}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* AI Estimate Query Dialog — premium users type a food + portion and the
          model fills the editable manual-entry form (totals → per-100g). */}
      <Portal>
        <Dialog visible={aiEstimateVisible} onDismiss={() => { if (!aiEstimateLoading) setAiEstimateVisible(false); }}>
          <Dialog.Title>{(t as any).calorie?.aiEstimateTitle || 'Estimate with AI'}</Dialog.Title>
          <Dialog.Content style={{ gap: 8 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              {(t as any).calorie?.aiEstimateHint || 'Type the food and portion, and AI will fill in the nutrition values.'}
            </Text>
            <TextInput
              label={(t as any).calorie?.aiEstimateLabel || 'Food and portion'}
              placeholder={(t as any).calorie?.aiEstimatePlaceholder || 'e.g. 1 bowl of lentil soup'}
              defaultValue={aiEstimateQuery}
              onChangeText={setAiEstimateQuery}
              mode="outlined"
              dense
              maxLength={120}
              autoFocus
              onSubmitEditing={() => runFoodEstimate(aiEstimateQuery)}
              returnKeyType="search"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={aiEstimateLoading} onPress={() => setAiEstimateVisible(false)}>{t.common.cancel}</Button>
            <Button
              mode="contained"
              icon="robot-happy-outline"
              loading={aiEstimateLoading}
              disabled={aiEstimateLoading}
              onPress={() => runFoodEstimate(aiEstimateQuery)}
            >
              {(t as any).calorie?.aiEstimateSubmit || 'Estimate'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Quantity Dialog — asks the user how much of the selected food they
          ate. Default mode is a row of household-measure chips ("1 dilim",
          "1 kase"); a "Tam gramajı biliyorum" toggle reveals a manual gram
          TextInput for foods that don't fit a preset. Either way the
          underlying gram amount is what gets logged so macro math stays
          consistent with the per-100g reference values stored on FoodItem. */}
      <Portal>
        <Dialog
          visible={quantityDialogVisible}
          onDismiss={() => {
            setQuantityDialogVisible(false);
            setSelectedFood(null);
            setQuantityPresets([]);
            setSelectedPortionIdx(-1);
            setSelectedUnitType(null);
            setManualMode(false);
            setUnitMenuVisible(false);
            setQuantityAmount('');
          }}
        >
          <Dialog.Title>{(t as any).calorie?.quantityPickerTitle || t.calorie.quantityTitle || 'How much did you eat?'}</Dialog.Title>
          <Dialog.Content style={{ gap: spacing.sm }}>
            {selectedFood && (() => {
              const ul = (t as any).calorie?.unitLabels ?? {};
              const gramUnit = selectedFood.servingUnit || 'g';
              const gramLabel = ul.gram ?? 'Gram';

              // The dropdown offers real household units; gram amounts are a
              // dedicated option that flips the dialog into manual entry.
              const unitPresets = quantityPresets.filter((p) => p.unitType !== 'gram');

              // Drop a redundant leading "1 " so the unit reads naturally next
              // to the "Miktar" count (e.g. "2 × orta adet", not "2 × 1 orta adet").
              const prettyUnit = (label: string) =>
                label.startsWith('1 ') ? label.slice(2) : label;

              const currentLabel = manualMode
                ? `${gramLabel} (${gramUnit})`
                : prettyUnit(quantityPresets[selectedPortionIdx]?.label ?? gramLabel);

              // Resolve the gram amount currently described by the inputs so we
              // can show a live calorie + macro readout in the header.
              const g = manualMode
                ? parseFloat((quantityAmount || '0').replace(',', '.'))
                : (quantityPresets[selectedPortionIdx]?.grams ?? NaN) * clampCount(quantityCount);
              const valid = !isNaN(g) && g > 0;
              const ratio = valid ? g / 100 : 0;
              const kcal = Math.round(selectedFood.calories * ratio);
              const pP = Math.round(selectedFood.protein * ratio);
              const pC = Math.round(selectedFood.carbs * ratio);
              const pF = Math.round(selectedFood.fat * ratio);

              return (
                <View>
                  {/* Header — food icon, name and a live calorie readout. */}
                  <View style={styles.qHeader}>
                    <View style={styles.qIconCircle}>
                      <MaterialCommunityIcons name="silverware-fork-knife" size={22} color={theme.colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.qHeaderName} numberOfLines={2}>
                        {selectedFood.nameTr || selectedFood.name}
                      </Text>
                      <View style={styles.qKcalRow}>
                        <Text style={styles.qKcalValue}>{valid ? kcal : 0}</Text>
                        <Text style={styles.qKcalUnit}> {t.common.kcal}</Text>
                        <MaterialCommunityIcons name="fire" size={15} color={colors.orange} style={{ marginLeft: 3 }} />
                      </View>
                    </View>
                  </View>

                  <Divider style={styles.qDivider} />

                  {/* Amount — a count of the chosen unit, or exact grams in
                      manual mode. One field instead of a chip + stepper combo. */}
                  <Text style={styles.qFieldLabel}>{t.calorie.quantityAmount || 'Amount'}</Text>
                  {manualMode ? (
                    // Uncontrolled + distinct keys: see the note above the
                    // manual-entry dialog. The keys force a remount when the
                    // dialog switches between count and grams mode so the
                    // seeded defaultValue applies.
                    <TextInput
                      key="qty-grams"
                      defaultValue={quantityAmount}
                      onChangeText={setQuantityAmount}
                      keyboardType="numeric"
                      mode="outlined"
                      dense
                      maxLength={6}
                      placeholder="0"
                      right={<TextInput.Affix text={gramUnit} />}
                      style={styles.qAmountInput}
                    />
                  ) : (
                    <TextInput
                      key="qty-count"
                      defaultValue={quantityCount}
                      onChangeText={(v) => setQuantityCount(v.replace(/[^0-9]/g, '').slice(0, 2))}
                      onBlur={() => setQuantityCount(String(clampCount(quantityCount)))}
                      keyboardType="number-pad"
                      mode="outlined"
                      dense
                      placeholder="1"
                      style={styles.qAmountInput}
                    />
                  )}

                  {/* Unit selector — an inline dropdown (kept inline rather than
                      a Portal Menu so it layers reliably inside the Dialog). */}
                  <Text style={[styles.qFieldLabel, { marginTop: spacing.sm }]}>
                    {(t as any).calorie?.unitFieldLabel || 'Unit'}
                  </Text>
                  <TouchableOpacity
                    style={styles.qDropdownAnchor}
                    activeOpacity={0.7}
                    onPress={() => setUnitMenuVisible((v) => !v)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.qDropdownText} numberOfLines={1}>{currentLabel}</Text>
                    <MaterialCommunityIcons
                      name={unitMenuVisible ? 'chevron-up' : 'chevron-down'}
                      size={22}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>

                  {unitMenuVisible && (
                    <View style={styles.qDropdownList}>
                      {unitPresets.map((p) => {
                        const globalIdx = quantityPresets.indexOf(p);
                        const active = !manualMode && globalIdx === selectedPortionIdx;
                        return (
                          <TouchableOpacity
                            key={`${p.label}-${globalIdx}`}
                            style={styles.qDropdownItem}
                            activeOpacity={0.6}
                            onPress={() => {
                              setManualMode(false);
                              setSelectedPortionIdx(globalIdx);
                              setSelectedUnitType(p.unitType ?? null);
                              setUnitMenuVisible(false);
                            }}
                          >
                            <Text style={[styles.qDropdownItemText, active && { color: theme.colors.primary, fontWeight: '600' }]}>
                              {prettyUnit(p.label)}
                            </Text>
                            {active && <MaterialCommunityIcons name="check" size={18} color={theme.colors.primary} />}
                          </TouchableOpacity>
                        );
                      })}
                      {/* Exact grams — switches to manual entry. */}
                      <TouchableOpacity
                        style={[styles.qDropdownItem, { borderBottomWidth: 0 }]}
                        activeOpacity={0.6}
                        onPress={() => {
                          setManualMode(true);
                          if (!quantityAmount || quantityAmount === '0') {
                            const preset = quantityPresets[selectedPortionIdx];
                            setQuantityAmount(String(preset ? preset.grams : selectedFood.servingSize || 100));
                          }
                          setUnitMenuVisible(false);
                        }}
                      >
                        <Text style={[styles.qDropdownItemText, manualMode && { color: theme.colors.primary, fontWeight: '600' }]}>
                          {gramLabel} ({gramUnit})
                        </Text>
                        {manualMode && <MaterialCommunityIcons name="check" size={18} color={theme.colors.primary} />}
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Macro breakdown for the resolved amount. */}
                  {valid && (
                    <View style={styles.qMacroRow}>
                      <Text style={[styles.qMacro, { color: colors.protein }]}>P {pP}g</Text>
                      <Text style={[styles.qMacro, { color: colors.carbs }]}>K {pC}g</Text>
                      <Text style={[styles.qMacro, { color: colors.fat }]}>Y {pF}g</Text>
                      <Text style={[styles.qMacro, { color: colors.textTertiary }]}>{Math.round(g)} {gramUnit}</Text>
                    </View>
                  )}
                </View>
              );
            })()}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setQuantityDialogVisible(false);
                setSelectedFood(null);
                setQuantityPresets([]);
                setSelectedPortionIdx(-1);
                setSelectedUnitType(null);
                setManualMode(false);
                setUnitMenuVisible(false);
                setQuantityAmount('');
                setQuantityCount('1');
              }}
            >
              {t.common.cancel}
            </Button>
            <Button mode="contained" onPress={handleConfirmQuantity}>
              {t.calorie.addToMeal || t.barcode.submit}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} feature={paywallFeature} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Date Header
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dateNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // Meal Card
  mealCard: {
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  mealAccent: {
    height: 3,
  },
  mealContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  mealIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealTitle: {
    flex: 1,
    fontWeight: 'bold',
    fontSize: 15,
    marginLeft: spacing.sm,
    color: colors.textPrimary,
  },
  mealCalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  mealCalText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Progress Bar
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    borderRadius: 2,
  },

  // Food Item
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  foodMacroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  macroTag: {
    fontSize: 11,
    fontWeight: '500',
  },
  macroDivider: {
    fontSize: 11,
    color: colors.textDisabled,
  },
  foodCalWrap: {
    alignItems: 'flex-end',
    marginRight: 4,
    minWidth: 44,
  },
  foodCalValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  foodCalLabel: {
    fontSize: 9,
    color: colors.textTertiary,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },

  // Add Food Button
  addFoodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: borderRadius.sm,
    gap: 6,
  },
  addFoodText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Modal / Bottom Sheet
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitleIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: 17,
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  modalLoadingText: {
    color: colors.textTertiary,
    fontSize: 13,
  },
  modalEmptyText: {
    textAlign: 'center',
    color: colors.textTertiary,
    paddingVertical: spacing.lg,
    fontSize: 13,
  },

  // Manual Entry CTA (shown when no search results)
  emptyResultsWrap: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  modalEmptyHint: {
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: 12,
    paddingHorizontal: spacing.md,
    marginTop: -spacing.md,
  },
  manualEntryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.calorieGreen,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    gap: 6,
    marginTop: spacing.sm,
  },
  manualEntryCtaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  // Quantity Dialog — redesigned as a clean card: food header with a live
  // calorie readout, a single "Miktar" field, and an inline unit dropdown.
  qHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  qIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qHeaderName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  qKcalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  qKcalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  qKcalUnit: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  qDivider: {
    marginBottom: spacing.sm,
  },
  qFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  qAmountInput: {
    backgroundColor: 'transparent',
  },
  qDropdownAnchor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.22)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    backgroundColor: colors.surface,
  },
  qDropdownText: {
    fontSize: 15,
    color: colors.textPrimary,
    flex: 1,
  },
  qDropdownList: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: borderRadius.sm,
    marginTop: 4,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  qDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  qDropdownItemText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  qMacroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  qMacro: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Search
  searchBar: {
    borderRadius: borderRadius.md,
    elevation: 0,
    marginBottom: spacing.sm,
  },
  searchBarInput: {
    fontSize: 14,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 4,
  },
  actionBtnIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
    maxWidth: 80,
    textAlign: 'center',
  },

  // Search Results
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    gap: spacing.sm,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  searchResultName: {
    fontWeight: '600',
    fontSize: 14,
    color: colors.textPrimary,
  },
  searchResultMacro: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  addCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confidenceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 9,
    fontWeight: '600',
  },

  // AI Calorie Recognition modal — total estimate display
  aiTotalTile: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  aiTotalLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiTotalKcal: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 2,
  },
  aiResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.divider,
  },
  aiResultKcal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 4,
  },
  aiResultPortion: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  aiResultMacros: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
});
