import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Text, Card, Button, useTheme, IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ProgressRing } from '../../components/ProgressRing';
import { ShimmerEffect } from '../../components/ShimmerEffect';
import { Logo } from '../../components/Logo';
import { useDashboard, DailySummary } from '../../hooks/useDashboard';
import { colors, spacing, borderRadius, getSemanticColors } from '../../theme/theme';
import { useThemeStore } from '../../store/themeStore';
import { getProgressColor } from '../../utils/helpers';
import { useLanguage } from '../../i18n';
import { getAchievements, getUnlockedCount, getTotalCount, Achievement } from '../../services/achievements/achievementService';
import { getRemainingMacroSuggestion, MealSuggestion } from '../../services/mealPlanner/mealPlanService';
import { usePremiumStore } from '../../store/premiumStore';

export function DashboardScreen() {
  const { summary, loading, error, addWater } = useDashboard();
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const isDark = useThemeStore((s) => s.isDarkMode);
  const sc = getSemanticColors(isDark);
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const isPremium = usePremiumStore((s) => s.isPremium);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.md }]} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Logo size={44} />
          <Text variant="headlineSmall" style={styles.headerText} accessibilityRole="header">
            {t.dashboard.greeting} 👋
          </Text>
        </View>

        {/* Calorie Ring Card */}
        <CalorieRingCard summary={summary} />

        {/* Macro Card */}
        <MacroCard summary={summary} />

        {/* Water Card */}
        <WaterCard
          consumed={summary.waterConsumedMl}
          target={summary.waterTargetMl}
          onAdd={addWater}
        />

        {/* Meal Suggestion Card */}
        <MealSuggestionCard summary={summary} />

        {/* Workout Card */}
        <WorkoutCard
          summary={summary}
          onStart={() => navigation.navigate('Workout')}
        />

        {/* Streak Card */}
        <StreakCard streak={summary.streakDays} weeklyActive={summary.weeklyActiveDays} />

        {/* Supplements Card */}
        <QuickNavCard
          title={t.dashboardExtras.supplements}
          subtitle={t.dashboardExtras.supplementsDesc}
          icon="pill"
          iconColor="#00897B"
          bgColor="#E0F2F1"
          onPress={() => navigation.navigate('Supplements')}
        />

        {/* Fasting Card */}
        <QuickNavCard
          title={(t as any).fasting?.title || 'Fasting Tracker'}
          subtitle={(t as any).fasting?.subtitle || 'Intermittent & Ramadan fasting'}
          icon="moon-waning-crescent"
          iconColor="#9C27B0"
          bgColor="#F3E5F5"
          onPress={() => navigation.navigate('Fasting')}
        />

        {/* Wellness Card */}
        <QuickNavCard
          title={t.dashboardExtras.wellness}
          subtitle={t.dashboardExtras.wellnessDesc}
          icon="heart-pulse"
          iconColor="#E91E63"
          bgColor="#FCE4EC"
          onPress={() => navigation.navigate('Wellness')}
          showProBadge={!isPremium}
        />

        {/* Health Hub Card */}
        <QuickNavCard
          title={t.dashboardExtras.healthHub}
          subtitle={t.dashboardExtras.healthHubDesc}
          icon="watch"
          iconColor="#1976D2"
          bgColor="#E3F2FD"
          onPress={() => navigation.navigate('HealthHub')}
          showProBadge={!isPremium}
        />

        {/* Challenges Card */}
        <QuickNavCard
          title={t.dashboardExtras.challenges}
          subtitle={t.dashboardExtras.challengesDesc}
          icon="trophy"
          iconColor="#FF6F00"
          bgColor="#FFF3E0"
          onPress={() => navigation.navigate('Social')}
        />

        {/* Achievements Card */}
        <AchievementsCard onPress={() => navigation.navigate('Achievements')} />

        {/* AI Coach Card */}
        <AICoachCard onPress={() => navigation.navigate('AICoach')} showProBadge={!isPremium} />
      </ScrollView>

    </View>
  );
}

// ═════════════════════════════════════════
// CALORIE RING CARD
// ═════════════════════════════════════════
function CalorieRingCard({ summary }: { summary: DailySummary }) {
  const { t } = useLanguage();
  const net = summary.caloriesConsumed - summary.caloriesBurned;
  const remaining = Math.max(summary.calorieTarget - net, 0);
  const progress = summary.calorieTarget > 0 ? net / summary.calorieTarget : 0;
  const ringColor = getProgressColor(progress);

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content style={{ alignItems: 'center' }}>
        <Text variant="titleMedium" style={styles.cardTitle} accessibilityRole="header">{t.dashboard.dailyCalories}</Text>

        <View style={{ marginVertical: spacing.md }}>
          <ProgressRing
            size={180}
            strokeWidth={16}
            progress={progress}
            color={ringColor}
            bgColor="#E8E8E8"
            centerLabel={`${Math.round(remaining)}`}
            centerSubLabel={t.dashboard.remainingKcal}
          />
        </View>

        <View style={styles.calorieStatsRow}>
          <CalorieStat label={t.dashboard.consumed} value={Math.round(summary.caloriesConsumed)} color={colors.calorieGreen} />
          <CalorieStat label={t.dashboard.burned} value={summary.caloriesBurned} color={colors.orange} />
          <CalorieStat label={t.dashboard.goal} value={summary.calorieTarget} color={colors.secondary} />
        </View>
      </Card.Content>
    </Card>
  );
}

