import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, ScrollView, StyleSheet, FlatList, TouchableOpacity, Platform, Alert } from 'react-native';
import { Text, Card, FAB, Searchbar, Chip, useTheme, IconButton, Button, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '../../store/userStore';
import { useMealStore } from '../../store/mealStore';
import { getMealLogsByDate, MealLog, insertMealLog, deleteMealLog } from '../../services/database/mealDao';
import { searchFoodItems, FoodItem } from '../../services/database/foodDao';
import { getProductByBarcode } from '../../services/api/openFoodFacts';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { recognizeFoodFromImage, RecognizedFood } from '../../services/ai/foodRecognition';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { todayString, MEAL_TYPES, formatCalories, generateId } from '../../utils/helpers';
import { useLanguage } from '../../i18n';
import { usePremiumStore } from '../../store/premiumStore';
import { checkUsageLimit, recordFeatureUsage } from '../../services/premium/featureGate';
import { PaywallModal } from '../../components/PaywallModal';

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
    }));
}

const MEAL_TYPE_KEYS: Record<string, 'breakfast' | 'lunch' | 'dinner' | 'snack'> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snack',
};

export function CalorieScreen() {
  const userId = useUserStore((s) => s.userId);
  const { meals: webMeals, addMeal: addWebMeal, removeMeal: removeWebMeal } = useMealStore();
  const theme = useTheme();
  const { t } = useLanguage();
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

  const loadMeals = useCallback(async () => {
    if (Platform.OS === 'web') {
      setMeals(webMeals.filter((m) => m.date === date));
      return;
    }
    try {
      const data = await getMealLogsByDate(userId, date);
      setMeals(data);
    } catch (e) {
      if (__DEV__) console.warn('loadMeals failed:', e);
    }
  }, [userId, date, webMeals]);

  useEffect(() => { loadMeals(); }, [loadMeals]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      try {
        if (Platform.OS === 'web') {
          setSearchResults(searchFoodsLocal(query));
        } else {
          const results = await searchFoodItems(query);
          setSearchResults(results);
        }
      } catch (e) {
        if (__DEV__) console.warn('searchFoodItems failed:', e);
      }
    } else {
      setSearchResults([]);
    }
  }, []);

  const handleAddFood = useCallback(async (food: FoodItem) => {
    try {
      const meal: MealLog = {
        id: generateId(), userId, date, mealType: activeMealType as any,
        foodItemId: food.nameTr || food.name, servingAmount: food.servingSize, servingUnit: food.servingUnit,
        caloriesConsumed: food.calories * food.servingSize / 100,
        proteinConsumed: food.protein * food.servingSize / 100,
        carbsConsumed: food.carbs * food.servingSize / 100,
        fatConsumed: food.fat * food.servingSize / 100,
        createdAt: Date.now(),
      };
      if (Platform.OS === 'web') {
        addWebMeal(meal);
      } else {
        await insertMealLog(meal);
        loadMeals();
      }
      setSearchVisible(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (e) {
      if (__DEV__) console.warn('handleAddFood failed:', e);
    }
  }, [userId, date, activeMealType, loadMeals]);

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

  const checkBarcodeAccess = useCallback(async (): Promise<boolean> => {
    if (isPremium) return true;
    const usage = await checkUsageLimit('barcode_scanner');
    if (!usage.allowed) {
      setPaywallFeature('barcode_scanner');
      setPaywallVisible(true);
      return false;
    }
    return true;
  }, [isPremium]);

  const checkFoodRecognitionAccess = useCallback(async (): Promise<boolean> => {
    if (isPremium) return true;
    const usage = await checkUsageLimit('food_recognition');
    if (!usage.allowed) {
      setPaywallFeature('food_recognition');
      setPaywallVisible(true);
      return false;
    }
    return true;
  }, [isPremium]);

  const handleBarcodeScan = useCallback(async (barcode: string) => {
    setBarcodeLoading(true);
    try {
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
        };
        setBarcodeVisible(false);
        setBarcodeLoading(false);
        await recordFeatureUsage('barcode_scanner');
        handleAddFood(food);
      } else {
        setBarcodeLoading(false);
        Alert.alert('', t.barcode.notFound);
      }
    } catch (e) {
      setBarcodeLoading(false);
      Alert.alert(t.common.error, t.barcode.notFound);
    }
  }, [activeMealType, handleAddFood, t]);

  const handlePhotoRecognition = useCallback(async () => {
    // Check premium usage limit
    const canAccess = await checkFoodRecognitionAccess();
    if (!canAccess) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets[0]) return;

      setAiLoading(true);
      setAiModalVisible(true);
      const foods = await recognizeFoodFromImage(result.assets[0].uri);
      setAiResults(foods);
      setAiLoading(false);
      await recordFeatureUsage('food_recognition');
    } catch (e: any) {
      setAiLoading(false);
      Alert.alert(t.common.error, e.message || 'AI besin tanıma başarısız');
    }
  }, [t]);

  const handleAddAiFood = useCallback((food: RecognizedFood) => {
    const foodItem: FoodItem = {
      id: `ai_${Date.now()}_${food.name}`,
      name: food.name,
      nameTr: food.name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: null,
      sugar: null,
      barcode: null,
      servingSize: food.servingSize,
      servingUnit: food.servingUnit,
      isCustom: false,
      isFavorite: false,
      source: 'ai_recognition',
    };
    handleAddFood(foodItem);
    setAiModalVisible(false);
    setAiResults([]);
  }, [handleAddFood]);

  const totalCalories = useMemo(() => meals.reduce((s, m) => s + m.caloriesConsumed, 0), [meals]);

  const getMealLabel = (key: string): string => {
    const labelKey = MEAL_TYPE_KEYS[key];
    return labelKey ? t.calorie[labelKey] : key;
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      {/* Date Header */}
      <View style={styles.dateRow}>
        <IconButton icon="chevron-left" onPress={() => {
          const d = new Date(date);
          d.setDate(d.getDate() - 1);
          setDate(d.toISOString().split('T')[0]);
        }} />
        <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{date}</Text>
        <IconButton icon="chevron-right" onPress={() => {
          const d = new Date(date);
          d.setDate(d.getDate() + 1);
          setDate(d.toISOString().split('T')[0]);
        }} />
      </View>

      {/* Total */}
      <Text style={styles.totalText}>{t.calorie.total}: {formatCalories(totalCalories)}</Text>

      {/* Meal sections */}
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {MEAL_TYPES.map((mt) => {
          const sectionMeals = meals.filter((m) => m.mealType === mt.key);
          const sectionCal = sectionMeals.reduce((s, m) => s + m.caloriesConsumed, 0);

          return (
            <Card key={mt.key} style={styles.mealCard} mode="elevated">
              <Card.Content>
                <View style={styles.rowBetween}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name={mt.icon as any} size={20} color={colors.primary} />
                    <Text variant="titleSmall" style={{ fontWeight: 'bold', marginLeft: 8 }}>{getMealLabel(mt.key)}</Text>
                  </View>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{Math.round(sectionCal)} {t.common.kcal}</Text>
                </View>

                {sectionMeals.map((m) => (
                  <View key={m.id} style={styles.mealItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14 }}>{m.foodItemId}</Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
                        {Math.round(m.caloriesConsumed)} {t.common.kcal} · P:{Math.round(m.proteinConsumed)}g · K:{Math.round(m.carbsConsumed)}g · Y:{Math.round(m.fatConsumed)}g
                      </Text>
                    </View>
                    <IconButton icon="delete-outline" size={18} onPress={() => handleDelete(m.id)} />
                  </View>
                ))}

                <Button
                  mode="text"
                  icon="plus"
                  onPress={() => { setActiveMealType(mt.key); setSearchVisible(true); }}
                  compact
                >
                  {t.calorie.addFood}
                </Button>
              </Card.Content>
            </Card>
          );
        })}
      </ScrollView>

      {/* AI Food Recognition Modal */}
      {aiModalVisible && (
        <View style={styles.searchOverlay}>
          <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.rowBetween}>
              <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
                {'AI Besin Tanıma'}
              </Text>
              <IconButton icon="close" onPress={() => { setAiModalVisible(false); setAiResults([]); }} />
            </View>
            {aiLoading ? (
              <View style={{ alignItems: 'center', padding: 40 }}>
                <Text style={{ color: colors.textTertiary }}>{t.common.loading}</Text>
              </View>
            ) : aiResults.length === 0 ? (
              <Text style={{ textAlign: 'center', color: colors.textTertiary, padding: 20 }}>{t.calorie.noResults}</Text>
            ) : (
              <FlatList
                data={aiResults}
                keyExtractor={(_, i) => `ai_${i}`}
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => handleAddAiFood(item)} style={styles.searchItem}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontWeight: '600' }}>{item.name}</Text>
                        <View style={{ backgroundColor: item.confidence === 'high' ? colors.successBg : item.confidence === 'medium' ? colors.warningBg : colors.errorBg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                          <Text style={{ fontSize: 9, color: item.confidence === 'high' ? '#2E7D32' : item.confidence === 'medium' ? '#E65100' : '#C62828' }}>
                            {item.confidence}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
                        {item.calories} {t.common.kcal} · P:{item.protein}g · K:{item.carbs}g · Y:{item.fat}g
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="plus-circle" size={24} color={colors.primary} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
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
        <View style={styles.searchOverlay}>
          <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.rowBetween}>
              <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{t.calorie.searchFood}</Text>
              <IconButton icon="close" onPress={() => setSearchVisible(false)} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}>
              <Searchbar
                placeholder={t.calorie.searchPlaceholder}
                value={searchQuery}
                onChangeText={handleSearch}
                style={{ flex: 1 }}
              />
              {Platform.OS !== 'web' && (
                <>
                  <TouchableOpacity
                    style={styles.barcodeBtn}
                    onPress={async () => {
                      const canAccess = await checkBarcodeAccess();
                      if (canAccess) { setSearchVisible(false); setBarcodeVisible(true); }
                    }}
                  >
                    <MaterialCommunityIcons name="barcode-scan" size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.barcodeBtn, { backgroundColor: colors.orange }]}
                    onPress={() => { setSearchVisible(false); handlePhotoRecognition(); }}
                  >
                    <MaterialCommunityIcons name="camera" size={24} color="#fff" />
                  </TouchableOpacity>
                </>
              )}
            </View>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => handleAddFood(item)} style={styles.searchItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600' }}>{item.nameTr || item.name}</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
                      {item.calories} {t.common.kcal}/100g · P:{item.protein}g · K:{item.carbs}g · Y:{item.fat}g
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="plus-circle" size={24} color={colors.primary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                searchQuery.length >= 2 ? <Text style={{ textAlign: 'center', color: colors.textTertiary }}>{t.calorie.noResults}</Text> : null
              }
            />
          </View>
        </View>
      )}
      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} feature={paywallFeature} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dateRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: spacing.sm },
  totalText: { textAlign: 'center', fontSize: 14, color: colors.textTertiary, marginBottom: spacing.sm },
  mealCard: { borderRadius: borderRadius.lg, marginHorizontal: spacing.md, marginBottom: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: colors.divider },
  searchOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  searchContainer: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.md, maxHeight: '80%' },
  searchItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.divider },
  barcodeBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
});
