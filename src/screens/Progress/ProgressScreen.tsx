import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Dimensions, Platform } from 'react-native';
import { Text, Card, SegmentedButtons, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { format, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useUserStore } from '../../store/userStore';
import { getAllMetrics } from '../../services/database/progressDao';
import { getMealLogsByDateRange } from '../../services/database/mealDao';
import { getSessionsByDateRange } from '../../services/database/workoutDao';
import { colors, spacing, borderRadius } from '../../theme/theme';

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
  const [period, setPeriod] = useState('30');

  const [weightData, setWeightData] = useState<{ labels: string[]; values: number[] }>({ labels: [], values: [] });
  const [calorieData, setCalorieData] = useState<{ labels: string[]; values: number[] }>({ labels: [], values: [] });
  const [stats, setStats] = useState({ totalWorkouts: 0, totalBurned: 0, longestStreak: 0, weightChange: 0 });
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (Platform.OS === 'web') { setLoading(false); return; }
    try {
      setLoading(true);
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

      setStats({ totalWorkouts, totalBurned, longestStreak, weightChange });
    } catch (e) {
      console.warn('ProgressScreen load error:', e);
    } finally {
      setLoading(false);
    }
  }, [userId, period]);

  useEffect(() => { loadData(); }, [loadData]);

  const weightSign = stats.weightChange > 0 ? '+' : '';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
    >
      <Text variant="headlineSmall" style={styles.title}>İlerleme & Analiz</Text>

      <SegmentedButtons
        value={period}
        onValueChange={(v) => setPeriod(v)}
        buttons={[
          { value: '7', label: '7 Gün' },
          { value: '30', label: '30 Gün' },
          { value: '90', label: '90 Gün' },
          { value: 'all', label: 'Tümü' },
        ]}
        style={{ marginBottom: spacing.md }}
      />

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard icon="dumbbell" label="Toplam Antrenman" value={`${stats.totalWorkouts}`} color={colors.primary} />
        <StatCard icon="fire" label="Yakılan Kalori" value={`${stats.totalBurned}`} color={colors.orange} />
        <StatCard icon="trending-up" label="En Uzun Seri" value={`${stats.longestStreak} gün`} color={colors.secondary} />
        <StatCard icon="scale-bathroom" label="Kilo Değişimi" value={`${weightSign}${stats.weightChange} kg`} color={colors.purple} />
      </View>

      {/* Weight Chart */}
      <Card style={styles.chartCard} mode="elevated">
        <Card.Content>
          <Text style={styles.chartTitle}>Kilo Trendi</Text>
          {weightData.values.length >= 2 ? (
            <LineChart
              data={{ labels: weightData.labels, datasets: [{ data: weightData.values }] }}
              width={screenWidth - spacing.md * 2}
              height={200}
              chartConfig={chartConfig}
              bezier
              style={{ borderRadius: borderRadius.md }}
              yAxisSuffix=" kg"
              withInnerLines={false}
            />
          ) : (
            <EmptyChart icon="chart-line" message="Kilo verisi için profil ekranından ölçüm ekle" />
          )}
        </Card.Content>
      </Card>

      {/* Calorie Chart */}
      <Card style={styles.chartCard} mode="elevated">
        <Card.Content>
          <Text style={styles.chartTitle}>Günlük Kalori</Text>
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
            <EmptyChart icon="chart-bar" message="Kalori grafiği için öğün kaydet" />
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <Card style={styles.statCard} mode="elevated">
      <Card.Content style={{ alignItems: 'center' }}>
        <MaterialCommunityIcons name={icon as any} size={28} color={color} />
        <Text style={{ fontWeight: 'bold', fontSize: 18, marginTop: 4 }}>{value}</Text>
        <Text style={{ color: '#999', fontSize: 11, textAlign: 'center' }}>{label}</Text>
      </Card.Content>
    </Card>
  );
}

function EmptyChart({ icon, message }: { icon: string; message: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
      <MaterialCommunityIcons name={icon as any} size={48} color="#ccc" />
      <Text style={{ color: '#999', marginTop: spacing.sm, textAlign: 'center', fontSize: 13 }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontWeight: 'bold', marginBottom: spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { width: '48%' as any, borderRadius: borderRadius.md },
  chartCard: { borderRadius: borderRadius.lg, marginBottom: spacing.md },
  chartTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: spacing.sm },
});
