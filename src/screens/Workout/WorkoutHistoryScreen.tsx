import React, { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Platform } from 'react-native';
import { Text, Card, Chip, useTheme, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useUserStore } from '../../store/userStore';
import {
  getSessionsByDateRange,
  getTotalCompletedWorkouts,
  WorkoutSession,
} from '../../services/database/workoutDao';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';

type FilterRange = '7d' | '30d' | '90d' | 'all';

export function WorkoutHistoryScreen() {
  const userId = useUserStore((s) => s.userId);
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState<FilterRange>('30d');
  const [loading, setLoading] = useState(true);

  const getDateRange = useCallback((range: FilterRange): { start: string; end: string } => {
    const today = new Date();
    const end = format(today, 'yyyy-MM-dd');
    switch (range) {
      case '7d': return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end };
      case '30d': return { start: format(subDays(today, 30), 'yyyy-MM-dd'), end };
      case '90d': return { start: format(subDays(today, 90), 'yyyy-MM-dd'), end };
      case 'all': return { start: '2020-01-01', end };
    }
  }, []);

  const loadData = useCallback(async () => {
    if (Platform.OS === 'web') { setLoading(false); return; }
    try {
      setLoading(true);
      const { start, end } = getDateRange(filter);
      const [data, count] = await Promise.all([
        getSessionsByDateRange(userId, start, end),
        getTotalCompletedWorkouts(userId),
      ]);
      setSessions(data.filter((s) => s.completedAt !== null).sort((a, b) => b.date.localeCompare(a.date)));
      setTotalCount(count);
    } catch (e) {
      if (__DEV__) console.warn('WorkoutHistory load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [userId, filter, getDateRange]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const stats = useMemo(() => {
    const totalMin = sessions.reduce((s, w) => s + w.durationMinutes, 0);
    const totalCal = sessions.reduce((s, w) => s + w.caloriesBurned, 0);
    const avgDuration = sessions.length > 0 ? Math.round(totalMin / sessions.length) : 0;
    return { count: sessions.length, totalMin, totalCal, avgDuration };
  }, [sessions]);

  const filters: { key: FilterRange; label: string }[] = [
    { key: '7d', label: t.progress.days7 },
    { key: '30d', label: t.progress.days30 },
    { key: '90d', label: t.progress.days90 },
    { key: 'all', label: t.progress.all },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 40 }}
    >
      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <Chip
            key={f.key}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
            compact
            style={styles.filterChip}
            textStyle={{ fontSize: 12 }}
          >
            {f.label}
          </Chip>
        ))}
      </View>

      {/* Stats Summary */}
      <Card style={styles.statsCard} mode="elevated">
        <Card.Content>
          <View style={styles.statsGrid}>
            <StatItem icon="dumbbell" value={stats.count} label={t.progress.totalWorkouts} color={colors.primary} />
            <StatItem icon="timer-outline" value={stats.totalMin} label={t.common.min} color={colors.secondary} />
            <StatItem icon="fire" value={stats.totalCal} label={t.common.kcal} color={colors.orange} />
            <StatItem icon="clock-outline" value={stats.avgDuration} label={`${t.common.min}/avg`} color={colors.purple} />
          </View>
        </Card.Content>
      </Card>

      {/* Session List */}
      {loading ? (
        <View style={styles.emptyState}>
          <Text style={{ color: colors.textTertiary }}>{t.common.loading}</Text>
        </View>
      ) : sessions.length === 0 ? (
        <Card style={styles.emptyCard} mode="elevated">
          <Card.Content style={{ alignItems: 'center', padding: spacing.lg }}>
            <MaterialCommunityIcons name="dumbbell" size={48} color={colors.textDisabled} />
            <Text style={{ color: colors.textTertiary, marginTop: spacing.sm }}>{t.workout.noRecords}</Text>
          </Card.Content>
        </Card>
      ) : (
        sessions.map((s) => (
          <Card
            key={s.id}
            style={styles.sessionCard}
            mode="elevated"
            onPress={() => navigation.navigate('SessionDetail', {
              sessionId: s.id,
              sessionName: s.name,
              date: s.date,
              durationMinutes: s.durationMinutes,
              caloriesBurned: s.caloriesBurned,
            })}
          >
            <Card.Content style={styles.sessionRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 15 }}>{s.name}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>{s.date}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontWeight: '600' }}>{s.durationMinutes} {t.common.min}</Text>
                <Text style={{ color: colors.orange, fontSize: 12, marginTop: 2 }}>{s.caloriesBurned} {t.common.kcal}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textDisabled} style={{ marginLeft: spacing.sm }} />
            </Card.Content>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function StatItem({ icon, value, label, color }: { icon: string; value: number; label: string; color: string }) {
  return (
    <View style={styles.statItem}>
      <MaterialCommunityIcons name={icon as any} size={20} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  filterChip: { marginBottom: 4 },
  statsCard: { borderRadius: borderRadius.lg, marginBottom: spacing.md },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', minWidth: 60 },
  statValue: { fontWeight: 'bold', fontSize: 18, marginTop: 4 },
  statLabel: { color: colors.textTertiary, fontSize: 10, marginTop: 2 },
  sessionCard: { borderRadius: borderRadius.md, marginBottom: spacing.sm },
  sessionRow: { flexDirection: 'row', alignItems: 'center' },
  emptyCard: { borderRadius: borderRadius.md },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
});
