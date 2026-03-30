import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Dimensions, Platform, ActivityIndicator } from 'react-native';
import { Text, Card, Button, SegmentedButtons, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { format, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useUserStore } from '../../store/userStore';
import { getAllMetrics } from '../../services/database/progressDao';
import { getMealLogsByDateRange } from '../../services/database/mealDao';
import { getSessionsByDateRange } from '../../services/database/workoutDao';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';
import { usePremiumStore } from '../../store/premiumStore';
import { isProgressRangeAvailable } from '../../services/premium/featureGate';
import { PaywallModal } from '../../components/PaywallModal';

const screenWidth = Dimensions.get('window').width - spacing.md * 2;

const chartConfig = {
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(100, 100, 100, ${opacity})`,
  propsForDots: { r: '4', strokeWidth: '2', stroke: colors.primary },
};

const calorieChartConfig = {
  ...chartConfig,
  color: (opacity = 1) => `rgba(255, 152, 0, ${opacity})`,
  propsForDots: { r: '3', strokeWidth: '1', stroke: colors.orange },
};

function getPeriodDays(period: string): number {
  if (period === '7') return 7;
  if (period === '30') return 30;
  if (period === '90') return 90;
  return 365;
}

export function ProgressScreen() {
  const userId = useUserStore((s) => s.userId);
  const theme = useTheme();
  const { t } = useLanguage();
  const [period, setPeriod] = useState('30');

  const [weightData, setWeightData] = useState<{ labels: string[]; values: number[] }>({ labels: [], values: [] });
  const [calorieData, setCalorieData] = useState<{ labels: string[]; values: number[] }>({ labels: [], values: [] });
  const [stats, setStats] = useState({ totalWorkouts: 0, totalBurned: 0, longestStreak: 0, weightChange: 0 });
  const [macroAvg, setMacroAvg] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0, activeDays: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const isPremium = usePremiumStore((s) => s.isPremium);

  const loadData = useCallback(async () => {
    if (Platform.OS === 'web') {
      setLoading(false);
      setWeightData({ labels: [], values: [] });
      setCalorieData({ labels: [], values: [] });
      return;
    }
    try {
      setLoading(true);
      setError(false);
      const days = getPeriodDays(period);
      const startDate = format(subDays(new Date(), days - 1), 'yyyy-MM-dd');
      const endDate = format(new Date(), 'yyyy-MM-dd');

      const [metrics, mealLogs, sessions] = await Promise.all([
        getAllMetrics(userId),
        getMealLogsByDateRange(userId, startDate, endDate),
        getSessionsByDateRange(userId, startDate, endDate),
      ]);

      // Weight chart — filter to period, take last 10
      const periodMetrics = metrics.filter((m) => m.date >= startDate && m.date <= endDate);
      const recentMetrics = periodMetrics.slice(-10);
      if (recentMetrics.length > 0) {
        setWeightData({
          labels: recentMetrics.map((m) => format(new Date(m.date), 'dd/MM', { locale: tr })),
          values: recentMetrics.map((m) => m.weight),
        });
      } else {
        setWeightData({ labels: [], values: [] });
      }

      // Calorie chart — aggregate by date, take last 14 days
      const calByDate: Record<string, number> = {};
      mealLogs.forEach((m) => {
        calByDate[m.date] = (calByDate[m.date] ?? 0) + m.caloriesConsumed;
      });
      const sortedDates = Object.keys(calByDate).sort().slice(-14);
      if (sortedDates.length > 0) {
        setCalorieData({
          labels: sortedDates.map((d) => format(new Date(d), 'dd/MM', { locale: tr })),
          values: sortedDates.map((d) => Math.round(calByDate[d])),
        });
      } else {
        setCalorieData({ labels: [], values: [] });
      }

      // Stats
      const completedSessions = sessions.filter((s) => s.completedAt !== null);
      const totalWorkouts = completedSessions.length;
      const totalBurned = completedSessions.reduce((s, w) => s + w.caloriesBurned, 0);

      // Longest streak in period
      const activeDates = new Set<string>();
      mealLogs.forEach((m) => activeDates.add(m.date));
      completedSessions.forEach((s) => activeDates.add(s.date));
      let longestStreak = 0;
      let currentStreak = 0;
      for (let i = days - 1; i >= 0; i--) {
        const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
        if (activeDates.has(d)) {
          currentStreak++;
          if (currentStreak > longestStreak) longestStreak = currentStreak;
        } else {
          currentStreak = 0;
        }
      }

      // Weight change
      let weightChange = 0;
      if (periodMetrics.length >= 2) {
        weightChange = parseFloat((periodMetrics[periodMetrics.length - 1].weight - periodMetrics[0].weight).toFixed(1));
      }

      // Macro averages
      const uniqueMealDays = new Set(mealLogs.map((m) => m.date));
      const mealDayCount = uniqueMealDays.size || 1;
      const totalCal = mealLogs.reduce((s, m) => s + m.caloriesConsumed, 0);
      const totalProt = mealLogs.reduce((s, m) => s + m.proteinConsumed, 0);
      const totalCarbs = mealLogs.reduce((s, m) => s + m.carbsConsumed, 0);
      const totalFat = mealLogs.reduce((s, m) => s + m.fatConsumed, 0);
      setMacroAvg({
        calories: Math.round(totalCal / mealDayCount),
        protein: Math.round(totalProt / mealDayCount),
        carbs: Math.round(totalCarbs / mealDayCount),
        fat: Math.round(totalFat / mealDayCount),
        activeDays: activeDates.size,
      });

      setStats({ totalWorkouts, totalBurned, longestStreak, weightChange });
    } catch (e) {
      if (__DEV__) console.warn('ProgressScreen load error:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId, period]);

  useEffect(() => { loadData(); }, [loadData]);

  const weightSign = stats.weightChange > 0 ? '+' : '';

  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingTop: insets.top + spacing.md, paddingBottom: 100 }}
    >
      <Text variant="headlineSmall" style={styles.title} accessibilityRole="header" accessibilityLabel="Progress">{t.progress.title}</Text>

      <SegmentedButtons
        value={period}
        onValueChange={(v) => {
          const rangeKey = v === '7' ? '7d' : v === '30' ? '30d' : v === '90' ? '90d' : 'all';
          if (!isProgressRangeAvailable(rangeKey)) {
            setPaywallVisible(true);
            return;
          }
          setPeriod(v);
        }}
        buttons={[
          { value: '7', label: t.progress.days7 },
          { value: '30', label: isPremium ? t.progress.days30 : `${t.progress.days30} (PRO)` },
          { value: '90', label: isPremium ? t.progress.days90 : `${t.progress.days90} (PRO)` },
          { value: 'all', label: isPremium ? t.progress.all : `${t.progress.all} (PRO)` },
        ]}
        style={{ marginBottom: spacing.md }}
      />

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} feature="progress_analysis" />

      {loading && (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textTertiary, marginTop: spacing.sm }}>{t.common.loading}</Text>
        </View>
      )}

      {error && !loading && (
        <View style={styles.centerState}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#F44336" />
          <Text style={{ color: colors.textTertiary, marginTop: spacing.sm, textAlign: 'center' }}>{t.common.errorOccurred}</Text>
          <Button mode="outlined" onPress={loadData} style={{ marginTop: spacing.md }}>{t.common.retry}</Button>
        </View>
      )}

      {!loading && !error && (<>
      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard icon="dumbbell" label={t.progress.totalWorkouts} value={`${stats.totalWorkouts}`} color={colors.primary} />
        <StatCard icon="fire" label={t.progress.burnedCalories} value={`${stats.totalBurned}`} color={colors.orange} />
        <StatCard icon="trending-up" label={t.progress.longestStreak} value={`${stats.longestStreak} ${t.common.days}`} color={colors.secondary} />
        <StatCard icon="scale-bathroom" label={t.progress.weightChange} value={`${weightSign}${stats.weightChange} ${t.common.kg}`} color={colors.purple} />
      </View>

      {/* Macro Averages Report */}
      <Card style={styles.chartCard} mode="elevated">
        <Card.Content>
          <Text style={styles.chartTitle}>{t.progress.report}</Text>
          <View style={styles.reportGrid}>
            <ReportItem icon="fire" label={t.progress.avgCalories} value={`${macroAvg.calories}`} unit={t.common.kcal} color={colors.orange} />
            <ReportItem icon="food-steak" label={t.dashboard.protein} value={`${macroAvg.protein}g`} unit="" color={colors.protein} />
            <ReportItem icon="barley" label={t.dashboard.carbs} value={`${macroAvg.carbs}g`} unit="" color={colors.carbs} />
            <ReportItem icon="oil" label={t.dashboard.fat} value={`${macroAvg.fat}g`} unit="" color={colors.fat} />
          </View>
          <View style={styles.reportFooter}>
            <MaterialCommunityIcons name="calendar-check" size={16} color={colors.primary} />
            <Text style={styles.reportFooterText}>
              {macroAvg.activeDays} {t.progress.activeDays || 'aktif gün'}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Weight Chart */}
      <Card style={styles.chartCard} mode="elevated">
        <Card.Content>
          <Text style={styles.chartTitle}>{t.progress.weightTrend}</Text>
          {weightData.values.length >= 2 ? (
            <LineChart
              data={{ labels: weightData.labels, datasets: [{ data: weightData.values }] }}
              width={screenWidth - spacing.md * 2}
              height={200}
              chartConfig={chartConfig}
              bezier
              style={{ borderRadius: borderRadius.md }}
              yAxisSuffix={` ${t.common.kg}`}
              withInnerLines={false}
            />
          ) : (
            <EmptyChart icon="chart-line" message={t.progress.weightHint} />
          )}
        </Card.Content>
      </Card>

      {/* Calorie Chart */}
      <Card style={styles.chartCard} mode="elevated">
        <Card.Content>
          <Text style={styles.chartTitle}>{t.progress.dailyCalories}</Text>
          {calorieData.values.length >= 2 ? (
            <BarChart
              data={{ labels: calorieData.labels, datasets: [{ data: calorieData.values }] }}
              width={screenWidth - spacing.md * 2}
              height={200}
              chartConfig={calorieChartConfig}
              style={{ borderRadius: borderRadius.md }}
              yAxisSuffix=""
              yAxisLabel=""
              withInnerLines={false}
              showValuesOnTopOfBars={false}
            />
          ) : (
            <EmptyChart icon="chart-bar" message={t.progress.calorieHint} />
          )}
        </Card.Content>
      </Card>
      </>)}
    </ScrollView>
  );
}

const StatCard = React.memo(function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <Card style={styles.statCard} mode="elevated">
      <Card.Content style={{ alignItems: 'center' }}>
        <MaterialCommunityIcons name={icon as any} size={28} color={color} />
        <Text style={{ fontWeight: 'bold', fontSize: 18, marginTop: 4 }}>{value}</Text>
        <Text style={{ color: colors.textTertiary, fontSize: 11, textAlign: 'center' }}>{label}</Text>
      </Card.Content>
    </Card>
  );
});

const ReportItem = React.memo(function ReportItem({ icon, label, value, unit, color }: { icon: string; label: string; value: string; unit: string; color: string }) {
  return (
    <View style={styles.reportItem}>
      <MaterialCommunityIcons name={icon as any} size={20} color={color} />
      <Text style={{ fontWeight: 'bold', fontSize: 16, color, marginTop: 2 }}>{value}{unit ? ` ${unit}` : ''}</Text>
      <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{label}</Text>
    </View>
  );
});

const EmptyChart = React.memo(function EmptyChart({ icon, message }: { icon: string; message: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
      <MaterialCommunityIcons name={icon as any} size={48} color={colors.textDisabled} />
      <Text style={{ color: colors.textTertiary, marginTop: spacing.sm, textAlign: 'center', fontSize: 13 }}>{message}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontWeight: 'bold', marginBottom: spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { width: '48%' as any, borderRadius: borderRadius.md },
  chartCard: { borderRadius: borderRadius.lg, marginBottom: spacing.md },
  chartTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: spacing.sm },
  reportGrid: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.sm },
  reportItem: { alignItems: 'center', flex: 1 },
  reportFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  reportFooterText: { fontSize: 13, color: colors.textSecondary },
  centerState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 },
});
