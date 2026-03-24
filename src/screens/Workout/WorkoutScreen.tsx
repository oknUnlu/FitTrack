import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, FlatList, Platform, ActivityIndicator } from 'react-native';
import { Text, Card, Button, Chip, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { format, startOfWeek } from 'date-fns';
import { useUserStore } from '../../store/userStore';
import {
  getRecentSessions,
  getBuiltInTemplates,
  getTotalCompletedWorkouts,
  getSessionsByDateRange,
  WorkoutSession,
  WorkoutTemplate,
} from '../../services/database/workoutDao';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';
import { todayString } from '../../utils/helpers';

export function WorkoutScreen() {
  const userId = useUserStore((s) => s.userId);
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const { t } = useLanguage();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [weekStats, setWeekStats] = useState<{ count: number; totalMinutes: number; totalCalories: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    if (Platform.OS === 'web') { setLoading(false); return; }
    try {
      setLoading(true);
      setError(false);
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const today = todayString();
      const [sessionsData, templatesData, totalCount, weekSessions] = await Promise.all([
        getRecentSessions(userId),
        getBuiltInTemplates(),
        getTotalCompletedWorkouts(userId),
        getSessionsByDateRange(userId, weekStart, today),
      ]);
      setSessions(sessionsData);
      setTemplates(templatesData);
      setTotalWorkouts(totalCount);
      const completed = weekSessions.filter((s) => s.completedAt !== null);
      setWeekStats({
        count: completed.length,
        totalMinutes: completed.reduce((s, w) => s + w.durationMinutes, 0),
        totalCalories: completed.reduce((s, w) => s + w.caloriesBurned, 0),
      });
    } catch (e) {
      console.warn('WorkoutScreen load failed:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingTop: insets.top + spacing.md, paddingBottom: 100 }}
    >
      <Text variant="headlineSmall" style={styles.title}>{t.workout.title}</Text>

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
      {/* Workout stats summary */}
      {totalWorkouts > 0 && (
        <Card style={styles.statsCard} mode="elevated">
          <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="trophy" size={28} color="#FFC107" />
            <View style={{ marginLeft: spacing.sm, flex: 1 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 18 }}>{totalWorkouts}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{t.progress.totalWorkouts}</Text>
            </View>
            {sessions.length > 0 && sessions[0].completedAt && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontWeight: '600', color: colors.primary }}>{sessions[0].caloriesBurned} {t.common.kcal}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{t.workout.recentWorkouts}</Text>
              </View>
            )}
          </Card.Content>
        </Card>
      )}

      {/* This week stats */}
      {weekStats && weekStats.count > 0 && (
        <Card style={styles.weekCard} mode="elevated">
          <Card.Content>
            <Text style={styles.weekLabel}>{t.workout.thisWeek}</Text>
            <View style={styles.weekRow}>
              <WeekStatChip icon="dumbbell" value={weekStats.count} label={t.workout.weekWorkouts} />
              <WeekStatChip icon="timer-outline" value={weekStats.totalMinutes} label={t.common.min} />
              <WeekStatChip icon="fire" value={weekStats.totalCalories} label={t.common.kcal} />
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Start empty workout */}
      <Button
        mode="contained"
        icon="play"
        style={{ backgroundColor: colors.primary, marginBottom: spacing.lg, borderRadius: borderRadius.md }}
        onPress={() => navigation.navigate('ActiveWorkout')}
      >
        {t.workout.startEmpty}
      </Button>

      {/* Templates */}
      <Text variant="titleMedium" style={styles.sectionTitle}>{t.workout.builtInPrograms}</Text>
      <FlatList
        horizontal
        data={templates}
        keyExtractor={(tmpl) => tmpl.id}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Card
            style={styles.templateCard}
            mode="elevated"
            onPress={() => {
              const firstDay = item.days[0];
              const preloadedExerciseIds = (firstDay?.exercises ?? []).map((e: any) => e.exerciseId);
              navigation.navigate('ActiveWorkout', {
                templateId: item.id,
                templateName: `${item.name} — ${firstDay?.name ?? 'Day 1'}`,
                preloadedExerciseIds,
              });
            }}
          >
            <Card.Content>
              <Text style={{ fontWeight: 'bold', fontSize: 14 }}>{item.name}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 4 }}>{item.description}</Text>
              <View style={{ flexDirection: 'row', marginTop: 8, gap: 4, flexWrap: 'wrap' }}>
                <Chip compact textStyle={{ fontSize: 10 }}>{item.difficulty}</Chip>
                <Chip compact textStyle={{ fontSize: 10 }}>{item.days.length} {t.common.days}</Chip>
                <Chip compact textStyle={{ fontSize: 10 }}>{item.estimatedDuration} {t.common.min}</Chip>
              </View>
              <Text style={styles.startTemplateHint}>{t.workout.startTemplate} →</Text>
            </Card.Content>
          </Card>
        )}
        style={{ marginBottom: spacing.lg }}
      />

      {/* Recent Sessions */}
      <Text variant="titleMedium" style={styles.sectionTitle}>{t.workout.recentWorkouts}</Text>
      {sessions.length === 0 ? (
        <Card style={styles.emptyCard} mode="elevated">
          <Card.Content style={{ alignItems: 'center', padding: spacing.lg }}>
            <MaterialCommunityIcons name="dumbbell" size={48} color={colors.textDisabled} />
            <Text style={{ color: colors.textTertiary, marginTop: 8 }}>{t.workout.noRecords}</Text>
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
            <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontWeight: 'bold' }}>{s.name}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{s.date}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontWeight: '600' }}>{s.durationMinutes} {t.common.min}</Text>
                <Text style={{ color: colors.orange, fontSize: 12 }}>{s.caloriesBurned} {t.common.kcal}</Text>
              </View>
            </Card.Content>
          </Card>
        ))
      )}
      </>)}
    </ScrollView>
  );
}

const WeekStatChip = React.memo(function WeekStatChip({ icon, value, label }: { icon: string; value: number; label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.weekChip, { backgroundColor: theme.colors.surfaceVariant }]}>
      <MaterialCommunityIcons name={icon as any} size={16} color={colors.primary} />
      <Text style={styles.weekChipValue}>{value}</Text>
      <Text style={styles.weekChipLabel}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontWeight: 'bold', marginBottom: spacing.md },
  sectionTitle: { fontWeight: 'bold', marginBottom: spacing.sm },
  templateCard: { width: 200, borderRadius: borderRadius.md, marginRight: spacing.sm },
  sessionCard: { borderRadius: borderRadius.md, marginBottom: spacing.sm },
  emptyCard: { borderRadius: borderRadius.md },
  statsCard: { borderRadius: borderRadius.md, marginBottom: spacing.md, backgroundColor: colors.warningBg },
  weekCard: { borderRadius: borderRadius.md, marginBottom: spacing.md },
  weekLabel: { fontWeight: '600', fontSize: 12, color: colors.textTertiary, marginBottom: spacing.sm },
  weekRow: { flexDirection: 'row', gap: spacing.sm },
  weekChip: { flex: 1, alignItems: 'center', borderRadius: borderRadius.sm, paddingVertical: spacing.sm, gap: 2 },
  weekChipValue: { fontWeight: 'bold', fontSize: 16 },
  weekChipLabel: { color: colors.textTertiary, fontSize: 10 },
  startTemplateHint: { color: colors.primary, fontSize: 11, marginTop: spacing.sm, fontWeight: '600' },
  centerState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 },
});
