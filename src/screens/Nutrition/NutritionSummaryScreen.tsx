import React, { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Platform } from 'react-native';
import { Text, Card, Chip, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { format, subDays } from 'date-fns';
import { useUserStore } from '../../store/userStore';
import { useMealStore } from '../../store/mealStore';
import { getMealLogsByDate, MealLog } from '../../services/database/mealDao';
import { getUserById } from '../../services/database/userDao';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';
import { usePremiumStore } from '../../store/premiumStore';
import { isProgressRangeAvailable } from '../../services/premium/featureGate';
import { PaywallModal } from '../../components/PaywallModal';
import { AdBanner } from '../../components/AdBanner';

type FilterRange = '7d' | '30d';

export function NutritionSummaryScreen() {
  const userId = useUserStore((s) => s.userId);
  const { meals: webMeals } = useMealStore();
  const theme = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [allMeals, setAllMeals] = useState<MealLog[]>([]);
  const [filter, setFilter] = useState<FilterRange>('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const isPremium = usePremiumStore((s) => s.isPremium);

  const days = filter === '7d' ? 7 : 30;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      // Load user targets from DB
      if (Platform.OS !== 'web') {
        const user = await getUserById(userId);
        if (user) {
          setCalorieTarget(user.tdee || 2000);
          setProteinTarget(user.proteinTargetG || 150);
        }
      }
      const meals: MealLog[] = [];
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        if (Platform.OS === 'web') {
          meals.push(...webMeals.filter((m) => m.date === date));
        } else {
          const dayMeals = await getMealLogsByDate(userId, date);
          meals.push(...dayMeals);
        }
      }
      setAllMeals(meals);
    } catch (e) {
      if (__DEV__) console.warn('NutritionSummary load failed:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId, days, webMeals]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const stats = useMemo(() => {
    const totalCalories = allMeals.reduce((s, m) => s + m.caloriesConsumed, 0);
    const totalProtein = allMeals.reduce((s, m) => s + m.proteinConsumed, 0);
    const totalCarbs = allMeals.reduce((s, m) => s + m.carbsConsumed, 0);
    const totalFat = allMeals.reduce((s, m) => s + m.fatConsumed, 0);
    const daysWithData = new Set(allMeals.map((m) => m.date)).size;
    const avgCalories = daysWithData > 0 ? Math.round(totalCalories / daysWithData) : 0;
    const avgProtein = daysWithData > 0 ? Math.round(totalProtein / daysWithData) : 0;
    const avgCarbs = daysWithData > 0 ? Math.round(totalCarbs / daysWithData) : 0;
    const avgFat = daysWithData > 0 ? Math.round(totalFat / daysWithData) : 0;

    // Meal type distribution
    const mealTypeCounts: Record<string, number> = {};
    allMeals.forEach((m) => {
      mealTypeCounts[m.mealType] = (mealTypeCounts[m.mealType] || 0) + 1;
    });

    return {
      totalCalories: Math.round(totalCalories),
      totalProtein: Math.round(totalProtein),
      totalCarbs: Math.round(totalCarbs),
      totalFat: Math.round(totalFat),
      avgCalories,
      avgProtein,
      avgCarbs,
      avgFat,
      totalMeals: allMeals.length,
      daysWithData,
      mealTypeCounts,
    };
  }, [allMeals]);

  const [calorieTarget, setCalorieTarget] = useState(2000);
  const [proteinTarget, setProteinTarget] = useState(150);

  const filters: { key: FilterRange; label: string }[] = [
    { key: '7d', label: t.progress.days7 },
    { key: '30d', label: t.progress.days30 },
  ];

  const mealTypeLabels: Record<string, string> = {
    breakfast: t.calorie.breakfast,
    lunch: t.calorie.lunch,
    dinner: t.calorie.dinner,
    snack: t.calorie.snack,
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 40 }}
    >
      {/* Filter */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <Chip
            key={f.key}
            selected={filter === f.key}
            onPress={() => {
              if (!isProgressRangeAvailable(f.key)) {
                setPaywallVisible(true);
                return;
              }
              setFilter(f.key);
            }}
            compact
            textStyle={{ fontSize: 12 }}
          >
            {f.label}{!isPremium && f.key !== '7d' ? ' 🔒' : ''}
          </Chip>
        ))}
      </View>

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} feature="progress_analysis" />

      {loading ? (
        <View style={styles.emptyState}>
          <Text style={{ color: colors.textTertiary }}>{t.common.loading}</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#F44336" />
          <Text style={{ color: colors.textTertiary, marginTop: spacing.sm }}>{t.common.errorOccurred}</Text>
        </View>
      ) : (
        <>
          {/* Average Daily Intake */}
          <Card style={styles.card} mode="elevated">
            <Card.Content>
              <Text style={styles.cardTitle}>{t.progress.avgCalories}</Text>
              <View style={styles.avgRow}>
                <View style={styles.avgItem}>
                  <Text style={[styles.avgValue, { color: colors.primary }]}>{stats.avgCalories}</Text>
                  <Text style={styles.avgLabel}>{t.common.kcal}/{t.common.day}</Text>
                  <ProgressBar current={stats.avgCalories} target={calorieTarget} color={colors.primary} />
                </View>
                <View style={styles.avgItem}>
                  <Text style={[styles.avgValue, { color: colors.protein }]}>{stats.avgProtein}g</Text>
                  <Text style={styles.avgLabel}>{t.dashboard.protein}/{t.common.day}</Text>
                  <ProgressBar current={stats.avgProtein} target={proteinTarget} color={colors.protein} />
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Macro Breakdown */}
          <Card style={styles.card} mode="elevated">
            <Card.Content>
              <Text style={styles.cardTitle}>{t.dashboard.macronutrients}</Text>
              <View style={styles.macroGrid}>
                <MacroItem label={t.dashboard.protein} value={stats.totalProtein} unit="g" color={colors.protein} icon="food-steak" />
                <MacroItem label={t.dashboard.carbs} value={stats.totalCarbs} unit="g" color={colors.carbs} icon="bread-slice" />
                <MacroItem label={t.dashboard.fat} value={stats.totalFat} unit="g" color={colors.fat} icon="water" />
              </View>
              <View style={styles.macroBarContainer}>
                {stats.totalProtein + stats.totalCarbs + stats.totalFat > 0 && (
                  <View style={styles.macroBarRow}>
                    <View style={[styles.macroBarSegment, { flex: stats.totalProtein, backgroundColor: colors.protein }]} />
                    <View style={[styles.macroBarSegment, { flex: stats.totalCarbs, backgroundColor: colors.carbs }]} />
                    <View style={[styles.macroBarSegment, { flex: stats.totalFat, backgroundColor: colors.fat }]} />
                  </View>
                )}
              </View>
            </Card.Content>
          </Card>

          {/* Meal Distribution */}
          <Card style={styles.card} mode="elevated">
            <Card.Content>
              <Text style={styles.cardTitle}>{t.calorie.total}: {stats.totalMeals}</Text>
              <View style={styles.mealDistRow}>
                {Object.entries(stats.mealTypeCounts).map(([type, count]) => (
                  <View key={type} style={styles.mealDistItem}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: colors.primary }}>{count}</Text>
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>{mealTypeLabels[type] || type}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: spacing.sm }}>
                {stats.daysWithData} {t.progress.activeDays}
              </Text>
            </Card.Content>
          </Card>

          {/* Period Totals */}
          <Card style={styles.card} mode="elevated">
            <Card.Content>
              <Text style={styles.cardTitle}>{t.progress.report}</Text>
              <View style={styles.totalRow}>
                <TotalItem icon="fire" label={t.common.kcal} value={stats.totalCalories.toLocaleString()} color={colors.orange} />
                <TotalItem icon="food-steak" label={t.dashboard.protein} value={`${stats.totalProtein}g`} color={colors.protein} />
                <TotalItem icon="bread-slice" label={t.dashboard.carbs} value={`${stats.totalCarbs}g`} color={colors.carbs} />
                <TotalItem icon="water" label={t.dashboard.fat} value={`${stats.totalFat}g`} color={colors.fat} />
              </View>
            </Card.Content>
          </Card>

          {/* Reklam Banner */}
          <AdBanner screen="nutrition" />
        </>
      )}
    </ScrollView>
  );
}

