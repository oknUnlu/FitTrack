import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Button, Card, IconButton, TextInput, Portal, Modal, useTheme } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { generateId } from '../../utils/helpers';
import { useUserStore } from '../../store/userStore';
import {
  insertSession,
  insertSet,
  searchExercises,
  getAllExercises,
  getBestSetPerExercise,
  Exercise,
  ExerciseSet,
  WorkoutSession,
} from '../../services/database/workoutDao';
import { todayString } from '../../utils/helpers';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';
import { RestTimerBanner } from '../../components/RestTimerBanner';

interface SetEntry {
  id: string;
  exerciseName: string;
  exerciseId: string;
  weightKg: number;
  reps: number;
  setNumber: number;
  metValue: number;
}

export function ActiveWorkoutScreen() {
  const userId = useUserStore((s) => s.userId);
  const navigation = useNavigation();
  const route = useRoute<any>();
  const theme = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const { templateId, templateName, preloadedExerciseIds } = route.params ?? {};

  const [elapsed, setElapsed] = useState(0);
  const [sets, setSets] = useState<SetEntry[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<{ id: string; name: string; metValue: number } | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [saving, setSaving] = useState(false);
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restTimerKey, setRestTimerKey] = useState(0);
  const [prMap, setPrMap] = useState<Record<string, boolean>>({});
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    duration: string;
    calories: number;
    exerciseCount: number;
    setCount: number;
    prCount: number;
  } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionId = useRef(generateId());

  // Load template exercises on mount
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!preloadedExerciseIds?.length) return;
    (async () => {
      try {
        const all = await getAllExercises();
        const exMap = new Map(all.map((e) => [e.id, e]));
        const preloaded: SetEntry[] = [];
        for (const exId of preloadedExerciseIds as string[]) {
          const ex = exMap.get(exId);
          if (ex) {
            preloaded.push({
              id: generateId(),
              exerciseName: ex.nameTr || ex.name,
              exerciseId: ex.id,
              weightKg: 0,
              reps: 0,
              setNumber: 1,
              metValue: ex.metValue,
            });
          }
        }
        setSets(preloaded);
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const totalSets = useMemo(() => sets.filter((s) => s.reps > 0).length, [sets]);
  const totalVolume = useMemo(() => sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0), [sets]);

  const handleExerciseSearch = useCallback(async (query: string) => {
    setExerciseQuery(query);
    setSelectedExercise(null);
    if (query.length < 2) { setSuggestions([]); return; }
    try {
      const results = await searchExercises(query);
      setSuggestions(results.slice(0, 5));
    } catch { setSuggestions([]); }
  }, []);

  const handleSelectExercise = (ex: Exercise) => {
    setSelectedExercise({ id: ex.id, name: ex.nameTr || ex.name, metValue: ex.metValue });
    setExerciseQuery(ex.nameTr || ex.name);
    setSuggestions([]);
  };

  const handleAddSet = () => {
    const exerciseName = selectedExercise?.name ?? exerciseQuery.trim();
    if (!exerciseName) return;
    const r = parseInt(reps) || 0;
    if (r === 0) return;
    const w = parseFloat(weight) || 0;
    const exerciseId = selectedExercise?.id ?? generateId();
    const metValue = selectedExercise?.metValue ?? 7;
    const existingCount = sets.filter(
      (s) => (s.exerciseId === exerciseId || s.exerciseName === exerciseName) && s.reps > 0
    ).length;
    setSets((prev) => [
      ...prev.filter((s) => !((s.exerciseId === exerciseId || s.exerciseName === exerciseName) && s.reps === 0)),
      { id: generateId(), exerciseName, exerciseId, weightKg: w, reps: r, setNumber: existingCount + 1, metValue },
    ]);
    setReps('');
    setWeight('');
    setRestTimerKey((k) => k + 1);
    setRestTimerActive(true);
    handleCloseModal();
  };

  const handleRemoveSet = (id: string) => setSets((prev) => prev.filter((s) => s.id !== id));

  const handleCloseModal = () => {
    setModalVisible(false);
    setExerciseQuery('');
    setSuggestions([]);
    setSelectedExercise(null);
    setReps('');
    setWeight('');
  };

  const handleOpenAddSetForExercise = (exerciseName: string, exerciseId: string, groupSets: SetEntry[]) => {
    const lastSet = groupSets[groupSets.length - 1];
    setSelectedExercise({ id: exerciseId, name: exerciseName, metValue: lastSet.metValue });
    setExerciseQuery(exerciseName);
    setWeight(lastSet.weightKg > 0 ? String(lastSet.weightKg) : '');
    setReps(lastSet.reps > 0 ? String(lastSet.reps) : '');
    setSuggestions([]);
    setModalVisible(true);
  };

  const finishWorkout = async () => {
    if (saving) return;
    setSaving(true);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const durationMinutes = Math.max(1, Math.floor(elapsed / 60));
      const validSets = sets.filter((s) => s.reps > 0);
      const avgMet = validSets.length > 0
        ? validSets.reduce((s, e) => s + e.metValue, 0) / validSets.length
        : 7;
      const caloriesBurned = Math.round(durationMinutes * avgMet);

      // Detect personal records
      const newPrMap: Record<string, boolean> = {};
      const uniqueExerciseIds = [...new Set(validSets.map((s) => s.exerciseId))];
      await Promise.all(
        uniqueExerciseIds.map(async (exId) => {
          const best = await getBestSetPerExercise(exId);
          const sessionSets = validSets.filter((s) => s.exerciseId === exId);
          const sessionBest = sessionSets.reduce((max, s) =>
            s.weightKg > max.weightKg ? s : max
          );
          const isPR = !best || sessionBest.weightKg > (best.weightKg ?? 0);
          if (isPR && sessionBest.weightKg > 0) {
            newPrMap[sessionBest.id] = true;
          }
        })
      );
      setPrMap(newPrMap);

      const session: WorkoutSession = {
        id: sessionId.current,
        userId,
        date: todayString(),
        templateId: templateId ?? null,
        name: templateName ?? t.workout.emptyWorkout,
        durationMinutes,
        caloriesBurned,
        notes: null,
        completedAt: Date.now(),
      };
      await insertSession(session);
      for (const s of validSets) {
        const set: ExerciseSet = {
          id: s.id,
          sessionId: sessionId.current,
          exerciseId: s.exerciseId,
          setNumber: s.setNumber,
          reps: s.reps,
          weightKg: s.weightKg,
          durationSeconds: null,
          isPersonalRecord: newPrMap[s.id] ?? false,
          isWarmup: false,
        };
        await insertSet(set);
      }

      const exerciseGroups = validSets.reduce((acc, s) => {
        if (!acc[s.exerciseName]) acc[s.exerciseName] = [];
        acc[s.exerciseName].push(s);
        return acc;
      }, {} as Record<string, SetEntry[]>);

      setSummaryData({
        duration: formatTime(elapsed),
        calories: caloriesBurned,
        exerciseCount: Object.keys(exerciseGroups).length,
        setCount: validSets.length,
        prCount: Object.values(newPrMap).filter(Boolean).length,
      });
      setSummaryVisible(true);
    } catch {
      setSaving(false);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      Alert.alert(t.common.error, t.workout.saveError);
    }
  };

  const confirmFinish = () =>
    Alert.alert(
      t.workout.finishWorkout,
      `${formatTime(elapsed)} ${t.workout.finishConfirm}`,
      [
        { text: t.workout.continueWorkout, style: 'cancel' },
        { text: t.workout.saveAndExit, onPress: finishWorkout },
      ]
    );

  const confirmDiscard = () =>
    Alert.alert(
      t.workout.cancelWorkout,
      t.workout.cancelConfirm,
      [
        { text: t.common.no, style: 'cancel' },
        { text: t.workout.yesExit, style: 'destructive', onPress: () => navigation.goBack() },
      ]
    );

  // Group sets by exercise name
  const exerciseGroups = useMemo(() => sets.reduce((acc, s) => {
    if (!acc[s.exerciseName]) acc[s.exerciseName] = [];
    acc[s.exerciseName].push(s);
    return acc;
  }, {} as Record<string, SetEntry[]>), [sets]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Timer bar */}
      <View style={[styles.timerBar, { backgroundColor: colors.primary }]}>
        <IconButton icon="close" iconColor="#fff" size={22} onPress={confirmDiscard} />
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
          <Text style={styles.timerLabel}>{t.workout.duration}</Text>
        </View>
        <View style={styles.volumeSummary}>
          <Text style={styles.volumeValue}>{totalSets} {t.workout.totalSets}</Text>
          {totalVolume > 0 && (
            <Text style={styles.volumeLabel}>{totalVolume.toLocaleString()} kg</Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 200 }}>
        {Object.entries(exerciseGroups).map(([name, groupSets]) => (
          <Card key={name} style={styles.exerciseCard} mode="elevated">
            <Card.Content>
              <Text style={styles.exerciseName}>{name}</Text>
              {groupSets.map((s) => (
                <View key={s.id} style={styles.setRow}>
                  <Text style={styles.setNum}>{t.workout.set} {s.setNumber}</Text>
                  {s.reps > 0 ? (
                    <>
                      <Text style={styles.setValue}>{s.weightKg > 0 ? `${s.weightKg} kg` : t.workout.unweighted}</Text>
                      <Text style={styles.setValue}>{s.reps} {t.common.reps}</Text>
                    </>
                  ) : (
                    <Text style={[styles.setValue, { color: '#bbb' }]}>—</Text>
                  )}
                  {prMap[s.id] && (
                    <Text style={styles.prBadge}>{t.workout.personalRecord}</Text>
                  )}
                  <IconButton icon="close-circle" iconColor={colors.textDisabled} size={18} onPress={() => handleRemoveSet(s.id)} />
                </View>
              ))}
              <Button
                compact
                mode="outlined"
                icon="plus"
                onPress={() => handleOpenAddSetForExercise(name, groupSets[0].exerciseId, groupSets)}
                style={styles.addSetBtn}
                labelStyle={{ fontSize: 12 }}
              >
                {t.workout.addSet}
              </Button>
            </Card.Content>
          </Card>
        ))}

        {sets.length === 0 && (
          <Card style={styles.emptyCard} mode="elevated">
            <Card.Content style={{ alignItems: 'center', padding: spacing.xl }}>
              <Text style={{ color: colors.textTertiary }}>{t.workout.addExerciseHint}</Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Bottom bar with optional rest timer */}
      <View style={[styles.bottomBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.surfaceVariant, paddingBottom: insets.bottom + spacing.sm }]}>
        {restTimerActive && (
          <RestTimerBanner
            key={restTimerKey}
            durationSeconds={90}
            onDone={() => setRestTimerActive(false)}
            onSkip={() => setRestTimerActive(false)}
          />
        )}
        <View style={styles.bottomButtons}>
          <Button
            mode="outlined"
            icon="plus"
            onPress={() => setModalVisible(true)}
            style={styles.addBtn}
          >
            {t.workout.addExercise}
          </Button>
          <Button
            mode="contained"
            onPress={confirmFinish}
            style={[styles.finishBtn, { backgroundColor: colors.primary }]}
            loading={saving}
            disabled={saving}
          >
            {t.workout.finish}
          </Button>
        </View>
      </View>

      {/* Add Set Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={handleCloseModal}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>{t.workout.addExercise}</Text>

          <TextInput
            label={t.workout.searchExercise}
            value={exerciseQuery}
            onChangeText={handleExerciseSearch}
            mode="outlined"
            dense
            style={styles.searchInput}
          />

          {suggestions.length > 0 && (
            <View style={styles.suggestions}>
              {suggestions.map((ex) => (
                <Button
                  key={ex.id}
                  mode={selectedExercise?.id === ex.id ? 'contained' : 'outlined'}
                  compact
                  onPress={() => handleSelectExercise(ex)}
                  style={styles.suggestionBtn}
                  labelStyle={{ fontSize: 12 }}
                >
                  {ex.nameTr || ex.name}
                </Button>
              ))}
            </View>
          )}

          <View style={styles.inputRow}>
            <TextInput
              label={t.workout.weight}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              mode="outlined"
              dense
              style={styles.halfInput}
              placeholder="0"
            />
            <TextInput
              label={t.workout.reps}
              value={reps}
              onChangeText={setReps}
              keyboardType="number-pad"
              mode="outlined"
              dense
              style={styles.halfInput}
              placeholder="12"
            />
          </View>

          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={handleCloseModal} style={{ flex: 1 }}>
              {t.common.cancel}
            </Button>
            <Button
              mode="contained"
              onPress={handleAddSet}
              style={[{ flex: 1 }, { backgroundColor: colors.primary }]}
              disabled={(!selectedExercise && !exerciseQuery.trim()) || !reps || parseInt(reps) === 0}
            >
              {t.workout.add}
            </Button>
          </View>
        </Modal>

        {/* Workout Summary Modal */}
        <Modal
          visible={summaryVisible}
          onDismiss={() => {}}
          contentContainerStyle={[styles.summaryModal, { backgroundColor: theme.colors.surface }]}
        >
          <View style={styles.summaryHeader}>
            <MaterialCommunityIcons name="trophy" size={40} color="#FFC107" />
            <Text variant="titleLarge" style={styles.summaryTitle}>{t.workout.workoutComplete}</Text>
          </View>

          {summaryData && (
            <View style={styles.summaryStats}>
              <SummaryRow icon="timer-outline" value={summaryData.duration} label={t.workout.duration} />
              <SummaryRow icon="fire" value={`${summaryData.calories} kcal`} label={t.common.kcal} hideLabel />
              <SummaryRow icon="dumbbell" value={`${summaryData.exerciseCount}`} label={t.workout.exercisesCount} />
              <SummaryRow icon="format-list-numbered" value={`${summaryData.setCount}`} label={t.workout.setsCount} />
              {summaryData.prCount > 0 && (
                <View style={styles.prRow}>
                  <MaterialCommunityIcons name="star" size={18} color="#FFC107" />
                  <Text style={styles.prText}>{summaryData.prCount}x {t.workout.prsAchieved}</Text>
                </View>
              )}
            </View>
          )}

          <Button
            mode="contained"
            style={{ backgroundColor: colors.primary, marginTop: spacing.md }}
            onPress={() => navigation.goBack()}
          >
            {t.common.done}
          </Button>
        </Modal>
      </Portal>
    </View>
  );
}

