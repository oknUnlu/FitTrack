import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getAchievements,
  Achievement,
  getUnlockedCount,
  getTotalCount,
} from '../../services/achievements/achievementService';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';

export function AchievementsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useFocusEffect(
    useCallback(() => {
      getAchievements().then(setAchievements);
    }, [])
  );

  const unlocked = getUnlockedCount(achievements);
  const total = getTotalCount();
  const progress = total > 0 ? unlocked / total : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingTop: insets.top + spacing.md, paddingBottom: 40 }}
    >
      <Text variant="headlineSmall" style={styles.title}>{t.achievements.title}</Text>

      {/* Progress header */}
      <View style={styles.progressCard}>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>{unlocked} / {total}</Text>
          <Text style={styles.progressLabel}>{t.achievements.unlocked}</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      {/* Achievement cards */}
      {achievements.map((a) => (
        <AchievementCard key={a.id} achievement={a} t={t} />
      ))}
    </ScrollView>
  );
}

function AchievementCard({ achievement, t }: { achievement: Achievement; t: any }) {
  const a = achievement;
  const progress = a.target > 0 ? Math.min(a.current / a.target, 1) : 0;
  const titleText = (t.achievements as any)[a.titleKey] || a.titleKey;
  const descText = (t.achievements as any)[a.descKey] || a.descKey;

  return (
    <View style={[styles.card, a.unlocked && styles.cardUnlocked]}>
      <View style={[styles.iconWrap, { backgroundColor: a.unlocked ? `${a.color}20` : '#F0F0F0' }]}>
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
                style={[styles.cardProgressFill, { width: `${progress * 100}%`, backgroundColor: a.color }]}
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
    backgroundColor: '#fff',
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
    color: '#999',
    marginLeft: 8,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8E8E8',
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#E0E0E0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardUnlocked: {
    borderLeftColor: colors.primary,
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
  },
  cardDesc: {
    fontSize: 12,
    color: '#999',
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
    backgroundColor: '#F0F0F0',
  },
  cardProgressFill: {
    height: 6,
    borderRadius: 3,
  },
  cardProgressText: {
    fontSize: 11,
    color: '#999',
    minWidth: 30,
  },
  unlockedDate: {
    fontSize: 11,
    marginTop: 4,
  },
});
