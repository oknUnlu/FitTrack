import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Text, Card, Button, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSetsBySession, getAllExercises, ExerciseSet, Exercise } from '../../services/database/workoutDao';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';

export function SessionDetailScreen() {
  const route = useRoute<any>();
  const theme = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const params = route.params as any ?? {};
  const { sessionId, sessionName, date, durationMinutes, caloriesBurned } = params;

  const [sets, setSets] = useState<ExerciseSet[]>([]);
  const [exerciseMap, setExerciseMap] = useState<Map<string, Exercise>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    if (Platform.OS === 'web') { setLoading(false); return; }
    try {
      setLoading(true);
      setError(false);
      const [sessionSets, allExercises] = await Promise.all([
        getSetsBySession(sessionId),
        getAllExercises(),
      ]);
      setExerciseMap(new Map(allExercises.map((e) => [e.id, e])));
      setSets(sessionSets);
    } catch (e) {
      if (__DEV__) console.warn('SessionDetail load failed:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Group sets by exerciseId
  const groups = useMemo(() => sets.reduce((acc, s) => {
    if (!acc[s.exerciseId]) acc[s.exerciseId] = [];
    acc[s.exerciseId].push(s);
    return acc;
  }, {} as Record<string, ExerciseSet[]>), [sets]);

  const getExerciseName = useCallback((exerciseId: string) => {
    const ex = exerciseMap.get(exerciseId);
    return ex ? (ex.nameTr || ex.name) : exerciseId;
  }, [exerciseMap]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.lg }}
    >
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

      {!loading && !error && (
        <>
          {/* Stats header */}
          <Card style={styles.statsCard} mode="elevated">
            <Card.Content style={styles.statsRow}>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="calendar" size={20} color={colors.primary} />
                <Text style={styles.statValue}>{date}</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="timer-outline" size={20} color={colors.primary} />
                <Text style={styles.statValue}>{durationMinutes} {t.common.min}</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="fire" size={20} color={colors.orange} />
                <Text style={[styles.statValue, { color: colors.orange }]}>{caloriesBurned} {t.common.kcal}</Text>
              </View>
            </Card.Content>
          </Card>

          {/* Exercise groups */}
          {Object.entries(groups).map(([exerciseId, groupSets]) => (
            <Card key={exerciseId} style={styles.exerciseCard} mode="elevated">
              <Card.Content>
                <Text style={styles.exerciseName}>{getExerciseName(exerciseId)}</Text>
                {groupSets.map((s) => (
                  <View key={s.id} style={styles.setRow}>
                    <Text style={styles.setNum}>{t.workout.set} {s.setNumber}</Text>
                    <Text style={styles.setValue}>
                      {s.weightKg && s.weightKg > 0 ? `${s.weightKg} kg` : t.workout.unweighted}
                    </Text>
                    <Text style={styles.setValue}>
                      {s.reps ? `${s.reps} ${t.common.reps}` : '—'}
                    </Text>
                    {s.isPersonalRecord && (
                      <Text style={styles.prBadge}>{t.workout.personalRecord}</Text>
                    )}
                  </View>
                ))}
              </Card.Content>
            </Card>
          ))}

          {sets.length === 0 && (
            <Card style={styles.emptyCard} mode="elevated">
              <Card.Content style={{ alignItems: 'center', padding: spacing.lg }}>
                <MaterialCommunityIcons name="dumbbell" size={48} color={colors.textDisabled} />
                <Text style={{ color: colors.textTertiary, marginTop: spacing.sm }}>{t.workout.noRecords}</Text>
              </Card.Content>
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsCard: { borderRadius: borderRadius.md, marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: 13, fontWeight: '600' },
  exerciseCard: { borderRadius: borderRadius.md, marginBottom: spacing.sm },
  exerciseName: { fontWeight: 'bold', fontSize: 16, marginBottom: spacing.sm },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  setNum: { width: 54, color: colors.textTertiary, fontSize: 13 },
  setValue: { flex: 1, fontSize: 14 },
  prBadge: { color: colors.yellow, fontWeight: 'bold', fontSize: 11 },
  emptyCard: { borderRadius: borderRadius.md },
  centerState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 },
});
