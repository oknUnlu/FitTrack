import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Button, Card, IconButton, TextInput, Portal, Modal, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { v4 as uuidv4 } from 'uuid';
import { useUserStore } from '../../store/userStore';
import {
  insertSession,
  insertSet,
  searchExercises,
  Exercise,
  ExerciseSet,
  WorkoutSession,
} from '../../services/database/workoutDao';
import { todayString } from '../../utils/helpers';
import { colors, spacing, borderRadius } from '../../theme/theme';

interface SetEntry {
  id: string;
  exerciseName: string;
  exerciseId: string;
  weightKg: number;
  reps: number;
  setNumber: number;
}

export function ActiveWorkoutScreen() {
  const userId = useUserStore((s) => s.userId);
  const navigation = useNavigation();
  const theme = useTheme();

  const [elapsed, setElapsed] = useState(0);
  const [sets, setSets] = useState<SetEntry[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<{ id: string; name: string } | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [saving, setSaving] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionId = useRef(uuidv4());

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

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
    setSelectedExercise({ id: ex.id, name: ex.nameTr || ex.name });
    setExerciseQuery(ex.nameTr || ex.name);
    setSuggestions([]);
  };

  const handleAddSet = () => {
    const exerciseName = selectedExercise?.name ?? exerciseQuery.trim();
    if (!exerciseName) return;
    const r = parseInt(reps) || 0;
    if (r === 0) return;
    const w = parseFloat(weight) || 0;
    const exerciseId = selectedExercise?.id ?? uuidv4();
    const existingCount = sets.filter(
      (s) => s.exerciseId === exerciseId || s.exerciseName === exerciseName
    ).length;
    setSets((prev) => [
      ...prev,
      { id: uuidv4(), exerciseName, exerciseId, weightKg: w, reps: r, setNumber: existingCount + 1 },
    ]);
    setReps('');
    setWeight('');
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

  const finishWorkout = async () => {
    if (saving) return;
    setSaving(true);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const durationMinutes = Math.max(1, Math.floor(elapsed / 60));
      const caloriesBurned = Math.round(durationMinutes * 7);
      const session: WorkoutSession = {
        id: sessionId.current,
        userId,
        date: todayString(),
        templateId: null,
        name: 'Boş Antrenman',
        durationMinutes,
        caloriesBurned,
        notes: null,
        completedAt: Date.now(),
      };
      await insertSession(session);
      for (const s of sets) {
        const set: ExerciseSet = {
          id: s.id,
          sessionId: sessionId.current,
          exerciseId: s.exerciseId,
          setNumber: s.setNumber,
          reps: s.reps,
          weightKg: s.weightKg,
          durationSeconds: null,
          isPersonalRecord: false,
          isWarmup: false,
        };
        await insertSet(set);
      }
      navigation.goBack();
    } catch {
      setSaving(false);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      Alert.alert('Hata', 'Antrenman kaydedilemedi. Tekrar dene.');
    }
  };

  const confirmFinish = () =>
    Alert.alert(
      'Antrenmanı Bitir',
      `${formatTime(elapsed)} süren antrenmanı kaydet ve çık?`,
      [
        { text: 'Devam Et', style: 'cancel' },
        { text: 'Kaydet & Çık', onPress: finishWorkout },
      ]
    );

  const confirmDiscard = () =>
    Alert.alert(
      'Antrenmanı İptal Et',
      'Kaydetmeden çıkmak istiyor musun?',
      [
        { text: 'Hayır', style: 'cancel' },
        { text: 'Evet, Çık', style: 'destructive', onPress: () => navigation.goBack() },
      ]
    );

  // Group sets by exercise name
  const exerciseGroups = sets.reduce((acc, s) => {
    if (!acc[s.exerciseName]) acc[s.exerciseName] = [];
    acc[s.exerciseName].push(s);
    return acc;
  }, {} as Record<string, SetEntry[]>);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Timer bar */}
      <View style={[styles.timerBar, { backgroundColor: colors.primary }]}>
        <IconButton icon="close" iconColor="#fff" size={22} onPress={confirmDiscard} />
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
          <Text style={styles.timerLabel}>Süre</Text>
        </View>
        <View style={{ width: 46 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}>
        {Object.entries(exerciseGroups).map(([name, groupSets]) => (
          <Card key={name} style={styles.exerciseCard} mode="elevated">
            <Card.Content>
              <Text style={styles.exerciseName}>{name}</Text>
              {groupSets.map((s) => (
                <View key={s.id} style={styles.setRow}>
                  <Text style={styles.setNum}>Set {s.setNumber}</Text>
                  <Text style={styles.setValue}>{s.weightKg > 0 ? `${s.weightKg} kg` : 'Yüksüz'}</Text>
                  <Text style={styles.setValue}>{s.reps} tekrar</Text>
                  <IconButton icon="close-circle" iconColor="#ccc" size={18} onPress={() => handleRemoveSet(s.id)} />
                </View>
              ))}
            </Card.Content>
          </Card>
        ))}

        {sets.length === 0 && (
          <Card style={styles.emptyCard} mode="elevated">
            <Card.Content style={{ alignItems: 'center', padding: spacing.xl }}>
              <Text style={{ color: '#999' }}>Egzersiz eklemek için aşağıdaki butonu kullan</Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Bottom buttons */}
      <View style={[styles.bottomBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.surfaceVariant }]}>
        <Button
          mode="outlined"
          icon="plus"
          onPress={() => setModalVisible(true)}
          style={styles.addBtn}
        >
          Egzersiz Ekle
        </Button>
        <Button
          mode="contained"
          onPress={confirmFinish}
          style={[styles.finishBtn, { backgroundColor: colors.primary }]}
          loading={saving}
          disabled={saving}
        >
          Bitir
        </Button>
      </View>

      {/* Add Set Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={handleCloseModal}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>Egzersiz Ekle</Text>

          <TextInput
            label="Egzersiz ara..."
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
              label="Ağırlık (kg)"
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              mode="outlined"
              dense
              style={styles.halfInput}
            />
            <TextInput
              label="Tekrar"
              value={reps}
              onChangeText={setReps}
              keyboardType="number-pad"
              mode="outlined"
              dense
              style={styles.halfInput}
            />
          </View>

          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={handleCloseModal} style={{ flex: 1 }}>
              İptal
            </Button>
            <Button
              mode="contained"
              onPress={() => { handleAddSet(); if (parseInt(reps) > 0 && (selectedExercise || exerciseQuery.trim())) handleCloseModal(); }}
              style={[{ flex: 1 }, { backgroundColor: colors.primary }]}
              disabled={(!selectedExercise && !exerciseQuery.trim()) || !reps || parseInt(reps) === 0}
            >
              Ekle
            </Button>
          </View>
        </Modal>
      </Portal>
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
  exerciseCard: { borderRadius: borderRadius.md, marginBottom: spacing.sm },
  exerciseName: { fontWeight: 'bold', fontSize: 16, marginBottom: spacing.sm },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  setNum: { width: 50, color: '#999', fontSize: 13 },
  setValue: { flex: 1, fontSize: 14 },
  emptyCard: { borderRadius: borderRadius.md },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: spacing.md,
    borderTopWidth: 1,
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
});
