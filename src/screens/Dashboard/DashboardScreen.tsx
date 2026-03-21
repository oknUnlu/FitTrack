import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Pressable, Animated, Dimensions } from 'react-native';
import { Text, Card, Button, FAB, useTheme, IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ProgressRing } from '../../components/ProgressRing';
import { ShimmerEffect } from '../../components/ShimmerEffect';
import { useDashboard, DailySummary } from '../../hooks/useDashboard';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { getProgressColor } from '../../utils/helpers';
import { useLanguage } from '../../i18n';

export function DashboardScreen() {
  const { summary, loading, error, addWater } = useDashboard();
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const { t } = useLanguage();
  const [fabOpen, setFabOpen] = useState(false);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text variant="headlineSmall" style={styles.header}>
          {t.dashboard.greeting} 👋
        </Text>

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

        {/* Workout Card */}
        <WorkoutCard
          summary={summary}
          onStart={() => navigation.navigate('Workout')}
        />

        {/* Streak Card */}
        <StreakCard streak={summary.streakDays} weeklyActive={summary.weeklyActiveDays} />

        {/* AI Coach Card */}
        <AICoachCard onPress={() => navigation.navigate('AICoach')} />
      </ScrollView>

      {/* FAB Menu */}
      {fabOpen && (
        <Pressable style={styles.fabOverlay} onPress={() => setFabOpen(false)}>
          <View style={styles.fabActions}>
            {[
              { icon: 'water' as const, label: t.dashboard.addWater, onPress: () => { addWater(250); setFabOpen(false); }, color: colors.water },
              { icon: 'dumbbell' as const, label: t.tabs.workout, onPress: () => { navigation.navigate('Workout'); setFabOpen(false); }, color: colors.secondary },
              { icon: 'silverware-fork-knife' as const, label: t.dashboard.addMeal, onPress: () => { navigation.navigate('Calories'); setFabOpen(false); }, color: colors.orange },
            ].map((action, i) => (
              <TouchableOpacity key={i} style={styles.fabActionRow} onPress={action.onPress} activeOpacity={0.7}>
                <Text style={styles.fabActionLabel}>{action.label}</Text>
                <View style={[styles.fabActionIcon, { backgroundColor: action.color }]}>
                  <MaterialCommunityIcons name={action.icon} size={20} color="#fff" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      )}
      <FAB
        icon={fabOpen ? 'close' : 'plus'}
        onPress={() => setFabOpen(!fabOpen)}
        style={[styles.fab, { backgroundColor: colors.primary }]}
        color="#fff"
      />
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
        <Text variant="titleMedium" style={styles.cardTitle}>{t.dashboard.dailyCalories}</Text>

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
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color }}>{value}</Text>
      <Text style={{ fontSize: 12, color: '#999' }}>{label}</Text>
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
  const progress = target > 0 ? Math.min(current / target, 1) : 0;
  return (
    <View style={{ marginTop: spacing.sm }}>
      <View style={styles.macroRow}>
        <Text style={{ fontSize: 14 }}>{label}</Text>
        <Text style={{ fontSize: 12, color: '#999' }}>{Math.round(current)}g / {target}g</Text>
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
function WaterCard({ consumed, target, onAdd }: { consumed: number; target: number; onAdd: (ml: number) => void }) {
  const { t } = useLanguage();
  const progress = target > 0 ? consumed / target : 0;
  const glasses = Math.floor(consumed / 250);

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <View style={styles.rowBetween}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="water" size={24} color={colors.water} />
            <Text variant="titleMedium" style={[styles.cardTitle, { marginLeft: 8, marginBottom: 0 }]}>{t.dashboard.waterTracking}</Text>
          </View>
          <Text style={{ color: '#999', fontSize: 12 }}>{glasses} {t.common.glasses}</Text>
        </View>

        <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
          <ProgressRing
            size={100}
            strokeWidth={12}
            progress={progress}
            color={colors.water}
            centerLabel={`${consumed}ml`}
            centerSubLabel={`/ ${target}ml`}
          />
        </View>

        <View style={styles.waterButtons}>
          <Button mode="contained-tonal" onPress={() => onAdd(250)} compact style={styles.waterBtn}>
            +250ml
          </Button>
          <Button mode="contained-tonal" onPress={() => onAdd(500)} compact style={styles.waterBtn}>
            +500ml
          </Button>
        </View>
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
              <Text style={{ color: '#999', fontSize: 12 }}>{summary.workoutDuration} {t.common.min}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontWeight: '600', color: colors.orange }}>{summary.workoutCalories} {t.common.kcal}</Text>
              <Text style={{ color: '#999', fontSize: 12 }}>{t.dashboard.burnedLabel}</Text>
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
            <Text style={{ color: '#999', fontSize: 12 }}>{t.dashboard.keepGoing}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {weeklyActive.map((active, i) => (
            <View
              key={i}
              style={[styles.dayDot, { backgroundColor: active ? colors.primary : '#E0E0E0' }]}
            >
              <Text style={{ fontSize: 8, color: active ? '#fff' : '#999', fontWeight: 'bold' }}>
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
// AI COACH MINI CARD
// ═════════════════════════════════════════
function AICoachCard({ onPress }: { onPress: () => void }) {
  const { t } = useLanguage();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Card style={[styles.card, { backgroundColor: '#E8F5E9' }]} mode="elevated">
        <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="robot" size={32} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ fontWeight: 'bold' }}>{t.dashboard.aiCoach}</Text>
            <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{t.dashboard.askAiCoach}</Text>
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
  card: { borderRadius: borderRadius.lg, marginBottom: spacing.md },
  cardTitle: { fontWeight: 'bold', marginBottom: spacing.sm },
  calorieStatsRow: { flexDirection: 'row', justifyContent: 'space-evenly', width: '100%' },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressBg: { height: 8, borderRadius: 4, marginTop: 4 },
  progressFill: { height: 8, borderRadius: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  waterButtons: { flexDirection: 'row', justifyContent: 'space-evenly' },
  waterBtn: { flex: 0.45 },
  dayDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 84, borderRadius: 16 },
  fabOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 10 },
  fabActions: { position: 'absolute', right: 24, bottom: 152, gap: 12 },
  fabActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  fabActionLabel: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, fontSize: 13, fontWeight: '500', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  fabActionIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
});
