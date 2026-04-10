import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Alert, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, IconButton, TextInput, Portal, Modal, useTheme } from 'react-native-paper';
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
import { colors, spacing, borderRadius, getSemanticColors } from '../../theme/theme';
import { useLanguage } from '../../i18n';
import { RestTimerBanner } from '../../components/RestTimerBanner';
import { ExerciseGuide } from '../../components/ExerciseGuide';
import { showInterstitial, shouldShowAds } from '../../services/ads/adService';

const MUSCLE_COLORS: Record<string, string> = {
  chest: '#E53935', back: '#1E88E5', shoulders: '#FB8C00', legs: '#43A047',
  biceps: '#8E24AA', triceps: '#5E35B1', core: '#00ACC1', glutes: '#F4511E',
  hamstrings: '#2E7D32', quadriceps: '#388E3C', calves: '#558B2F', traps: '#1565C0',
  cardio: '#EF5350', forearms: '#6A1B9A', obliques: '#00ACC1', hip_flexors: '#4CAF50',
};

const MUSCLE_ICONS: Record<string, string> = {
  chest: 'arm-flex', back: 'human-handsup', shoulders: 'shield-account', legs: 'run',
  biceps: 'arm-flex', triceps: 'arm-flex-outline', core: 'shield-outline', glutes: 'seat',
  hamstrings: 'human-male-height', quadriceps: 'human-male-height-variant', calves: 'shoe-sneaker',
  traps: 'human', cardio: 'heart-pulse', forearms: 'hand-back-right', obliques: 'shield-half-full',
  hip_flexors: 'human',
};

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
  const isDark = theme.dark;
  const sc = getSemanticColors(isDark);
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
    duration: string; calories: number; exerciseCount: number; setCount: number; prCount: number;
  } | null>(null);
  const [exerciseDetailMap, setExerciseDetailMap] = useState<Map<string, Exercise>>(new Map());
  const [expandedGuides, setExpandedGuides] = useState<Set<string>>(new Set());

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionId = useRef(generateId());

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      try {
        const all = await getAllExercises();
        const exMap = new Map(all.map((e) => [e.id, e]));
        setExerciseDetailMap(exMap);
        if (preloadedExerciseIds?.length) {
          const preloaded: SetEntry[] = [];
          for (const exId of preloadedExerciseIds as string[]) {
            const ex = exMap.get(exId);
            if (ex) {
              preloaded.push({
                id: generateId(), exerciseName: ex.nameTr || ex.name, exerciseId: ex.id,
                weightKg: 0, reps: 0, setNumber: 1, metValue: ex.metValue,
              });
            }
          }
          setSets(preloaded);
        }
      } catch { /* ignore */ }
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
  const exerciseCount = useMemo(() => new Set(sets.map((s) => s.exerciseId)).size, [sets]);

  const handleExerciseSearch = useCallback(async (query: string) => {
    setExerciseQuery(query);
    setSelectedExercise(null);
    if (query.length < 2) { setSuggestions([]); return; }
    try { const r = await searchExercises(query); setSuggestions(r.slice(0, 5)); }
    catch { setSuggestions([]); }
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
    setReps(''); setWeight('');
    setRestTimerKey((k) => k + 1); setRestTimerActive(true);
    handleCloseModal();
  };

  const handleRemoveSet = (id: string) => setSets((prev) => prev.filter((s) => s.id !== id));

  const handleCloseModal = () => {
    setModalVisible(false); setExerciseQuery(''); setSuggestions([]);
    setSelectedExercise(null); setReps(''); setWeight('');
  };

  const handleOpenAddSetForExercise = (exerciseName: string, exerciseId: string, groupSets: SetEntry[]) => {
    const lastSet = groupSets[groupSets.length - 1];
    setSelectedExercise({ id: exerciseId, name: exerciseName, metValue: lastSet.metValue });
    setExerciseQuery(exerciseName);
    setWeight(lastSet.weightKg > 0 ? String(lastSet.weightKg) : '');
    setReps(lastSet.reps > 0 ? String(lastSet.reps) : '');
    setSuggestions([]); setModalVisible(true);
  };

  const finishWorkout = async () => {
    if (saving) return;
    setSaving(true);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const durationMinutes = Math.max(1, Math.floor(elapsed / 60));
      const validSets = sets.filter((s) => s.reps > 0);
      const avgMet = validSets.length > 0 ? validSets.reduce((s, e) => s + e.metValue, 0) / validSets.length : 7;
      const caloriesBurned = Math.round(durationMinutes * avgMet);
      const newPrMap: Record<string, boolean> = {};
      const uniqueExerciseIds = [...new Set(validSets.map((s) => s.exerciseId))];
      await Promise.all(
        uniqueExerciseIds.map(async (exId) => {
          const best = await getBestSetPerExercise(exId);
          const sessionSets = validSets.filter((s) => s.exerciseId === exId);
          const sessionBest = sessionSets.reduce((max, s) => s.weightKg > max.weightKg ? s : max);
          if ((!best || sessionBest.weightKg > (best.weightKg ?? 0)) && sessionBest.weightKg > 0) {
            newPrMap[sessionBest.id] = true;
          }
        })
      );
      setPrMap(newPrMap);
      const session: WorkoutSession = {
        id: sessionId.current, userId, date: todayString(), templateId: templateId ?? null,
        name: templateName ?? t.workout.emptyWorkout, durationMinutes, caloriesBurned,
        notes: null, completedAt: Date.now(),
      };
      await insertSession(session);
      for (const s of validSets) {
        await insertSet({
          id: s.id, sessionId: sessionId.current, exerciseId: s.exerciseId, setNumber: s.setNumber,
          reps: s.reps, weightKg: s.weightKg, durationSeconds: null,
          isPersonalRecord: newPrMap[s.id] ?? false, isWarmup: false,
        });
      }
      const groups = validSets.reduce((acc, s) => { if (!acc[s.exerciseName]) acc[s.exerciseName] = []; acc[s.exerciseName].push(s); return acc; }, {} as Record<string, SetEntry[]>);
      setSummaryData({
        duration: formatTime(elapsed), calories: caloriesBurned,
        exerciseCount: Object.keys(groups).length, setCount: validSets.length,
        prCount: Object.values(newPrMap).filter(Boolean).length,
      });
      // Antrenman bitişinde interstitial reklam göster
      if (shouldShowAds()) {
        try { await showInterstitial(); } catch { /* ignore */ }
      }
      setSummaryVisible(true);
    } catch {
      setSaving(false);
      Alert.alert(t.common.error, t.workout.saveError);
    }
  };

  const confirmFinish = () =>
    Alert.alert(t.workout.finishWorkout, `${formatTime(elapsed)} ${t.workout.finishConfirm}`, [
      { text: t.workout.continueWorkout, style: 'cancel' },
      { text: t.workout.saveAndExit, onPress: finishWorkout },
    ]);

  const confirmDiscard = () =>
    Alert.alert(t.workout.cancelWorkout, t.workout.cancelConfirm, [
      { text: t.common.no, style: 'cancel' },
      { text: t.workout.yesExit, style: 'destructive', onPress: () => navigation.goBack() },
    ]);

  const toggleGuide = useCallback((exerciseId: string) => {
    setExpandedGuides((prev) => { const n = new Set(prev); n.has(exerciseId) ? n.delete(exerciseId) : n.add(exerciseId); return n; });
  }, []);

  const exerciseGroups = useMemo(() => sets.reduce((acc, s) => {
    if (!acc[s.exerciseName]) acc[s.exerciseName] = [];
    acc[s.exerciseName].push(s);
    return acc;
  }, {} as Record<string, SetEntry[]>), [sets]);

  const getExerciseColor = (exerciseId: string) => {
    const detail = exerciseDetailMap.get(exerciseId);
    const primary = detail?.muscleGroups?.[0] || 'chest';
    return MUSCLE_COLORS[primary] || '#4CAF50';
  };

  const getExerciseIcon = (exerciseId: string) => {
    const detail = exerciseDetailMap.get(exerciseId);
    const primary = detail?.muscleGroups?.[0] || 'chest';
    return MUSCLE_ICONS[primary] || 'dumbbell';
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? sc.background : '#F2F4F7' }]}>
      {/* ── Header Bar ── */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={confirmDiscard} style={styles.headerCloseBtn}>
          <MaterialCommunityIcons name="close" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTime}>{formatTime(elapsed)}</Text>
          {templateName && (
            <Text style={styles.headerTemplate} numberOfLines={1}>{templateName}</Text>
          )}
        </View>

        <View style={styles.headerRight}>
          <View style={styles.headerStat}>
            <MaterialCommunityIcons name="dumbbell" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.headerStatText}>{exerciseCount}</Text>
          </View>
          <View style={styles.headerStat}>
            <MaterialCommunityIcons name="format-list-numbered" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.headerStatText}>{totalSets}</Text>
          </View>
        </View>
      </View>

      {/* ── Stats Pills ── */}
      {totalSets > 0 && (
        <View style={styles.statsRow}>
          <View style={[styles.statPill, { backgroundColor: isDark ? sc.surface : '#fff' }]}>
            <MaterialCommunityIcons name="weight-kilogram" size={14} color={colors.primary} />
            <Text style={[styles.statPillValue, { color: sc.textPrimary }]}>{totalVolume.toLocaleString()} kg</Text>
            <Text style={[styles.statPillLabel, { color: sc.textTertiary }]}>Hacim</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: isDark ? sc.surface : '#fff' }]}>
            <MaterialCommunityIcons name="fire" size={14} color={colors.orange} />
            <Text style={[styles.statPillValue, { color: sc.textPrimary }]}>
              {Math.round((elapsed / 60) * 7)}
            </Text>
            <Text style={[styles.statPillLabel, { color: sc.textTertiary }]}>kcal</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: isDark ? sc.surface : '#fff' }]}>
            <MaterialCommunityIcons name="arm-flex" size={14} color="#8E24AA" />
            <Text style={[styles.statPillValue, { color: sc.textPrimary }]}>{totalSets}</Text>
            <Text style={[styles.statPillLabel, { color: sc.textTertiary }]}>Set</Text>
          </View>
        </View>
      )}

      {/* ── Exercise List ── */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 200, paddingTop: spacing.sm }}>
        {Object.entries(exerciseGroups).map(([name, groupSets], groupIdx) => {
          const exerciseId = groupSets[0].exerciseId;
          const exerciseDetail = exerciseDetailMap.get(exerciseId);
          const accentColor = getExerciseColor(exerciseId);
          const accentIcon = getExerciseIcon(exerciseId);
          const completedSets = groupSets.filter((s) => s.reps > 0).length;

          return (
            <View key={name} style={[styles.exerciseCard, { backgroundColor: isDark ? sc.surface : '#fff' }]}>
              {/* Color accent top */}
              <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />

              {/* Exercise Header */}
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconCircle, { backgroundColor: accentColor + '15' }]}>
                  <MaterialCommunityIcons name={accentIcon as any} size={20} color={accentColor} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.exerciseName, { color: sc.textPrimary }]} numberOfLines={1}>{name}</Text>
                  {exerciseDetail?.muscleGroups && (
                    <View style={styles.muscleTagRow}>
                      {exerciseDetail.muscleGroups.slice(0, 3).map((mg) => (
                        <View key={mg} style={[styles.muscleTag, { backgroundColor: (MUSCLE_COLORS[mg] || accentColor) + '12' }]}>
                          <Text style={[styles.muscleTagText, { color: MUSCLE_COLORS[mg] || accentColor }]}>
                            {(t.workout as any)[mg] || mg}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <View style={[styles.setCountBadge, { backgroundColor: completedSets > 0 ? colors.primary + '15' : sc.surfaceVariant }]}>
                  <Text style={[styles.setCountText, { color: completedSets > 0 ? colors.primary : sc.textTertiary }]}>
                    {completedSets} set
                  </Text>
                </View>
              </View>

              {/* Exercise Guide Toggle */}
              {exerciseDetail && (
                <ExerciseGuide
                  exercise={exerciseDetail}
                  isExpanded={expandedGuides.has(exerciseId)}
                  onToggle={() => toggleGuide(exerciseId)}
                />
              )}

              {/* Set Table Header */}
              {groupSets.some((s) => s.reps > 0) && (
                <View style={[styles.setTableHeader, { borderBottomColor: sc.divider }]}>
                  <Text style={[styles.setTableHeaderText, { color: sc.textTertiary, width: 40 }]}>SET</Text>
                  <Text style={[styles.setTableHeaderText, { color: sc.textTertiary, flex: 1 }]}>KG</Text>
                  <Text style={[styles.setTableHeaderText, { color: sc.textTertiary, flex: 1 }]}>TEKRAR</Text>
                  <View style={{ width: 32 }} />
                </View>
              )}

              {/* Set Rows */}
              {groupSets.map((s) => (
                <View key={s.id} style={[styles.setRow, s.reps > 0 && styles.setRowCompleted, { borderBottomColor: sc.divider }]}>
                  <View style={[styles.setNumBadge, { backgroundColor: s.reps > 0 ? accentColor + '18' : sc.surfaceVariant }]}>
                    <Text style={[styles.setNumText, { color: s.reps > 0 ? accentColor : sc.textTertiary }]}>{s.setNumber}</Text>
                  </View>
                  {s.reps > 0 ? (
                    <>
                      <Text style={[styles.setValueText, { color: sc.textPrimary }]}>
                        {s.weightKg > 0 ? `${s.weightKg}` : '—'}
                      </Text>
                      <Text style={[styles.setValueText, { color: sc.textPrimary }]}>{s.reps}</Text>
                      {prMap[s.id] && (
                        <View style={styles.prBadge}>
                          <MaterialCommunityIcons name="star" size={12} color="#FFC107" />
                          <Text style={styles.prBadgeText}>PR</Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <Text style={[styles.setValueText, { color: sc.textDisabled, flex: 2 }]}>Henüz yapılmadı</Text>
                  )}
                  <TouchableOpacity onPress={() => handleRemoveSet(s.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <MaterialCommunityIcons name="close-circle-outline" size={18} color={sc.textDisabled} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add Set Button */}
              <TouchableOpacity
                style={[styles.addSetBtn, { borderColor: accentColor + '30' }]}
                onPress={() => handleOpenAddSetForExercise(name, exerciseId, groupSets)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="plus" size={16} color={accentColor} />
                <Text style={[styles.addSetText, { color: accentColor }]}>Set Ekle</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {sets.length === 0 && (
          <View style={[styles.emptyState, { backgroundColor: isDark ? sc.surface : '#fff' }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primary + '12' }]}>
              <MaterialCommunityIcons name="dumbbell" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: sc.textPrimary }]}>{t.workout.addExerciseHint}</Text>
            <Text style={{ fontSize: 13, color: sc.textTertiary, marginTop: 4 }}>Aşağıdaki butondan egzersiz ekleyin</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Bottom Bar ── */}
      <View style={[styles.bottomBar, { backgroundColor: isDark ? sc.surface : '#fff', paddingBottom: insets.bottom + spacing.sm }]}>
        {restTimerActive && (
          <RestTimerBanner key={restTimerKey} durationSeconds={90} onDone={() => setRestTimerActive(false)} onSkip={() => setRestTimerActive(false)} />
        )}
        <View style={styles.bottomButtons}>
          <TouchableOpacity
            style={[styles.addExerciseBtn, { borderColor: colors.primary }]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="plus" size={20} color={colors.primary} />
            <Text style={[styles.addExerciseBtnText, { color: colors.primary }]}>{t.workout.addExercise}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.finishBtn, saving && { opacity: 0.6 }]}
            onPress={confirmFinish}
            activeOpacity={0.8}
            disabled={saving}
          >
            <MaterialCommunityIcons name="check-bold" size={20} color="#fff" />
            <Text style={styles.finishBtnText}>{t.workout.finish}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Modals ── */}
      <Portal>
        {/* Add Exercise Modal */}
        <Modal visible={modalVisible} onDismiss={handleCloseModal}
          contentContainerStyle={[styles.modal, { backgroundColor: isDark ? sc.surface : '#fff' }]}>
          <View style={styles.modalHeader}>
            <View style={[styles.modalIconCircle, { backgroundColor: colors.primary + '12' }]}>
              <MaterialCommunityIcons name="dumbbell" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: sc.textPrimary }]}>{t.workout.addExercise}</Text>
          </View>

          <TextInput label={t.workout.searchExercise} value={exerciseQuery} onChangeText={handleExerciseSearch}
            mode="outlined" dense style={styles.searchInput} left={<TextInput.Icon icon="magnify" />} />

          {suggestions.length > 0 && (
            <View style={styles.suggestions}>
              {suggestions.map((ex) => {
                const isSelected = selectedExercise?.id === ex.id;
                const primaryMg = ex.muscleGroups?.[0] || 'chest';
                const mgColor = MUSCLE_COLORS[primaryMg] || colors.primary;
                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={[styles.suggestionItem, isSelected && { backgroundColor: mgColor + '12', borderColor: mgColor }]}
                    onPress={() => handleSelectExercise(ex)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.suggestionIcon, { backgroundColor: mgColor + '15' }]}>
                      <MaterialCommunityIcons name={(MUSCLE_ICONS[primaryMg] || 'dumbbell') as any} size={16} color={mgColor} />
                    </View>
                    <Text style={[styles.suggestionText, { color: sc.textPrimary }]} numberOfLines={1}>
                      {ex.nameTr || ex.name}
                    </Text>
                    {isSelected && <MaterialCommunityIcons name="check-circle" size={18} color={mgColor} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.inputRow}>
            <TextInput label={t.workout.weight} value={weight} onChangeText={setWeight} keyboardType="decimal-pad"
              mode="outlined" dense style={styles.halfInput} placeholder="0" left={<TextInput.Icon icon="weight-kilogram" />} />
            <TextInput label={t.workout.reps} value={reps} onChangeText={setReps} keyboardType="number-pad"
              mode="outlined" dense style={styles.halfInput} placeholder="12" left={<TextInput.Icon icon="repeat" />} />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel, { borderColor: sc.border }]} onPress={handleCloseModal}>
              <Text style={[styles.modalBtnText, { color: sc.textSecondary }]}>{t.common.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnAdd, ((!selectedExercise && !exerciseQuery.trim()) || !reps || parseInt(reps) === 0) && { opacity: 0.5 }]}
              onPress={handleAddSet}
              disabled={(!selectedExercise && !exerciseQuery.trim()) || !reps || parseInt(reps) === 0}
            >
              <MaterialCommunityIcons name="plus" size={18} color="#fff" />
              <Text style={[styles.modalBtnText, { color: '#fff', marginLeft: 4 }]}>{t.workout.add}</Text>
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Summary Modal */}
        <Modal visible={summaryVisible} onDismiss={() => {}}
          contentContainerStyle={[styles.summaryModal, { backgroundColor: isDark ? sc.surface : '#fff' }]}>
          <View style={styles.summaryGlow}>
            <View style={styles.summaryTrophy}>
              <MaterialCommunityIcons name="trophy" size={48} color="#FFC107" />
            </View>
            <Text style={[styles.summaryTitle, { color: sc.textPrimary }]}>{t.workout.workoutComplete}</Text>
          </View>

          {summaryData && (
            <View style={styles.summaryGrid}>
              <SummaryCard icon="timer-outline" value={summaryData.duration} label={t.workout.duration} color="#5C6BC0" isDark={isDark} />
              <SummaryCard icon="fire" value={`${summaryData.calories}`} label="kcal" color="#EF5350" isDark={isDark} />
              <SummaryCard icon="dumbbell" value={`${summaryData.exerciseCount}`} label={t.workout.exercisesCount} color="#4CAF50" isDark={isDark} />
              <SummaryCard icon="format-list-numbered" value={`${summaryData.setCount}`} label={t.workout.setsCount} color="#FB8C00" isDark={isDark} />
            </View>
          )}

          {summaryData && summaryData.prCount > 0 && (
            <View style={styles.summaryPrRow}>
              <MaterialCommunityIcons name="star" size={20} color="#FFC107" />
              <Text style={styles.summaryPrText}>{summaryData.prCount}x {t.workout.prsAchieved}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.summaryDoneBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Text style={styles.summaryDoneBtnText}>{t.common.done}</Text>
          </TouchableOpacity>
        </Modal>
      </Portal>
    </View>
  );
}

function SummaryCard({ icon, value, label, color, isDark }: { icon: string; value: string; label: string; color: string; isDark: boolean }) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: isDark ? '#2A2A2A' : '#F8F9FA' }]}>
      <View style={[styles.summaryCardIcon, { backgroundColor: color + '15' }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[styles.summaryCardValue, { color: isDark ? '#E0E0E0' : '#333' }]}>{value}</Text>
      <Text style={[styles.summaryCardLabel, { color: isDark ? '#888' : '#999' }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  headerBar: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: spacing.md,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTime: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: 2 },
  headerTemplate: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  headerRight: { flexDirection: 'row', gap: 10 },
  headerStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerStatText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Stats Row
  statsRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  statPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, borderRadius: borderRadius.md,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  statPillValue: { fontSize: 15, fontWeight: '700' },
  statPillLabel: { fontSize: 11 },

  // Exercise Card
  exerciseCard: {
    borderRadius: borderRadius.lg, marginBottom: 12, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6,
  },
  cardAccent: { height: 3 },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
  },
  cardIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  exerciseName: { fontSize: 16, fontWeight: '700' },
  muscleTagRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  muscleTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  muscleTagText: { fontSize: 10, fontWeight: '600' },
  setCountBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  setCountText: { fontSize: 12, fontWeight: '700' },

  // Set Table
  setTableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1,
    marginHorizontal: 16,
  },
  setTableHeaderText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  setRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5,
    marginHorizontal: 0,
  },
  setRowCompleted: {},
  setNumBadge: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  setNumText: { fontSize: 13, fontWeight: '700' },
  setValueText: { flex: 1, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  prBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#FFC10715', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginRight: 8,
  },
  prBadgeText: { color: '#FFC107', fontSize: 10, fontWeight: '800' },

  // Add Set Button
  addSetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, marginHorizontal: 16, marginVertical: 12,
    paddingVertical: 10, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderStyle: 'dashed',
  },
  addSetText: { fontSize: 13, fontWeight: '600' },

  // Empty State
  emptyState: {
    alignItems: 'center', paddingVertical: 48, borderRadius: borderRadius.xl,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600' },

  // Bottom Bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
    gap: spacing.sm,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 6,
  },
  bottomButtons: { flexDirection: 'row', gap: 10 },
  addExerciseBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, borderRadius: borderRadius.md, borderWidth: 1.5,
  },
  addExerciseBtnText: { fontSize: 14, fontWeight: '700' },
  finishBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, borderRadius: borderRadius.md, backgroundColor: '#2E7D32',
  },
  finishBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Modal
  modal: { margin: spacing.md, borderRadius: borderRadius.xl, padding: 24, maxHeight: '85%' },
  modalHeader: { alignItems: 'center', marginBottom: spacing.md },
  modalIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  searchInput: { marginBottom: spacing.sm },
  suggestions: { marginBottom: spacing.sm, gap: 6 },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: 'transparent',
  },
  suggestionIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  suggestionText: { flex: 1, fontSize: 14, fontWeight: '500' },
  inputRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  halfInput: { flex: 1 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: spacing.sm },
  modalBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 13, borderRadius: borderRadius.md,
  },
  modalBtnCancel: { borderWidth: 1 },
  modalBtnAdd: { backgroundColor: '#2E7D32' },
  modalBtnText: { fontSize: 15, fontWeight: '600' },

  // Summary Modal
  summaryModal: { margin: spacing.lg, borderRadius: borderRadius.xl, padding: 28 },
  summaryGlow: { alignItems: 'center', marginBottom: spacing.lg },
  summaryTrophy: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FFC10715', justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  summaryTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: {
    width: '47%' as any, alignItems: 'center', paddingVertical: 16,
    borderRadius: borderRadius.md,
  },
  summaryCardIcon: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  summaryCardValue: { fontSize: 20, fontWeight: '800' },
  summaryCardLabel: { fontSize: 11, marginTop: 2 },
  summaryPrRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: spacing.md,
    backgroundColor: '#FFC10712', paddingVertical: 10, borderRadius: borderRadius.md,
  },
  summaryPrText: { color: '#FFC107', fontWeight: '700', fontSize: 15 },
  summaryDoneBtn: {
    backgroundColor: '#2E7D32', paddingVertical: 16,
    borderRadius: borderRadius.md, alignItems: 'center', marginTop: spacing.lg,
  },
  summaryDoneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
