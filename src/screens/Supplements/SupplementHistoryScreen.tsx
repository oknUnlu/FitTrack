import React, { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { format, subDays } from 'date-fns';
import {
  getSupplements,
  getSupplementLogs,
  Supplement,
  SupplementLog,
} from '../../services/supplements/supplementService';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';

export function SupplementHistoryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [dailyLogs, setDailyLogs] = useState<Map<string, SupplementLog[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const DAYS = 14;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const sups = await getSupplements();
      setSupplements(sups);

      const logsMap = new Map<string, SupplementLog[]>();
      for (let i = 0; i < DAYS; i++) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const logs = await getSupplementLogs(date);
        logsMap.set(date, logs);
      }
      setDailyLogs(logsMap);
    } catch (e) {
      console.warn('SupplementHistory load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const stats = useMemo(() => {
    if (supplements.length === 0) return null;

    const dates: string[] = [];
    for (let i = 0; i < DAYS; i++) {
      dates.push(format(subDays(new Date(), i), 'yyyy-MM-dd'));
    }

    // Per-supplement compliance
    const compliance: { supplement: Supplement; takenDays: number; totalDays: number; streak: number }[] =
      supplements.map((sup) => {
        let takenDays = 0;
        let streak = 0;
        let currentStreak = 0;

        for (const date of dates) {
          const logs = dailyLogs.get(date) || [];
          const taken = logs.find((l) => l.supplementId === sup.id)?.taken ?? false;
          if (taken) {
            takenDays++;
            currentStreak++;
            streak = Math.max(streak, currentStreak);
          } else {
            currentStreak = 0;
          }
        }

        return { supplement: sup, takenDays, totalDays: DAYS, streak };
      });

    // Daily overall compliance
    const dailyCompliance = dates.map((date) => {
      const logs = dailyLogs.get(date) || [];
      const taken = supplements.filter((s) => logs.find((l) => l.supplementId === s.id)?.taken).length;
      return { date, taken, total: supplements.length };
    });

    // Overall rate
    const totalPossible = supplements.length * DAYS;
    const totalTaken = compliance.reduce((s, c) => s + c.takenDays, 0);
    const overallRate = totalPossible > 0 ? Math.round((totalTaken / totalPossible) * 100) : 0;

    return { compliance, dailyCompliance, overallRate, totalTaken, totalPossible };
  }, [supplements, dailyLogs]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 40 }}
    >
      {loading ? (
        <View style={styles.emptyState}>
          <Text style={{ color: colors.textTertiary }}>{t.common.loading}</Text>
        </View>
      ) : !stats || supplements.length === 0 ? (
        <Card style={styles.card} mode="elevated">
          <Card.Content style={{ alignItems: 'center', padding: spacing.lg }}>
            <MaterialCommunityIcons name="pill" size={48} color={colors.textDisabled} />
            <Text style={{ color: colors.textTertiary, marginTop: spacing.sm }}>{t.supplements.noSupplements}</Text>
          </Card.Content>
        </Card>
      ) : (
        <>
          {/* Overall Compliance */}
          <Card style={styles.card} mode="elevated">
            <Card.Content style={{ alignItems: 'center' }}>
              <Text style={styles.cardTitle}>Compliance Rate</Text>
              <View style={styles.rateCircle}>
                <Text style={[styles.rateValue, { color: stats.overallRate >= 80 ? colors.primary : stats.overallRate >= 50 ? colors.orange : colors.red }]}>
                  {stats.overallRate}%
                </Text>
              </View>
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: spacing.sm }}>
                {stats.totalTaken}/{stats.totalPossible} ({DAYS} {t.common.days})
              </Text>
            </Card.Content>
          </Card>

          {/* Per Supplement */}
          <Card style={styles.card} mode="elevated">
            <Card.Content>
              <Text style={styles.cardTitle}>{t.supplements.title}</Text>
              {stats.compliance.map((c) => {
                const rate = c.totalDays > 0 ? Math.round((c.takenDays / c.totalDays) * 100) : 0;
                return (
                  <View key={c.supplement.id} style={styles.supRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', fontSize: 14 }}>{c.supplement.name}</Text>
                      {c.supplement.dosage ? (
                        <Text style={{ fontSize: 11, color: colors.textTertiary }}>{c.supplement.dosage}</Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontWeight: 'bold', color: rate >= 80 ? colors.primary : rate >= 50 ? colors.orange : colors.red }}>
                        {rate}%
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.textTertiary }}>
                        {c.takenDays}/{c.totalDays} {t.common.days}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Card.Content>
          </Card>

          {/* Daily Grid */}
          <Card style={styles.card} mode="elevated">
            <Card.Content>
              <Text style={styles.cardTitle}>{DAYS}-Day Overview</Text>
              <View style={styles.gridContainer}>
                {stats.dailyCompliance.map((day) => {
                  const rate = day.total > 0 ? day.taken / day.total : 0;
                  const bgColor = rate >= 1 ? colors.primary : rate >= 0.5 ? colors.calorieYellow : rate > 0 ? colors.orange : colors.border;
                  return (
                    <View key={day.date} style={styles.gridItem}>
                      <View style={[styles.gridDot, { backgroundColor: bgColor }]}>
                        {rate >= 1 && <MaterialCommunityIcons name="check" size={12} color="#fff" />}
                      </View>
                      <Text style={styles.gridDate}>{day.date.slice(5)}</Text>
                    </View>
                  );
                })}
              </View>
            </Card.Content>
          </Card>

          {/* Streaks */}
          <Card style={styles.card} mode="elevated">
            <Card.Content>
              <Text style={styles.cardTitle}>Best Streaks</Text>
              {stats.compliance
                .filter((c) => c.streak > 0)
                .sort((a, b) => b.streak - a.streak)
                .map((c) => (
                  <View key={c.supplement.id} style={styles.streakRow}>
                    <MaterialCommunityIcons name="fire" size={16} color={colors.orange} />
                    <Text style={{ flex: 1, marginLeft: spacing.sm, fontSize: 13 }}>{c.supplement.name}</Text>
                    <Text style={{ fontWeight: 'bold', color: colors.orange }}>{c.streak} {t.common.days}</Text>
                  </View>
                ))}
            </Card.Content>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { borderRadius: borderRadius.lg, marginBottom: spacing.md },
  cardTitle: { fontWeight: 'bold', marginBottom: spacing.sm },
  rateCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  rateValue: { fontSize: 28, fontWeight: 'bold' },
  supRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridItem: { alignItems: 'center', width: 40 },
  gridDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  gridDate: { fontSize: 8, color: colors.textTertiary, marginTop: 2 },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
});
