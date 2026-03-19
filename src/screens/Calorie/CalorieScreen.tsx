import React, { useState, useCallback, useEffect } from 'react';
import { View, ScrollView, StyleSheet, FlatList, TouchableOpacity, Platform } from 'react-native';
import { Text, Card, FAB, Searchbar, Chip, useTheme, IconButton, Button, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useUserStore } from '../../store/userStore';
import { getMealLogsByDate, MealLog, insertMealLog, deleteMealLog } from '../../services/database/mealDao';
import { searchFoodItems, FoodItem } from '../../services/database/foodDao';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { todayString, MEAL_TYPES, formatCalories } from '../../utils/helpers';
import { v4 as uuidv4 } from 'uuid';

export function CalorieScreen() {
  const userId = useUserStore((s) => s.userId);
  const theme = useTheme();
  const [date, setDate] = useState(todayString());
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [activeMealType, setActiveMealType] = useState<string>('breakfast');

  const loadMeals = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const data = await getMealLogsByDate(userId, date);
      setMeals(data);
    } catch (e) {
      console.warn('loadMeals failed:', e);
    }
  }, [userId, date]);

  useEffect(() => { loadMeals(); }, [loadMeals]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (Platform.OS === 'web') return;
    if (query.length >= 2) {
      try {
        const results = await searchFoodItems(query);
        setSearchResults(results);
      } catch (e) {
        console.warn('searchFoodItems failed:', e);
      }
    } else {
      setSearchResults([]);
    }
  }, []);

  const handleAddFood = useCallback(async (food: FoodItem) => {
    if (Platform.OS === 'web') return;
    try {
      const meal: MealLog = {
        id: uuidv4(), userId, date, mealType: activeMealType as any,
        foodItemId: food.id, servingAmount: food.servingSize, servingUnit: food.servingUnit,
        caloriesConsumed: food.calories * food.servingSize / 100,
        proteinConsumed: food.protein * food.servingSize / 100,
        carbsConsumed: food.carbs * food.servingSize / 100,
        fatConsumed: food.fat * food.servingSize / 100,
        createdAt: Date.now(),
      };
      await insertMealLog(meal);
      setSearchVisible(false);
      setSearchQuery('');
      loadMeals();
    } catch (e) {
      console.warn('handleAddFood failed:', e);
    }
  }, [userId, date, activeMealType, loadMeals]);

  const handleDelete = useCallback(async (id: string) => {
    if (Platform.OS === 'web') return;
    try {
      await deleteMealLog(id);
      loadMeals();
    } catch (e) {
      console.warn('handleDelete failed:', e);
    }
  }, [loadMeals]);

  const totalCalories = meals.reduce((s, m) => s + m.caloriesConsumed, 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
      <Text style={styles.totalText}>Toplam: {formatCalories(totalCalories)}</Text>

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
                    <Text variant="titleSmall" style={{ fontWeight: 'bold', marginLeft: 8 }}>{mt.label}</Text>
                  </View>
                  <Text style={{ color: '#999', fontSize: 12 }}>{Math.round(sectionCal)} kcal</Text>
                </View>

                {sectionMeals.map((m) => (
                  <View key={m.id} style={styles.mealItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14 }}>{m.foodItemId}</Text>
                      <Text style={{ color: '#999', fontSize: 11 }}>
                        {Math.round(m.caloriesConsumed)} kcal · P:{Math.round(m.proteinConsumed)}g · K:{Math.round(m.carbsConsumed)}g · Y:{Math.round(m.fatConsumed)}g
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
                  Besin ekle
                </Button>
              </Card.Content>
            </Card>
          );
        })}
      </ScrollView>

      {/* Search Modal */}
      {searchVisible && (
        <View style={styles.searchOverlay}>
          <View style={styles.searchContainer}>
            <View style={styles.rowBetween}>
              <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Besin Ara</Text>
              <IconButton icon="close" onPress={() => setSearchVisible(false)} />
            </View>
            <Searchbar
              placeholder="Yemek ara..."
              value={searchQuery}
              onChangeText={handleSearch}
              style={{ marginBottom: spacing.sm }}
            />
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => handleAddFood(item)} style={styles.searchItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600' }}>{item.nameTr || item.name}</Text>
                    <Text style={{ color: '#999', fontSize: 11 }}>
                      {item.calories} kcal/100g · P:{item.protein}g · K:{item.carbs}g · Y:{item.fat}g
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="plus-circle" size={24} color={colors.primary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                searchQuery.length >= 2 ? <Text style={{ textAlign: 'center', color: '#999' }}>Sonuç bulunamadı</Text> : null
              }
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dateRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: spacing.sm },
  totalText: { textAlign: 'center', fontSize: 14, color: '#999', marginBottom: spacing.sm },
  mealCard: { borderRadius: borderRadius.lg, marginHorizontal: spacing.md, marginBottom: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  searchOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  searchContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.md, maxHeight: '80%' },
  searchItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
});
