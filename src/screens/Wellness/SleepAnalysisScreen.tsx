import React, { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getWellnessEntries, WellnessEntry } from '../../services/wellness/wellnessService';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';

const QUALITY_LABELS_KEYS = ['', 'sleepVeryBad', 'sleepBad', 'sleepNormal', 'sleepGood', 'sleepExcellent'];
const QUALITY_COLORS = ['', colors.red, colors.orange, colors.yellow, colors.calorieGreen, colors.primary];

export function SleepAnalysisScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [entries, setEntries] = useState<WellnessEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const all = await getWellnessEntries();
      setEntries(all.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (e) {
      console.warn('SleepAnalysis load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const stats = useMemo(() => {
    if (entries.length === 0) return null;

    const last7 = entries.slice(0, 7);
    const last30 = entries.slice(0, 30);

    const calcAvg = (arr: WellnessEntry[]) => {
      const avgSleep = arr.reduce((s, e) => s + e.sleepHours, 0) / arr.length;
      const avgQuality = arr.reduce((s, e) => s + e.sleepQuality, 0) / arr.length;
      return {
        avgSleep: Math.round(avgSleep * 10) / 10,
        avgQuality: Math.round(avgQuality * 10) / 10,
      };
    };

    const week = calcAvg(last7);
    const month = last30.length >= 7 ? calcAvg(last30) : null;

    // Best and worst sleep
    const sortedBySleep = [...entries].sort((a, b) => b.sleepHours - a.sleepHours);
    const bestSleep = sortedBySleep[0];
    const worstSleep = sortedBySleep[sortedBySleep.length - 1];

    // Quality distribution
    const qualityDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    entries.forEach((e) => { qualityDist[e.sleepQuality] = (qualityDist[e.sleepQuality] || 0) + 1; });

    // Sleep debt (7h recommended)
    const weekDebt = last7.reduce((s, e) => s + Math.max(0, 7 - e.sleepHours), 0);

    return { week, month, bestSleep, worstSleep, qualityDist, weekDebt, totalEntries: entries.length };
  }, [entries]);

  const getQualityLabel = (quality: number) => (t.wellness as any)[QUALITY_LABELS_KEYS[quality]] || '';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 40 }}
    >
      {loading ? (
        <View style={styles.emptyState}>
          <Text style={{ color: colors.textTertiary }}>{t.common.loading}</Text>
        </View>
      ) : !stats ? (
        <Card style={styles.card} mode="elevated">
          <Card.Content style={{ alignItems: 'center', padding: spacing.lg }}>
            <MaterialCommunityIcons name="sleep" size={48} color={colors.textDisabled} />
            <Text style={{ color: colors.textTertiary, marginTop: spacing.sm }}>{t.wellness.noRecordYet}</Text>
          </Card.Content>
        </Card>
      ) : (
        <>
          {/* Weekly Average */}
          <Card style={styles.card} mode="elevated">
            <Card.Content>
              <Text style={styles.cardTitle}>{t.wellness.weeklySummary}</Text>
              <View style={styles.avgRow}>
                <View style={styles.avgItem}>
                  <MaterialCommunityIcons name="sleep" size={28} color="#5C6BC0" />
                  <Text style={styles.avgValue}>{stats.week.avgSleep}h</Text>
                  <Text style={styles.avgLabel}>{t.wellness.avgSleep}</Text>
                </View>
                <View style={styles.avgItem}>
                  <MaterialCommunityIcons name="star" size={28} color="#FFC107" />
                  <Text style={styles.avgValue}>{stats.week.avgQuality}/5</Text>
                  <Text style={styles.avgLabel}>{t.wellness.sleepQuality}</Text>
                </View>
                <View style={styles.avgItem}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={28} color={stats.weekDebt > 3 ? colors.red : colors.calorieGreen} />
                  <Text style={[styles.avgValue, { color: stats.weekDebt > 3 ? colors.red : colors.calorieGreen }]}>
                    {Math.round(stats.weekDebt * 10) / 10}h
                  </Text>
                  <Text style={styles.avgLabel}>Sleep Debt</Text>
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Monthly Average */}
          {stats.month && (
            <Card style={styles.card} mode="elevated">
              <Card.Content>
                <Text style={styles.cardTitle}>{t.progress.days30}</Text>
                <View style={styles.avgRow}>
                  <View style={styles.avgItem}>
                    <Text style={[styles.avgValue, { color: '#5C6BC0' }]}>{stats.month.avgSleep}h</Text>
                    <Text style={styles.avgLabel}>{t.wellness.avgSleep}</Text>
                  </View>
                  <View style={styles.avgItem}>
                    <Text style={[styles.avgValue, { color: '#FFC107' }]}>{stats.month.avgQuality}/5</Text>
                    <Text style={styles.avgLabel}>{t.wellness.sleepQuality}</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          )}

          {/* Quality Distribution */}
          <Card style={styles.card} mode="elevated">
            <Card.Content>
              <Text style={styles.cardTitle}>{t.wellness.sleepQuality} Distribution</Text>
              {[5, 4, 3, 2, 1].map((q) => {
                const count = stats.qualityDist[q] || 0;
                const pct = stats.totalEntries > 0 ? (count / stats.totalEntries) * 100 : 0;
                return (
                  <View key={q} style={styles.distRow}>
                    <Text style={[styles.distLabel, { color: QUALITY_COLORS[q] }]}>{getQualityLabel(q)}</Text>
                    <View style={styles.distBarBg}>
                      <View style={[styles.distBarFill, { width: `${pct}%`, backgroundColor: QUALITY_COLORS[q] }]} />
                    </View>
                    <Text style={styles.distCount}>{count}</Text>
                  </View>
                );
              })}
            </Card.Content>
          </Card>

          {/* Best & Worst */}
          <Card style={styles.card} mode="elevated">
            <Card.Content>
              <Text style={styles.cardTitle}>Records</Text>
              <View style={styles.recordRow}>
                <View style={styles.recordItem}>
                  <MaterialCommunityIcons name="arrow-up-bold" size={20} color={colors.calorieGreen} />
                  <Text style={{ fontWeight: 'bold', color: colors.calorieGreen }}>{stats.bestSleep.sleepHours}h</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>{stats.bestSleep.date}</Text>
                </View>
                <View style={styles.recordItem}>
                  <MaterialCommunityIcons name="arrow-down-bold" size={20} color={colors.red} />
                  <Text style={{ fontWeight: 'bold', color: colors.red }}>{stats.worstSleep.sleepHours}h</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>{stats.worstSleep.date}</Text>
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Recent Sleep Log */}
          <Card style={styles.card} mode="elevated">
            <Card.Content>
              <Text style={styles.cardTitle}>{t.wellness.recentSessions}</Text>
              {entries.slice(0, 10).map((e) => (
                <View key={e.id} style={styles.logRow}>
                  <Text style={{ flex: 1, fontSize: 13, color: colors.textSecondary }}>{e.date}</Text>
                  <Text style={{ fontWeight: '600', fontSize: 13, marginRight: spacing.sm }}>{e.sleepHours}h</Text>
                  <View style={[styles.qualityBadge, { backgroundColor: QUALITY_COLORS[e.sleepQuality] + '22' }]}>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: QUALITY_COLORS[e.sleepQuality] }}>
                      {getQualityLabel(e.sleepQuality)}
                    </Text>
                  </View>
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
  avgRow: { flexDirection: 'row', justifyContent: 'space-around' },
  avgItem: { alignItems: 'center' },
  avgValue: { fontWeight: 'bold', fontSize: 22, marginTop: 4 },
  avgLabel: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  distRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  distLabel: { width: 70, fontSize: 12, fontWeight: '600' },
  distBarBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.border, marginHorizontal: spacing.sm },
  distBarFill: { height: 8, borderRadius: 4 },
  distCount: { width: 24, textAlign: 'right', fontSize: 12, color: colors.textTertiary },
  recordRow: { flexDirection: 'row', justifyContent: 'space-around' },
  recordItem: { alignItems: 'center', gap: 4 },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.divider },
  qualityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
});
