import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  refreshAchievements,
  Achievement,
  getUnlockedCount,
  getTotalCount,
} from '../../services/achievements/achievementService';
import { useUserStore } from '../../store/userStore';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';

type FilterKey = 'all' | Achievement['category'];

const FILTERS: { key: FilterKey; labelKey: string }[] = [
  { key: 'all',       labelKey: 'filterAll' },
  { key: 'workout',   labelKey: 'filterWorkout' },
  { key: 'meal',      labelKey: 'filterMeal' },
  { key: 'streak',    labelKey: 'filterStreak' },
  { key: 'water',     labelKey: 'filterWater' },
  { key: 'nutrition', labelKey: 'filterNutrition' },
];

export function AchievementsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const userId = useUserStore((s) => s.userId);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  useFocusEffect(
    useCallback(() => {
      refreshAchievements(userId).then(setAchievements);
    }, [userId])
  );

  const filtered = activeFilter === 'all'
    ? achievements
    : achievements.filter((a) => a.category === activeFilter);

  const unlocked = getUnlockedCount(achievements);
  const total = getTotalCount();
  const progress = total > 0 ? unlocked / total : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.md }}
    >
      {/* Progress header */}
      <View style={[styles.progressCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>{unlocked} / {total}</Text>
          <Text style={styles.progressLabel}>{t.achievements.unlocked}</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` as any }]} />
        </View>
      </View>

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ gap: 8, paddingRight: spacing.sm }}
      >
        {FILTERS.map((f) => {
          const label = (t.achievements as any)[f.labelKey] ?? f.key;
          const active = activeFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setActiveFilter(f.key)}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Achievement cards */}
      {filtered.map((a) => (
        <AchievementCard key={a.id} achievement={a} t={t} />
      ))}
    </ScrollView>
  );
}

function AchievementCard({ achievement, t }: { achievement: Achievement; t: any }) {
  const theme = useTheme();
  const a = achievement;
  const progress = a.target > 0 ? Math.min(a.current / a.target, 1) : 0;
  const titleText = (t.achievements as any)[a.titleKey] || a.titleKey;
  const descText = (t.achievements as any)[a.descKey] || a.descKey;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }, a.unlocked && { borderLeftColor: a.color }]}>
      <View style={[styles.iconWrap, { backgroundColor: a.unlocked ? `${a.color}20` : colors.divider }]}>
        <MaterialCommunityIcons
          name={a.icon as any}
          size={28}
          color={a.unlocked ? a.color : '#CCC'}
        />
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, a.unlocked && { color: a.color }]}>{titleText}</Text>
          {a.unlocked && (
            <MaterialCommunityIcons name="check-circle" size={20} color={a.color} />
          )}
        </View>
        <Text style={styles.cardDesc}>{descText}</Text>

        {!a.unlocked && (
          <View style={styles.cardProgressRow}>
            <View style={styles.cardProgressBg}>
              <View
                style={[styles.cardProgressFill, { width: `${progress * 100}%` as any, backgroundColor: a.color }]}
              />
            </View>
            <Text style={styles.cardProgressText}>{a.current}/{a.target}</Text>
          </View>
        )}

        {a.unlocked && a.unlockedAt && (
          <Text style={[styles.unlockedDate, { color: a.color }]}>
            {t.achievements.unlocked} {new Date(a.unlockedAt).toLocaleDateString()}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontWeight: 'bold', marginBottom: spacing.md },

  progressCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  progressText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
  },
  progressLabel: {
    fontSize: 14,
    color: colors.textTertiary,
    marginLeft: 8,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  filterRow: {
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.divider,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.border,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 6,
  },
  cardDesc: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  cardProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  cardProgressBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.divider,
  },
  cardProgressFill: {
    height: 6,
    borderRadius: 3,
  },
  cardProgressText: {
    fontSize: 11,
    color: colors.textTertiary,
    minWidth: 30,
  },
  unlockedDate: {
    fontSize: 11,
    marginTop: 4,
  },
});