function CalorieStat({ label, value, color }: { label: string; value: number; color: string }) {
  const isDark = useThemeStore((s) => s.isDarkMode);
  const sc = getSemanticColors(isDark);
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color }}>{value}</Text>
      <Text style={{ fontSize: 12, color: sc.textTertiary }}>{label}</Text>
    </View>
  );
}

// ═════════════════════════════════════════
// MACRO CARD
// ═════════════════════════════════════════
function MacroCard({ summary }: { summary: DailySummary }) {
  const { t } = useLanguage();
  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitle}>{t.dashboard.macronutrients}</Text>
        <MacroBar label={t.dashboard.protein} current={summary.proteinConsumed} target={summary.proteinTarget} color={colors.protein} />
        <MacroBar label={t.dashboard.carbs} current={summary.carbsConsumed} target={summary.carbsTarget} color={colors.carbs} />
        <MacroBar label={t.dashboard.fat} current={summary.fatConsumed} target={summary.fatTarget} color={colors.fat} />
      </Card.Content>
    </Card>
  );
}

function MacroBar({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const isDark = useThemeStore((s) => s.isDarkMode);
  const sc = getSemanticColors(isDark);
  const progress = target > 0 ? Math.min(current / target, 1) : 0;
  return (
    <View style={{ marginTop: spacing.sm }}>
      <View style={styles.macroRow}>
        <Text style={{ fontSize: 14, color: sc.textPrimary }}>{label}</Text>
        <Text style={{ fontSize: 12, color: sc.textTertiary }}>{Math.round(current)}g / {target}g</Text>
      </View>
      <View style={[styles.progressBg, { backgroundColor: `${color}22` }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ═════════════════════════════════════════
// WATER CARD
// ═════════════════════════════════════════
const WATER_OPTIONS = [
  { key: 'waterGlass', icon: 'cup-water', ml: 200 },
  { key: 'waterCup', icon: 'coffee', ml: 300 },
  { key: 'waterBottle', icon: 'bottle-soda-classic-outline', ml: 500 },
  { key: 'waterLargeBottle', icon: 'bottle-wine', ml: 1000 },
] as const;

function WaterCard({ consumed, target, onAdd }: { consumed: number; target: number; onAdd: (ml: number) => void }) {
  const { t } = useLanguage();
  const [lastAdded, setLastAdded] = useState<number | null>(null);
  const progress = target > 0 ? Math.min(consumed / target, 1) : 0;
  const remaining = Math.max(target - consumed, 0);
  const completed = consumed >= target;

  const handleAdd = useCallback((ml: number) => {
    onAdd(ml);
    setLastAdded(ml);
  }, [onAdd]);

  const handleUndo = useCallback(() => {
    if (lastAdded) {
      onAdd(-lastAdded);
      setLastAdded(null);
    }
  }, [lastAdded, onAdd]);

  // Visual water drops (filled based on progress)
  const totalDrops = 8;
  const filledDrops = Math.round(progress * totalDrops);

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        {/* Header */}
        <View style={styles.rowBetween}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="water" size={24} color={colors.water} />
            <Text variant="titleMedium" style={[styles.cardTitle, { marginLeft: 8, marginBottom: 0 }]}>{t.dashboard.waterTracking}</Text>
          </View>
          <Text style={{ color: completed ? colors.primary : colors.textTertiary, fontSize: 12, fontWeight: completed ? 'bold' : 'normal' }}>
            {completed ? t.dashboard.waterCompleted : `${remaining}ml ${t.dashboard.waterRemaining}`}
          </Text>
        </View>

        {/* Water drop indicators */}
        <View style={styles.waterDropRow}>
          {Array.from({ length: totalDrops }).map((_, i) => (
            <MaterialCommunityIcons
              key={i}
              name={i < filledDrops ? 'water' : 'water-outline'}
              size={22}
              color={i < filledDrops ? colors.water : colors.textDisabled}
            />
          ))}
        </View>

        {/* Progress bar */}
        <View style={styles.waterProgressBg}>
          <View style={[styles.waterProgressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.waterProgressLabel}>
          {consumed} / {target} ml
        </Text>

        {/* Quick add buttons with icons */}
        <View style={styles.waterOptionsRow}>
          {WATER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={styles.waterOptionBtn}
              onPress={() => handleAdd(opt.ml)}
              activeOpacity={0.7}
              accessibilityLabel={`Add ${opt.ml}ml water`}
              accessibilityRole="button"
            >
              <View style={styles.waterOptionIcon}>
                <MaterialCommunityIcons name={opt.icon as any} size={24} color={colors.water} />
              </View>
              <Text style={styles.waterOptionLabel}>{(t.dashboard as any)[opt.key]}</Text>
              <Text style={styles.waterOptionMl}>{opt.ml}ml</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Undo button */}
        {lastAdded !== null && (
          <TouchableOpacity style={styles.waterUndoBtn} onPress={handleUndo} activeOpacity={0.7} accessibilityLabel="Undo last water addition" accessibilityRole="button">
            <MaterialCommunityIcons name="undo" size={16} color={colors.textTertiary} />
            <Text style={styles.waterUndoText}>{t.dashboard.waterUndoLast} ({lastAdded}ml)</Text>
          </TouchableOpacity>
        )}
      </Card.Content>
    </Card>
  );
}

// ═════════════════════════════════════════
// WORKOUT CARD
// ═════════════════════════════════════════
function WorkoutCard({ summary, onStart }: { summary: DailySummary; onStart: () => void }) {
  const { t } = useLanguage();
  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <MaterialCommunityIcons name="dumbbell" size={24} color={colors.primary} />
          <Text variant="titleMedium" style={[styles.cardTitle, { marginLeft: 8, marginBottom: 0 }]}>
            {t.dashboard.todayWorkout}
          </Text>
        </View>

        {summary.hasWorkoutToday ? (
          <View style={styles.rowBetween}>
            <View>
              <Text style={{ fontWeight: '600' }}>{summary.workoutName}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{summary.workoutDuration} {t.common.min}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontWeight: '600', color: colors.orange }}>{summary.workoutCalories} {t.common.kcal}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{t.dashboard.burnedLabel}</Text>
            </View>
          </View>
        ) : (
          <Button mode="contained" onPress={onStart} style={{ backgroundColor: colors.primary }} icon="play">
            {t.dashboard.workoutDay}
          </Button>
        )}
      </Card.Content>
    </Card>
  );
}

// ═════════════════════════════════════════
// STREAK CARD
// ═════════════════════════════════════════
function StreakCard({ streak, weeklyActive }: { streak: number; weeklyActive: boolean[] }) {
  const { t } = useLanguage();
  const daysArray = [t.daysShort.mon, t.daysShort.tue, t.daysShort.wed, t.daysShort.thu, t.daysShort.fri, t.daysShort.sat, t.daysShort.sun];
  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content style={styles.rowBetween}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 28 }}>🔥</Text>
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={{ fontWeight: 'bold', fontSize: 18 }}>{streak} {t.dashboard.dayStreak}</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{t.dashboard.keepGoing}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {weeklyActive.map((active, i) => (
            <View
              key={i}
              style={[styles.dayDot, { backgroundColor: active ? colors.primary : colors.border }]}
            >
              <Text style={{ fontSize: 8, color: active ? '#fff' : colors.textTertiary, fontWeight: 'bold' }}>
                {daysArray[i]}
              </Text>
            </View>
          ))}
        </View>
      </Card.Content>
    </Card>
  );
}

