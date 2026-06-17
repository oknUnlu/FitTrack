import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, ScrollView, StyleSheet, FlatList, TouchableOpacity, Platform, Alert, KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Text, Card, Searchbar, useTheme, Dialog, Portal, TextInput, Button, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '../../store/userStore';
import { useMealStore } from '../../store/mealStore';
import { getUserById, User } from '../../services/database/userDao';
import { getMealLogsByDate, MealLog, insertMealLog, deleteMealLog } from '../../services/database/mealDao';
import { searchFoodItems, FoodItem, getFoodByBarcode } from '../../services/database/foodDao';
import { getPortionPresets, getUnitTypes, pickDefaultPreset, type ResolvedPortion, type UnitType } from '../../utils/portions';
import { getProductByBarcode } from '../../services/api/openFoodFacts';
import { insertBarcodeSubmission, checkAndPromoteBarcode, getVerifiedProductFromCloud } from '../../services/database/barcodeDao';
import { searchFoodsInCloud } from '../../services/firebase/foodFirestore';
import { getDeviceToken } from '../../services/api/apiClient';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { recognizeFoodFromImage, RecognizedFood } from '../../services/ai/foodRecognition';
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
    const defaultIdx = pickDefaultPreset(presets, food.servingSize);
    setQuantityPresets(presets);
    setSelectedPortionIdx(defaultIdx);
    // Set initial unit type tab to the one that contains the default preset.
    const unitTypes = getUnitTypes(presets);
    const defaultUnitType = unitTypes.length > 1
      ? (defaultIdx >= 0 && presets[defaultIdx].unitType) || unitTypes[0]
      : null;
    setSelectedUnitType(defaultUnitType);
    // Manual mode is opt-in — start with chip mode every time.
    setManualMode(false);
    // Default to a single unit; the user bumps it with the count stepper.
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

  const handlePhotoRecognition = useCallback(async () => {
    if (!checkPremiumAccess('food_recognition')) return;

    const { allowed } = await checkDailyLimit('food_recognition');
    if (!allowed) {
      Alert.alert(t.premium.limitReached, t.premium.dailyLimitFoodMsg);
      return;
    }

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
      ? `${(t as any).calorie?.aiEstimateBadge || 'AI tahmini'} · ${food.servingDescription}`
      : (t as any).calorie?.aiEstimateBadge || 'AI tahmini';

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
                        {(t as any).calorie?.aiTotalLabel || 'Tabağın toplamı'}
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

      {/* Manual Barcode Entry Dialog */}
      <Portal>
        <Dialog visible={manualEntryVisible} onDismiss={() => setManualEntryVisible(false)}>
          <Dialog.Title>{t.barcode.manualEntryTitle}</Dialog.Title>
          <Dialog.Content style={{ gap: 8 }}>
            <TextInput
              label={t.barcode.productName}
              value={manualName}
              onChangeText={setManualName}
              mode="outlined"
              dense
              maxLength={100}
            />
            <TextInput
              label={t.barcode.caloriesPer100g}
              value={manualCalories}
              onChangeText={setManualCalories}
              keyboardType="numeric"
              mode="outlined"
              dense
              maxLength={6}
            />
            <TextInput
              label={t.barcode.proteinPer100g}
              value={manualProtein}
              onChangeText={setManualProtein}
              keyboardType="numeric"
              mode="outlined"
              dense
              maxLength={6}
            />
            <TextInput
              label={t.barcode.carbsPer100g}
              value={manualCarbs}
              onChangeText={setManualCarbs}
              keyboardType="numeric"
              mode="outlined"
              dense
              maxLength={6}
            />
            <TextInput
              label={t.barcode.fatPer100g}
              value={manualFat}
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
            setQuantityAmount('');
          }}
        >
          <Dialog.Title>{(t as any).calorie?.quantityPickerTitle || t.calorie.quantityTitle || 'Ne kadar yedin?'}</Dialog.Title>
          <Dialog.Content style={{ gap: 10 }}>
            {selectedFood && (
              <Text style={styles.quantityFoodName} numberOfLines={2}>
                {selectedFood.nameTr || selectedFood.name}
              </Text>
            )}

            {/* Chip grid — only shown in chip mode. */}
            {!manualMode && quantityPresets.length > 0 && (() => {
              const unitTypes = getUnitTypes(quantityPresets);
              const hasMultipleTypes = unitTypes.length > 1;
              const visiblePresets = hasMultipleTypes && selectedUnitType
                ? quantityPresets.filter((p) => p.unitType === selectedUnitType)
                : quantityPresets;

              const ul = (t as any).calorie?.unitLabels ?? {};
              const UNIT_TYPE_LABELS: Record<UnitType, string> = {
                piece: ul.piece ?? 'Adet',
                spoon: ul.spoon ?? 'Kaşık',
                cup: ul.cup ?? 'Bardak',
                bowl: ul.bowl ?? 'Kase',
                slice: ul.slice ?? 'Dilim',
                handful: ul.handful ?? 'Avuç',
                portion: ul.portion ?? 'Porsiyon',
                gram: ul.gram ?? 'Gram',
              };

              return (
                <View style={{ gap: 8 }}>
                  {/* Unit type tab bar — only rendered when >1 type exists */}
                  {hasMultipleTypes && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.unitTypeTabRow}
                    >
                      {unitTypes.map((ut) => {
                        const active = ut === selectedUnitType;
                        return (
                          <TouchableOpacity
                            key={ut}
                            onPress={() => {
                              setSelectedUnitType(ut);
                              // Auto-select first chip of the new type and reset
                              // the count — a fresh unit starts at one.
                              const firstIdx = quantityPresets.findIndex((p) => p.unitType === ut);
                              if (firstIdx >= 0) setSelectedPortionIdx(firstIdx);
                              setQuantityCount('1');
                            }}
                            activeOpacity={0.7}
                            style={[
                              styles.unitTypeTab,
                              active && {
                                backgroundColor: theme.colors.primary,
                                borderColor: theme.colors.primary,
                              },
                            ]}
                          >
                            <Text style={[
                              styles.unitTypeTabText,
                              active && { color: '#fff', fontWeight: '600' },
                            ]}>
                              {UNIT_TYPE_LABELS[ut] ?? ut}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}

                  {/* Portion chips filtered to the active unit type */}
                  <View style={styles.portionChipRow}>
                    {visiblePresets.map((p) => {
                      const globalIdx = quantityPresets.indexOf(p);
                      const active = globalIdx === selectedPortionIdx;
                      return (
                        <TouchableOpacity
                          key={`${p.label}-${globalIdx}`}
                          onPress={() => setSelectedPortionIdx(globalIdx)}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          style={[
                            styles.portionChip,
                            active && {
                              backgroundColor: theme.colors.primaryContainer,
                              borderColor: theme.colors.primary,
                            },
                          ]}
                        >
                          <Text style={[
                            styles.portionChipText,
                            active && { color: theme.colors.primary, fontWeight: '600' },
                          ]}>
                            {p.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })()}

            {/* Count stepper — lets the user say how many of the selected unit
                they had (7 olives, 2 bowls…). Hidden for absolute 'gram' chips
                and in manual mode, where the amount is already exact. */}
            {!manualMode && (() => {
              const preset = quantityPresets[selectedPortionIdx];
              if (!preset || preset.unitType === 'gram') return null;
              const count = clampCount(quantityCount);
              return (
                <View style={styles.countRow}>
                  <Text style={styles.countLabel}>
                    {(t as any).calorie?.countLabel || 'Kaç tane?'}
                  </Text>
                  <View style={styles.countStepper}>
                    <IconButton
                      icon="minus"
                      mode="outlined"
                      size={18}
                      disabled={count <= COUNT_MIN}
                      onPress={() => setQuantityCount(String(clampCount(String(count - 1))))}
                      accessibilityLabel="Decrease count"
                      style={styles.countBtn}
                    />
                    <TextInput
                      value={quantityCount}
                      onChangeText={(v) => setQuantityCount(v.replace(/[^0-9]/g, '').slice(0, 2))}
                      onBlur={() => setQuantityCount(String(clampCount(quantityCount)))}
                      keyboardType="number-pad"
                      mode="outlined"
                      dense
                      textAlign="center"
                      style={styles.countInput}
                      accessibilityLabel="Unit count"
                    />
                    <IconButton
                      icon="plus"
                      mode="outlined"
                      size={18}
                      disabled={count >= COUNT_MAX}
                      onPress={() => setQuantityCount(String(clampCount(String(count + 1))))}
                      accessibilityLabel="Increase count"
                      style={styles.countBtn}
                    />
                  </View>
                </View>
              );
            })()}

            {/* Manual gram input — collapsed by default. */}
            {manualMode && (
              <TextInput
                label={`${t.calorie.quantityAmount || 'Miktar'} (${t.calorie.quantityUnit || 'gram'})`}
                value={quantityAmount}
                onChangeText={setQuantityAmount}
                keyboardType="numeric"
                mode="outlined"
                dense
                maxLength={6}
                right={<TextInput.Affix text={selectedFood?.servingUnit || 'g'} />}
              />
            )}

            {/* Live preview — recomputed whenever the active preset or the
                manual input changes. Mirrors the preview chip in the design
                mockup; gives users immediate feedback on the calorie cost
                of each portion option. */}
            {selectedFood && (() => {
              const g = (() => {
                if (manualMode) return parseFloat((quantityAmount || '0').replace(',', '.'));
                const preset = quantityPresets[selectedPortionIdx];
                if (!preset) return NaN;
                const count = preset.unitType === 'gram' ? 1 : clampCount(quantityCount);
                return preset.grams * count;
              })();
              if (isNaN(g) || g <= 0) return null;
              const ratio = g / 100;
              const kcal = Math.round(selectedFood.calories * ratio);
              const p = Math.round(selectedFood.protein * ratio);
              const c = Math.round(selectedFood.carbs * ratio);
              const f = Math.round(selectedFood.fat * ratio);
              return (
                <View style={styles.quantityPreview}>
                  <Text style={styles.quantityPreviewLabel}>
                    {t.calorie.quantityPreview || 'Tahmini'}
                  </Text>
                  <Text style={styles.quantityPreviewKcal}>
                    {kcal} {t.common.kcal}
                  </Text>
                  <View style={styles.quantityPreviewRow}>
                    <Text style={[styles.quantityPreviewMacro, { color: colors.protein }]}>P:{p}g</Text>
                    <Text style={styles.macroDivider}>&middot;</Text>
                    <Text style={[styles.quantityPreviewMacro, { color: colors.carbs }]}>K:{c}g</Text>
                    <Text style={styles.macroDivider}>&middot;</Text>
                    <Text style={[styles.quantityPreviewMacro, { color: colors.fat }]}>Y:{f}g</Text>
                    <Text style={styles.macroDivider}>&middot;</Text>
                    <Text style={styles.quantityPreviewMacro}>{Math.round(g)} {selectedFood.servingUnit || 'g'}</Text>
                  </View>
                </View>
              );
            })()}

            {/* Mode toggle — links into manual entry for power users, or
                back to chips so a typo in manual mode doesn't trap them. */}
            <TouchableOpacity
              onPress={() => setManualMode((m) => !m)}
              activeOpacity={0.6}
              accessibilityRole="button"
              style={styles.portionModeToggle}
            >
              <Text style={[styles.portionModeToggleText, { color: theme.colors.primary }]}>
                {manualMode 
                  ? (t as any).calorie?.usePresetMode || 'Hazır porsiyonlara dön ▴'
                  : (t as any).calorie?.useManualMode || 'Tam gramajı biliyorum ▾'}
              </Text>
            </TouchableOpacity>
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

  // Quantity Dialog preview
  quantityFoodName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  quantityPreview: {
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  quantityPreviewLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  quantityPreviewKcal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  quantityPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quantityPreviewMacro: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Portion picker chips — household-measure quick selects shown above the
  // preview ("1 dilim", "1 kase", "1 büyük bardak"). The active chip uses
  // the theme's primaryContainer fill via inline style; default state is
  // a thin neutral border so the row reads as a tag cloud, not buttons.
  unitTypeTabRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  unitTypeTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    backgroundColor: 'transparent',
  },
  unitTypeTabText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  portionChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.xs,
  },
  portionChip: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: 'transparent',
  },
  portionChipText: {
    fontSize: 12,
    color: colors.textPrimary,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  countLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  countStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  countBtn: {
    margin: 0,
  },
  countInput: {
    width: 60,
    height: 40,
  },
  portionModeToggle: {
    alignSelf: 'center',
    paddingVertical: 4,
    marginTop: 2,
  },
  portionModeToggleText: {
    fontSize: 12,
    fontWeight: '500',
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