function SummaryRow({ icon, value, label, hideLabel }: { icon: string; value: string; label: string; hideLabel?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <MaterialCommunityIcons name={icon as any} size={20} color={colors.primary} />
      <Text style={styles.summaryValue}>{value}</Text>
      {!hideLabel && <Text style={styles.summaryLabel}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  timerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  timerText: { color: '#fff', fontSize: 28, fontWeight: 'bold', letterSpacing: 2 },
  timerLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  volumeSummary: { alignItems: 'flex-end', minWidth: 70 },
  volumeValue: { color: '#fff', fontSize: 13, fontWeight: '600' },
  volumeLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  exerciseCard: { borderRadius: borderRadius.md, marginBottom: spacing.sm },
  exerciseName: { fontWeight: 'bold', fontSize: 16, marginBottom: spacing.sm },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  setNum: { width: 50, color: colors.textTertiary, fontSize: 13 },
  setValue: { flex: 1, fontSize: 14 },
  prBadge: { color: colors.yellow, fontWeight: 'bold', fontSize: 11, marginRight: spacing.xs },
  addSetBtn: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  emptyCard: { borderRadius: borderRadius.md },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  bottomButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addBtn: { flex: 1 },
  finishBtn: { flex: 1 },
  modal: { margin: spacing.md, borderRadius: borderRadius.lg, padding: spacing.md },
  modalTitle: { fontWeight: 'bold', marginBottom: spacing.md },
  searchInput: { marginBottom: spacing.sm },
  suggestions: { marginBottom: spacing.sm, gap: 4 },
  suggestionBtn: { marginBottom: 4 },
  inputRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  halfInput: { flex: 1 },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  summaryModal: { margin: spacing.lg, borderRadius: borderRadius.lg, padding: spacing.lg },
  summaryHeader: { alignItems: 'center', marginBottom: spacing.md },
  summaryTitle: { fontWeight: 'bold', marginTop: spacing.sm, textAlign: 'center' },
  summaryStats: { gap: spacing.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryValue: { fontSize: 16, fontWeight: '600', flex: 1 },
  summaryLabel: { color: colors.textTertiary, fontSize: 13 },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  prText: { color: colors.yellow, fontWeight: 'bold', fontSize: 14 },
});