// ═════════════════════════════════════════
// MEAL SUGGESTION CARD
// ═════════════════════════════════════════
function MealSuggestionCard({ summary }: { summary: DailySummary }) {
  const { t } = useLanguage();
  const remaining = Math.max(summary.calorieTarget - (summary.caloriesConsumed - summary.caloriesBurned), 0);
  const remainingProtein = Math.max(summary.proteinTarget - summary.proteinConsumed, 0);

  if (remaining < 50) return null; // No suggestion if target already met

  // Determine which meal type to suggest based on time of day
  const hour = new Date().getHours();
  let mealType = 'snack';
  if (hour < 10) mealType = 'breakfast';
  else if (hour < 14) mealType = 'lunch';
  else if (hour < 19) mealType = 'dinner';

  const suggestions = getRemainingMacroSuggestion(remaining, remainingProtein, mealType);
  if (suggestions.length === 0) return null;

  const top = suggestions[0];

  return (
    <Card style={[styles.card, { backgroundColor: '#F3E5F5' }]} mode="elevated">
      <Card.Content>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <MaterialCommunityIcons name="lightbulb-on" size={20} color="#9C27B0" />
          <Text style={{ fontWeight: 'bold', marginLeft: 8, color: '#6A1B9A' }}>
            {t.dashboardExtras.suggestion}
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: 11, marginLeft: 'auto' }}>{Math.round(remaining)} {t.common.kcal} {t.dashboard.remainingKcal}</Text>
        </View>
        <Text style={{ fontSize: 14 }}>{top.name}</Text>
        <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2 }}>
          {top.calories} {t.common.kcal} · P:{top.protein}g · K:{top.carbs}g · Y:{top.fat}g
        </Text>
      </Card.Content>
    </Card>
  );
}

