import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Text, Card, Button, FAB, Portal, useTheme, IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ProgressRing } from '../../components/ProgressRing';
import { ShimmerEffect } from '../../components/ShimmerEffect';
import { useDashboard, DailySummary } from '../../hooks/useDashboard';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { DAYS_TR, getProgressColor } from '../../utils/helpers';

export function DashboardScreen() {
  const { summary, loading, error, addWater } = useDashboard();
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const [fabOpen, setFabOpen] = useState(false);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text variant="headlineSmall" style={styles.header}>
          Merhaba! 👋
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

      {/* FAB */}
      <Portal>
        <FAB.Group
          open={fabOpen}
          visible
          icon={fabOpen ? 'close' : 'plus'}
          actions={[
            { icon: 'silverware-fork-knife', label: 'Öğün Ekle', onPress: () => navigation.navigate('Calories'), color: colors.orange },
            { icon: 'dumbbell', label: 'Antrenman', onPress: () => navigation.navigate('Workout'), color: colors.secondary },
            { icon: 'water', label: 'Su Ekle (+250ml)', onPress: () => addWater(250), color: colors.water },
          ]}
          onStateChange={({ open }) => setFabOpen(open)}
          fabStyle={{ backgroundColor: colors.primary }}
          color="#fff"
        />
      </Portal>
    </View>
  );
}

// ═════════════════════════════════════════
// CALORIE RING CARD
// ═════════════════════════════════════════
function CalorieRingCard({ summary }: { summary: DailySummary }) {
  const net = summary.caloriesConsumed - summary.caloriesBurned;
  const remaining = Math.max(summary.calorieTarget - net, 0);
  const progress = summary.calorieTarget > 0 ? net / summary.calorieTarget : 0;
  const ringColor = getProgressColor(progress);

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content style={{ alignItems: 'center' }}>
        <Text variant="titleMedium" style={styles.cardTitle}>Günlük Kalori</Text>

        <View style={{ marginVertical: spacing.md }}>
          <ProgressRing
            size={180}
            strokeWidth={16}
            progress={progress}
            color={ringColor}
            bgColor="#E8E8E8"
            centerLabel={`${Math.round(remaining)}`}
            centerSubLabel="kalan kcal"
          />
        </View>

        <View style={styles.calorieStatsRow}>
          <CalorieStat label="Alınan" value={Math.round(summary.caloriesConsumed)} color={colors.calorieGreen} />
          <CalorieStat label="Yakılan" value={summary.caloriesBurned} color={colors.orange} />
          <CalorieStat label="Hedef" value={summary.calorieTarget} color={colors.secondary} />
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
  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitle}>Makro Besinler</Text>
        <MacroBar label="Protein" current={summary.proteinConsumed} target={summary.proteinTarget} color={colors.protein} />
        <MacroBar label="Karbonhidrat" current={summary.carbsConsumed} target={summary.carbsTarget} color={colors.carbs} />
        <MacroBar label="Yağ" current={summary.fatConsumed} target={summary.fatTarget} color={colors.fat} />
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
  const progress = target > 0 ? consumed / target : 0;
  const glasses = Math.floor(consumed / 250);

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <View style={styles.rowBetween}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="water" size={24} color={colors.water} />
            <Text variant="titleMedium" style={[styles.cardTitle, { marginLeft: 8, marginBottom: 0 }]}>Su Takibi</Text>
          </View>
          <Text style={{ color: '#999', fontSize: 12 }}>{glasses} bardak</Text>
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
  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <MaterialCommunityIcons name="dumbbell" size={24} color={colors.primary} />
          <Text variant="titleMedium" style={[styles.cardTitle, { marginLeft: 8, marginBottom: 0 }]}>
            Bugünkü Antrenman
          </Text>
        </View>

        {summary.hasWorkoutToday ? (
          <View style={styles.rowBetween}>
            <View>
              <Text style={{ fontWeight: '600' }}>{summary.workoutName}</Text>
              <Text style={{ color: '#999', fontSize: 12 }}>{summary.workoutDuration} dk</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontWeight: '600', color: colors.orange }}>{summary.workoutCalories} kcal</Text>
              <Text style={{ color: '#999', fontSize: 12 }}>yakıldı</Text>
            </View>
          </View>
        ) : (
          <Button mode="contained" onPress={onStart} style={{ backgroundColor: colors.primary }} icon="play">
            Bugün antrenman günün!
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
  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content style={styles.rowBetween}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 28 }}>🔥</Text>
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={{ fontWeight: 'bold', fontSize: 18 }}>{streak} gün seri</Text>
            <Text style={{ color: '#999', fontSize: 12 }}>Devam et!</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {weeklyActive.map((active, i) => (
            <View
              key={i}
              style={[styles.dayDot, { backgroundColor: active ? colors.primary : '#E0E0E0' }]}
            >
              <Text style={{ fontSize: 8, color: active ? '#fff' : '#999', fontWeight: 'bold' }}>
                {DAYS_TR[i]}
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
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Card style={[styles.card, { backgroundColor: '#E8F5E9' }]} mode="elevated">
        <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="robot" size={32} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ fontWeight: 'bold' }}>AI Fitness Koçu</Text>
            <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>AI koçuna sor →</Text>
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
});