function ProgressBar({ current, target, color }: { current: number; target: number; color: string }) {
  const progress = target > 0 ? Math.min(current / target, 1) : 0;
  return (
    <View style={styles.progressBg}>
      <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

function MacroItem({ label, value, unit, color, icon }: { label: string; value: number; unit: string; color: string; icon: string }) {
  return (
    <View style={styles.macroItem}>
      <MaterialCommunityIcons name={icon as any} size={20} color={color} />
      <Text style={[styles.macroValue, { color }]}>{value}{unit}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

function TotalItem({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={styles.totalItem}>
      <MaterialCommunityIcons name={icon as any} size={18} color={color} />
      <Text style={{ fontWeight: '600', fontSize: 14, marginTop: 2 }}>{value}</Text>
      <Text style={{ fontSize: 10, color: colors.textTertiary }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  card: { borderRadius: borderRadius.lg, marginBottom: spacing.md },
  cardTitle: { fontWeight: 'bold', marginBottom: spacing.sm },
  avgRow: { flexDirection: 'row', gap: spacing.md },
  avgItem: { flex: 1, alignItems: 'center' },
  avgValue: { fontSize: 24, fontWeight: 'bold' },
  avgLabel: { fontSize: 11, color: colors.textTertiary, marginTop: 2, marginBottom: 6 },
  progressBg: { height: 6, borderRadius: 3, backgroundColor: colors.border, width: '100%' },
  progressFill: { height: 6, borderRadius: 3 },
  macroGrid: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.sm },
  macroItem: { alignItems: 'center' },
  macroValue: { fontWeight: 'bold', fontSize: 16, marginTop: 4 },
  macroLabel: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  macroBarContainer: { marginTop: spacing.sm },
  macroBarRow: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  macroBarSegment: { height: 8 },
  mealDistRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.sm },
  mealDistItem: { alignItems: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-around' },
  totalItem: { alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
});