// ═════════════════════════════════════════
// ACHIEVEMENTS MINI CARD
// ═════════════════════════════════════════
function AchievementsCard({ onPress }: { onPress: () => void }) {
  const { t } = useLanguage();
  const [unlocked, setUnlocked] = React.useState(0);
  const total = getTotalCount();

  React.useEffect(() => {
    getAchievements().then((a) => setUnlocked(getUnlockedCount(a)));
  }, []);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityLabel="View achievements" accessibilityRole="button">
      <Card style={[styles.card, { backgroundColor: colors.warningBg }]} mode="elevated">
        <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="trophy" size={32} color="#FF9800" />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ fontWeight: 'bold' }}>{t.achievements.title}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{unlocked}/{total} {t.achievements.unlocked}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#999" />
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

// ═════════════════════════════════════════
// QUICK NAV CARD (Generic)
// ═════════════════════════════════════════
function QuickNavCard({ title, subtitle, icon, iconColor, bgColor, onPress, showProBadge }: {
  title: string; subtitle: string; icon: string; iconColor: string; bgColor: string; onPress: () => void; showProBadge?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityLabel={`Navigate to ${title}`} accessibilityRole="button">
      <Card style={[styles.card, { backgroundColor: bgColor }]} mode="elevated">
        <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name={icon as any} size={32} color={iconColor} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontWeight: 'bold' }}>{title}</Text>
              {showProBadge && (
                <View style={styles.proBadge}>
                  <MaterialCommunityIcons name="lock" size={10} color="#FFD700" />
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#999" />
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

// ═════════════════════════════════════════
// AI COACH MINI CARD
// ═════════════════════════════════════════
function AICoachCard({ onPress, showProBadge }: { onPress: () => void; showProBadge?: boolean }) {
  const { t } = useLanguage();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityLabel="Open AI Fitness Coach" accessibilityRole="button">
      <Card style={[styles.card, { backgroundColor: colors.successBg }]} mode="elevated">
        <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="robot" size={32} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontWeight: 'bold' }}>{t.dashboard.aiCoach}</Text>
              {showProBadge && (
                <View style={styles.proBadge}>
                  <MaterialCommunityIcons name="lock" size={10} color="#FFD700" />
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{t.dashboard.askAiCoach}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#999" />
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

// ═════════════════════════════════════════
// LOADING & ERROR STATES
// ═════════════════════════════════════════
function LoadingState() {
  return (
    <View style={[styles.container, styles.scrollContent]}>
      <ShimmerEffect width="100%" height={280} />
      <ShimmerEffect width="100%" height={140} style={{ marginTop: 16 }} />
      <ShimmerEffect width="100%" height={180} style={{ marginTop: 16 }} />
      <ShimmerEffect width="100%" height={80} style={{ marginTop: 16 }} />
    </View>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.red} />
      <Text style={{ marginTop: 8, textAlign: 'center' }}>{message}</Text>
    </View>
  );
}

// ═════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 100 },
  header: { fontWeight: 'bold', marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm },
  headerText: { fontWeight: 'bold' },
  card: { borderRadius: borderRadius.lg, marginBottom: spacing.md },
  cardTitle: { fontWeight: 'bold', marginBottom: spacing.sm },
  calorieStatsRow: { flexDirection: 'row', justifyContent: 'space-evenly', width: '100%' },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressBg: { height: 8, borderRadius: 4, marginTop: 4 },
  progressFill: { height: 8, borderRadius: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  waterDropRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  waterProgressBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: `${colors.water}20`,
    overflow: 'hidden' as const,
  },
  waterProgressFill: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.water,
  },
  waterProgressLabel: {
    textAlign: 'center' as const,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  waterOptionsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
  },
  waterOptionBtn: {
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.water}10`,
    borderWidth: 1,
    borderColor: `${colors.water}25`,
  },
  waterOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.water}15`,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 4,
  },
  waterOptionLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: colors.textSecondary,
    textAlign: 'center' as const,
  },
  waterOptionMl: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 1,
  },
  waterUndoBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: spacing.sm,
    paddingVertical: 6,
    gap: 4,
  },
  waterUndoText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  dayDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  proBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(255,215,0,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    gap: 3,
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: 'bold' as const,
    color: '#FFD700',
  },
});
