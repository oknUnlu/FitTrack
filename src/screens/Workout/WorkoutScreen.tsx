import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, Dimensions } from 'react-native';
import { Text, Card, Button, useTheme, Portal, Modal } from 'react-native-paper';
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
import builtInTemplatesJson from '../../assets/data/workout_templates.json';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type CategoryFilter = 'all' | 'equipment' | 'bodyweight' | 'cardio';

const CATEGORY_ICONS: Record<CategoryFilter, string> = {
  all: 'view-grid',
  equipment: 'dumbbell',
  bodyweight: 'human-handsup',
  cardio: 'run-fast',
};

const CATEGORY_COLORS: Record<string, string> = {
  equipment: '#5C6BC0',
  bodyweight: '#26A69A',
  cardio: '#EF5350',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: '#66BB6A',
  intermediate: '#FFA726',
  advanced: '#EF5350',
};

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
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);

  const loadData = useCallback(async () => {
    if (Platform.OS === 'web') {
      setTemplates(builtInTemplatesJson as any);
      setLoading(false);
      return;
    }
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

  const filteredTemplates = useMemo(() => {
    if (categoryFilter === 'all') return templates;
    return templates.filter((t) => t.category === categoryFilter);
  }, [templates, categoryFilter]);

  const insets = useSafeAreaInsets();

  const getCategoryLabel = (cat: CategoryFilter) => {
    switch (cat) {
      case 'all': return t.workout.allPrograms;
      case 'equipment': return t.workout.equipmentPrograms;
      case 'bodyweight': return t.workout.bodyweightPrograms;
      case 'cardio': return t.workout.cardioPrograms;
    }
  };

  const getDifficultyLabel = (d: string) => {
    if (d === 'beginner') return t.workout.beginner;
    if (d === 'intermediate') return t.workout.intermediate;
    return t.workout.advanced;
  };

  const getTotalExercises = (tmpl: WorkoutTemplate) => {
    return (tmpl.days as any[]).reduce((sum: number, day: any) => sum + (day.exercises?.length ?? 0), 0);
  };

  const handleStartDay = (tmpl: WorkoutTemplate, dayIndex: number) => {
    const day = (tmpl.days as any[])[dayIndex];
    const preloadedExerciseIds = (day?.exercises ?? []).map((e: any) => e.exerciseId);
    setSelectedTemplate(null);
    navigation.navigate('ActiveWorkout', {
      templateId: tmpl.id,
      templateName: `${tmpl.name} — ${day?.name ?? `Day ${dayIndex + 1}`}`,
      preloadedExerciseIds,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingTop: insets.top + spacing.md, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
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

        {/* ── Quick Start Section ── */}
        <Text variant="titleMedium" style={styles.sectionTitle}>{t.workout.quickStart}</Text>
        <TouchableOpacity
          style={styles.quickStartCard}
          onPress={() => navigation.navigate('ActiveWorkout')}
          activeOpacity={0.8}
        >
          <View style={styles.quickStartIcon}>
            <MaterialCommunityIcons name="lightning-bolt" size={28} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.quickStartTitle}>{t.workout.freeWorkout}</Text>
            <Text style={styles.quickStartDesc}>{t.workout.freeWorkoutDesc}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.primary} />
        </TouchableOpacity>

        {/* ── Week Stats ── */}
        {weekStats && weekStats.count > 0 && (
          <View style={styles.weekStatsRow}>
            <WeekStatCard icon="dumbbell" value={weekStats.count} label={t.workout.weekWorkouts} color={colors.primary} />
            <WeekStatCard icon="timer-outline" value={weekStats.totalMinutes} label={t.common.min} color="#5C6BC0" />
            <WeekStatCard icon="fire" value={weekStats.totalCalories} label={t.common.kcal} color="#EF5350" />
          </View>
        )}

        {/* ── Category Filter ── */}
        <Text variant="titleMedium" style={[styles.sectionTitle, { marginTop: spacing.sm }]}>
          {t.workout.builtInPrograms}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {(['all', 'equipment', 'bodyweight', 'cardio'] as CategoryFilter[]).map((cat) => {
            const isActive = categoryFilter === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                ]}
                onPress={() => setCategoryFilter(cat)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={CATEGORY_ICONS[cat] as any}
                  size={16}
                  color={isActive ? '#fff' : colors.textSecondary}
                />
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {getCategoryLabel(cat)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Template Grid ── */}
        <View style={styles.templateGrid}>
          {filteredTemplates.map((tmpl) => {
            const catColor = CATEGORY_COLORS[tmpl.category] || colors.primary;
            const diffColor = DIFFICULTY_COLORS[tmpl.difficulty] || colors.textTertiary;
            return (
              <TouchableOpacity
                key={tmpl.id}
                style={styles.templateCard}
                onPress={() => setSelectedTemplate(tmpl)}
                activeOpacity={0.8}
              >
                {/* Category color stripe */}
                <View style={[styles.templateStripe, { backgroundColor: catColor }]} />
                <View style={styles.templateContent}>
                  {/* Header row */}
                  <View style={styles.templateHeader}>
                    <View style={[styles.templateCatBadge, { backgroundColor: `${catColor}18` }]}>
                      <MaterialCommunityIcons
                        name={(CATEGORY_ICONS[(tmpl.category || 'all') as CategoryFilter] || 'dumbbell') as any}
                        size={18}
                        color={catColor}
                      />
                    </View>
                    <View style={[styles.diffBadge, { backgroundColor: `${diffColor}18` }]}>
                      <Text style={[styles.diffText, { color: diffColor }]}>
                        {getDifficultyLabel(tmpl.difficulty)}
                      </Text>
                    </View>
                  </View>

                  {/* Name */}
                  <Text style={styles.templateName} numberOfLines={1}>{tmpl.name}</Text>
                  <Text style={styles.templateDesc} numberOfLines={2}>{tmpl.description}</Text>

                  {/* Stats row */}
                  <View style={styles.templateStats}>
                    <View style={styles.templateStat}>
                      <MaterialCommunityIcons name="calendar-outline" size={13} color={colors.textTertiary} />
                      <Text style={styles.templateStatText}>{(tmpl.days as any[]).length} {t.workout.programDays}</Text>
                    </View>
                    <View style={styles.templateStat}>
                      <MaterialCommunityIcons name="timer-outline" size={13} color={colors.textTertiary} />
                      <Text style={styles.templateStatText}>{tmpl.estimatedDuration} {t.common.min}</Text>
                    </View>
                    <View style={styles.templateStat}>
                      <MaterialCommunityIcons name="arm-flex-outline" size={13} color={colors.textTertiary} />
                      <Text style={styles.templateStatText}>{getTotalExercises(tmpl)}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Recent Sessions ── */}
        <Text variant="titleMedium" style={[styles.sectionTitle, { marginTop: spacing.md }]}>{t.workout.recentWorkouts}</Text>
        {sessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="dumbbell" size={48} color={colors.textDisabled} />
            <Text style={{ color: colors.textTertiary, marginTop: 8 }}>{t.workout.noRecords}</Text>
          </View>
        ) : (
          sessions.map((s, idx) => (
            <TouchableOpacity
              key={s.id}
              style={styles.sessionCard}
              onPress={() => navigation.navigate('SessionDetail', {
                sessionId: s.id,
                sessionName: s.name,
                date: s.date,
                durationMinutes: s.durationMinutes,
                caloriesBurned: s.caloriesBurned,
              })}
              activeOpacity={0.7}
            >
              <View style={[styles.sessionIndex, { backgroundColor: idx === 0 ? colors.primary : colors.border }]}>
                <Text style={{ color: idx === 0 ? '#fff' : colors.textTertiary, fontSize: 11, fontWeight: 'bold' }}>
                  {idx + 1}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={styles.sessionName}>{s.name}</Text>
                <Text style={styles.sessionDate}>{s.date}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.sessionDuration}>{s.durationMinutes} {t.common.min}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <MaterialCommunityIcons name="fire" size={12} color={colors.orange} />
                  <Text style={styles.sessionCal}>{s.caloriesBurned} {t.common.kcal}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
        </>)}
      </ScrollView>

      {/* ── Day Selection Modal ── */}
      <Portal>
        <Modal
          visible={selectedTemplate !== null}
          onDismiss={() => setSelectedTemplate(null)}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          {selectedTemplate && (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={[styles.modalIconWrap, { backgroundColor: `${CATEGORY_COLORS[selectedTemplate.category] || colors.primary}15` }]}>
                  <MaterialCommunityIcons
                    name={(CATEGORY_ICONS[(selectedTemplate.category || 'all') as CategoryFilter] || 'dumbbell') as any}
                    size={32}
                    color={CATEGORY_COLORS[selectedTemplate.category] || colors.primary}
                  />
                </View>
                <Text style={styles.modalTitle}>{selectedTemplate.name}</Text>
                <Text style={styles.modalDesc}>{selectedTemplate.description}</Text>
                <View style={styles.modalMeta}>
                  <View style={[styles.diffBadge, { backgroundColor: `${DIFFICULTY_COLORS[selectedTemplate.difficulty]}18` }]}>
                    <Text style={[styles.diffText, { color: DIFFICULTY_COLORS[selectedTemplate.difficulty] }]}>
                      {getDifficultyLabel(selectedTemplate.difficulty)}
                    </Text>
                  </View>
                  <Text style={styles.modalMetaText}>
                    {(selectedTemplate.days as any[]).length} {t.workout.programDays} · {selectedTemplate.estimatedDuration} {t.common.min}
                  </Text>
                </View>
              </View>

              {/* Day List */}
              <Text style={styles.selectDayLabel}>{t.workout.selectDay}</Text>
              {(selectedTemplate.days as any[]).map((day: any, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.dayCard}
                  onPress={() => handleStartDay(selectedTemplate, idx)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dayNumber}>
                    <Text style={styles.dayNumberText}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={styles.dayName}>{day.name}</Text>
                    <Text style={styles.dayExerciseCount}>
                      {day.exercises?.length ?? 0} {t.workout.exercises}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="play-circle" size={28} color={colors.primary} />
                </TouchableOpacity>
              ))}

              <Button
                mode="text"
                onPress={() => setSelectedTemplate(null)}
                style={{ marginTop: spacing.sm }}
              >
                {t.common.close}
              </Button>
            </ScrollView>
          )}
        </Modal>
      </Portal>
    </View>
  );
}

// ── Sub-components ──
const WeekStatCard = React.memo(function WeekStatCard({ icon, value, label, color }: { icon: string; value: number; label: string; color: string }) {
  return (
    <View style={styles.weekStatCard}>
      <View style={[styles.weekStatIcon, { backgroundColor: `${color}15` }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.weekStatValue}>{value}</Text>
      <Text style={styles.weekStatLabel}>{label}</Text>
    </View>
  );
});

// ── Styles ──
const CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 2 - spacing.sm) / 2;

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontWeight: 'bold', marginBottom: spacing.md },
  sectionTitle: { fontWeight: 'bold', marginBottom: spacing.sm },
  centerState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 },

  // Quick Start
  quickStartCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}08`,
    borderWidth: 1.5,
    borderColor: `${colors.primary}30`,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  quickStartIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  quickStartTitle: { fontWeight: 'bold', fontSize: 16 },
  quickStartDesc: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },

  // Week Stats
  weekStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  weekStatCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  weekStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  weekStatValue: { fontWeight: 'bold', fontSize: 18 },
  weekStatLabel: { color: colors.textTertiary, fontSize: 10 },

  // Filter
  filterRow: { marginBottom: spacing.md },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
    gap: 5,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#fff',
  },

  // Template Grid
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  templateCard: {
    width: CARD_WIDTH,
    borderRadius: borderRadius.md,
    backgroundColor: '#fff',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    marginBottom: spacing.xs,
  },
  templateStripe: {
    height: 4,
  },
  templateContent: {
    padding: 12,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateCatBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  diffBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  diffText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  templateName: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  templateDesc: {
    fontSize: 11,
    color: colors.textTertiary,
    lineHeight: 15,
    marginBottom: 8,
  },
  templateStats: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 8,
  },
  templateStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  templateStatText: {
    fontSize: 10,
    color: colors.textTertiary,
  },

  // Sessions
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sessionIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionName: { fontWeight: '600', fontSize: 14 },
  sessionDate: { color: colors.textTertiary, fontSize: 11, marginTop: 2 },
  sessionDuration: { fontWeight: '600', fontSize: 13 },
  sessionCal: { color: colors.orange, fontSize: 11 },

  // Empty
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
  },

  // Modal
  modal: {
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: 20,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
  },
  modalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalMetaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  selectDayLabel: {
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: '#F8F8F8',
    marginBottom: 8,
  },
  dayNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  dayName: {
    fontWeight: '600',
    fontSize: 14,
  },
  dayExerciseCount: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
});
