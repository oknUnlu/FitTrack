import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Vibration, AppState } from 'react-native';
import { Text, Card, useTheme, Button, Portal, Dialog, TextInput, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getWellnessEntryByDate,
  getWellnessEntries,
  addWellnessEntry,
  getWellnessStats,
  WellnessEntry,
} from '../../services/wellness/wellnessService';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { generateId, todayString } from '../../utils/helpers';
import { useLanguage } from '../../i18n';
import { usePremiumStore } from '../../store/premiumStore';
import { isWellnessDetailAvailable } from '../../services/premium/featureGate';
import { PaywallModal } from '../../components/PaywallModal';

const MOOD_KEYS: { key: WellnessEntry['mood']; icon: string; labelKey: string; color: string }[] = [
  { key: 'great', icon: 'emoticon-excited', labelKey: 'moodGreat', color: colors.primary },
  { key: 'good', icon: 'emoticon-happy', labelKey: 'moodGood', color: colors.calorieGreen },
  { key: 'neutral', icon: 'emoticon-neutral', labelKey: 'moodNeutral', color: colors.yellow },
  { key: 'bad', icon: 'emoticon-sad', labelKey: 'moodBad', color: colors.orange },
  { key: 'terrible', icon: 'emoticon-dead', labelKey: 'moodTerrible', color: colors.red },
];

const SLEEP_QUALITY_KEYS = ['', 'sleepVeryBad', 'sleepBad', 'sleepNormal', 'sleepGood', 'sleepExcellent'];

export function WellnessScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const today = todayString();

  const [entry, setEntry] = useState<WellnessEntry | null>(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const isPremium = usePremiumStore((s) => s.isPremium);
  const hasDetailAccess = isWellnessDetailAvailable();
  const [meditationActive, setMeditationActive] = useState(false);
  const [meditationPaused, setMeditationPaused] = useState(false);
  const [meditationSeconds, setMeditationSeconds] = useState(0);
  const [meditationPreset, setMeditationPreset] = useState<number>(0); // 0 = free timer, else target minutes
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getWellnessStats>> | null>(null);
  const [recentMeditations, setRecentMeditations] = useState<{ date: string; minutes: number }[]>([]);
  const meditationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const presetRef = useRef(0);

  // Form state
  const [formSleepHours, setFormSleepHours] = useState('7');
  const [formSleepQuality, setFormSleepQuality] = useState<number>(3);
  const [formStressLevel, setFormStressLevel] = useState<number>(3);
  const [formMood, setFormMood] = useState<WellnessEntry['mood']>('neutral');
  const [formEnergyLevel, setFormEnergyLevel] = useState<number>(3);
  const [formNotes, setFormNotes] = useState('');

  const loadData = useCallback(async () => {
    const [todayEntry, weekStats, allEntries] = await Promise.all([
      getWellnessEntryByDate(today),
      getWellnessStats(7),
      getWellnessEntries(),
    ]);
    setEntry(todayEntry);
    setStats(weekStats);
    // Recent meditation sessions (last 7 with meditation > 0)
    const medSessions = allEntries
      .filter((e) => e.meditationMinutes > 0)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7)
      .map((e) => ({ date: e.date, minutes: e.meditationMinutes }));
    setRecentMeditations(medSessions);
    if (todayEntry) {
      setFormSleepHours(todayEntry.sleepHours.toString());
      setFormSleepQuality(todayEntry.sleepQuality);
      setFormStressLevel(todayEntry.stressLevel);
      setFormMood(todayEntry.mood);
      setFormEnergyLevel(todayEntry.energyLevel);
      setFormNotes(todayEntry.notes);
    }
  }, [today]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (meditationTimer.current) clearInterval(meditationTimer.current);
    };
  }, []);

  const handleSave = async () => {
    const sleepH = parseFloat(formSleepHours) || 7;
    const newEntry: WellnessEntry = {
      id: entry?.id || generateId(),
      date: today,
      sleepHours: Math.min(Math.max(sleepH, 0), 24),
      sleepQuality: formSleepQuality as WellnessEntry['sleepQuality'],
      stressLevel: formStressLevel as WellnessEntry['stressLevel'],
      mood: formMood,
      energyLevel: formEnergyLevel as WellnessEntry['energyLevel'],
      meditationMinutes: entry?.meditationMinutes || 0,
      notes: formNotes.trim(),
    };
    await addWellnessEntry(newEntry);
    setDialogVisible(false);
    loadData();
  };

  const MEDITATION_PRESETS = [0, 5, 10, 15, 20]; // 0 = free

  const runTimer = () => {
    meditationTimer.current = setInterval(() => {
      setMeditationSeconds((prev) => {
        if (presetRef.current > 0) {
          if (prev <= 1) {
            // Timer complete — schedule finish outside setState
            setTimeout(() => finishMeditation(presetRef.current), 0);
            return 0;
          }
          return prev - 1;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const startMeditation = () => {
    presetRef.current = meditationPreset;
    setMeditationActive(true);
    setMeditationPaused(false);
    setMeditationSeconds(meditationPreset > 0 ? meditationPreset * 60 : 0);
    runTimer();
  };

  const pauseMeditation = () => {
    if (meditationTimer.current) clearInterval(meditationTimer.current);
    setMeditationPaused(true);
  };

  const resumeMeditation = () => {
    setMeditationPaused(false);
    runTimer();
  };

  const finishMeditation = async (presetMinutes?: number) => {
    if (meditationTimer.current) clearInterval(meditationTimer.current);
    setMeditationActive(false);
    setMeditationPaused(false);
    const addedMinutes = presetMinutes || Math.max(1, Math.round(meditationSeconds / 60));
    const currentEntry = await getWellnessEntryByDate(today);
    const updatedEntry: WellnessEntry = currentEntry
      ? { ...currentEntry, meditationMinutes: currentEntry.meditationMinutes + addedMinutes }
      : {
          id: generateId(),
          date: today,
          sleepHours: 7,
          sleepQuality: 3,
          stressLevel: 3,
          mood: 'neutral',
          energyLevel: 3,
          meditationMinutes: addedMinutes,
          notes: '',
        };
    await addWellnessEntry(updatedEntry);
    Vibration.vibrate(200);
    loadData();
    setMeditationSeconds(0);
  };

  const stopMeditation = () => finishMeditation();

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const renderRatingDots = (value: number, onChange: (v: number) => void, colorActive: string) => (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
      {[1, 2, 3, 4, 5].map((v) => (
        <TouchableOpacity key={v} onPress={() => onChange(v)}>
          <View
            style={[
              styles.ratingDot,
              { borderColor: colorActive },
              v <= value && { backgroundColor: colorActive },
            ]}
          >
            <Text style={{ color: v <= value ? '#fff' : colorActive, fontSize: 12, fontWeight: 'bold' }}>{v}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const getMoodLabel = (mood: string) => {
    const found = MOOD_KEYS.find((m) => m.key === mood);
    return found ? { ...found, label: (t.wellness as any)[found.labelKey] || found.labelKey } : undefined;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.md, paddingBottom: 40 }}
    >
      <View style={styles.headerRow}>
        <Button mode="contained" onPress={() => setDialogVisible(true)} icon="pencil" compact>
          {entry ? t.wellness.update : t.wellness.save}
        </Button>
      </View>

      {/* Today's Summary */}
      {entry ? (
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>{t.wellness.todayStatus}</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <MaterialCommunityIcons name="sleep" size={24} color="#5C6BC0" />
                <Text style={styles.summaryValue}>{entry.sleepHours}s</Text>
                <Text style={styles.summaryLabel}>{t.wellness.sleep}</Text>
              </View>
              <View style={styles.summaryItem}>
                <MaterialCommunityIcons name={(getMoodLabel(entry.mood)?.icon || 'emoticon') as any} size={24} color={getMoodLabel(entry.mood)?.color || colors.textTertiary} />
                <Text style={styles.summaryValue}>{getMoodLabel(entry.mood)?.label}</Text>
                <Text style={styles.summaryLabel}>{t.wellness.mood}</Text>
              </View>
              <View style={styles.summaryItem}>
                <MaterialCommunityIcons name="lightning-bolt" size={24} color="#FF9800" />
                <Text style={styles.summaryValue}>{entry.energyLevel}/5</Text>
                <Text style={styles.summaryLabel}>{t.wellness.energy}</Text>
              </View>
              <View style={styles.summaryItem}>
                <MaterialCommunityIcons name="head-heart" size={24} color="#E91E63" />
                <Text style={styles.summaryValue}>{entry.stressLevel}/5</Text>
                <Text style={styles.summaryLabel}>{t.wellness.stress}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      ) : (
        <Card style={styles.card} mode="elevated">
          <Card.Content style={{ alignItems: 'center', padding: spacing.lg }}>
            <MaterialCommunityIcons name="heart-pulse" size={48} color={colors.textDisabled} />
            <Text style={{ color: colors.textTertiary, marginTop: 8 }}>{t.wellness.noRecordYet}</Text>
            <Button mode="outlined" onPress={() => setDialogVisible(true)} style={{ marginTop: 12 }}>
              {t.wellness.addDailyRecord}
            </Button>
          </Card.Content>
        </Card>
      )}

      {/* Meditation Timer */}
      <Card style={styles.card} mode="elevated">
        <Card.Content style={{ alignItems: 'center' }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 12 }}>{t.wellness.meditationTimer}</Text>

          {/* Preset buttons */}
          {!meditationActive && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {MEDITATION_PRESETS.map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setMeditationPreset(p)}
                  style={[
                    styles.presetBtn,
                    meditationPreset === p && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                >
                  <Text style={{ color: meditationPreset === p ? colors.textOnPrimary : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                    {p === 0 ? t.wellness.freeTimer : `${p} ${t.common.min}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={[styles.meditationCircle, meditationActive && !meditationPaused && styles.meditationCircleActive, meditationPaused && { borderColor: colors.orange }]}>
            <Text style={styles.meditationTime}>{formatTime(meditationSeconds)}</Text>
            {meditationPreset > 0 && !meditationActive && (
              <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{meditationPreset} {t.common.min}</Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            {!meditationActive ? (
              <Button mode="contained" onPress={startMeditation} icon="play" style={{ backgroundColor: colors.primary }}>
                {t.wellness.start}
              </Button>
            ) : (
              <>
                {meditationPaused ? (
                  <Button mode="contained" onPress={resumeMeditation} icon="play" style={{ backgroundColor: colors.primary }}>
                    {t.wellness.resume}
                  </Button>
                ) : (
                  <Button mode="outlined" onPress={pauseMeditation} icon="pause">
                    {t.wellness.pause}
                  </Button>
                )}
                <Button mode="contained" onPress={stopMeditation} icon="stop" style={{ backgroundColor: colors.red }}>
                  {t.wellness.stop}
                </Button>
              </>
            )}
          </View>
          {entry && entry.meditationMinutes > 0 && (
            <Text style={{ color: colors.textTertiary, marginTop: 8, fontSize: 12 }}>
              {t.wellness.todayTotal} {entry.meditationMinutes} {t.common.min}
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* Meditation History */}
      {recentMeditations.length > 0 && (
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>{t.wellness.recentSessions}</Text>
            {recentMeditations.map((s) => (
              <View key={s.date} style={styles.historyRow}>
                <MaterialCommunityIcons name="meditation" size={16} color={colors.purple} />
                <Text style={{ flex: 1, marginLeft: 8, color: colors.textSecondary, fontSize: 13 }}>{s.date}</Text>
                <Text style={{ fontWeight: '600', fontSize: 13 }}>{s.minutes} {t.common.min}</Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Weekly Stats */}
      {stats && stats.totalEntries > 0 && (
        <TouchableOpacity
          activeOpacity={hasDetailAccess ? 1 : 0.7}
          onPress={() => { if (!hasDetailAccess) setPaywallVisible(true); }}
        >
          <Card style={[styles.card, !hasDetailAccess && { opacity: 0.6 }]} mode="elevated">
            <Card.Content>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontWeight: 'bold', flex: 1 }}>{t.wellness.weeklySummary}</Text>
                {!hasDetailAccess && <MaterialCommunityIcons name="lock" size={18} color={colors.orange} />}
              </View>
              {hasDetailAccess ? (
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons name="sleep" size={20} color="#5C6BC0" />
                    <Text style={styles.statValue}>{stats.avgSleep}s</Text>
                    <Text style={styles.statLabel}>{t.wellness.avgSleep}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons name="head-heart" size={20} color="#E91E63" />
                    <Text style={styles.statValue}>{stats.avgStress}/5</Text>
                    <Text style={styles.statLabel}>{t.wellness.avgStress}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FF9800" />
                    <Text style={styles.statValue}>{stats.avgEnergy}/5</Text>
                    <Text style={styles.statLabel}>{t.wellness.avgEnergy}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons name="meditation" size={20} color="#9C27B0" />
                    <Text style={styles.statValue}>{stats.avgMeditation}{t.common.min}</Text>
                    <Text style={styles.statLabel}>{t.wellness.avgMeditation}</Text>
                  </View>
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                  <MaterialCommunityIcons name="crown" size={32} color="#FFD700" />
                  <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>
                    {t.premium.upgradeNow}
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>
        </TouchableOpacity>
      )}

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} feature="wellness_detail" />

      {/* Entry Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)} style={{ maxHeight: '80%' }}>
          <Dialog.Title>{t.wellness.dailyRecord}</Dialog.Title>
          <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 8 }}>
              {/* Sleep */}
              <Text style={styles.formLabel}>{t.wellness.sleepDuration}</Text>
              <TextInput
                defaultValue={formSleepHours}
                onChangeText={setFormSleepHours}
                keyboardType="numeric"
                mode="outlined"
                dense
                style={styles.input}
                placeholder="7.5"
              />

              {/* Sleep Quality */}
              <Text style={styles.formLabel}>{t.wellness.sleepQuality}</Text>
              {renderRatingDots(formSleepQuality, setFormSleepQuality, colors.secondary)}
              <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>{(t.wellness as any)[SLEEP_QUALITY_KEYS[formSleepQuality] ?? ''] || ''}</Text>

              {/* Mood */}
              <Text style={[styles.formLabel, { marginTop: 12 }]}>{t.wellness.mood}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                {MOOD_KEYS.map((m) => (
                  <TouchableOpacity key={m.key} onPress={() => setFormMood(m.key)}>
                    <View style={[styles.moodOption, formMood === m.key && { backgroundColor: m.color + '20', borderColor: m.color }]}>
                      <MaterialCommunityIcons name={m.icon as any} size={24} color={formMood === m.key ? m.color : colors.textTertiary} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Energy */}
              <Text style={[styles.formLabel, { marginTop: 12 }]}>{t.wellness.energyLevel}</Text>
              {renderRatingDots(formEnergyLevel, setFormEnergyLevel, colors.orange)}

              {/* Stress */}
              <Text style={[styles.formLabel, { marginTop: 12 }]}>{t.wellness.stressLevel}</Text>
              {renderRatingDots(formStressLevel, setFormStressLevel, colors.red)}

              {/* Notes */}
              <Text style={[styles.formLabel, { marginTop: 12 }]}>{t.wellness.notes}</Text>
              <TextInput
                defaultValue={formNotes}
                onChangeText={setFormNotes}
                mode="outlined"
                dense
                multiline
                numberOfLines={2}
                style={styles.input}
                placeholder={t.wellness.notesPlaceholder}
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>{t.common.cancel}</Button>
            <Button onPress={handleSave}>{t.common.save}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontWeight: 'bold' },
  card: { borderRadius: borderRadius.lg, marginBottom: spacing.md },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap' },
  summaryItem: { alignItems: 'center', minWidth: 70 },
  summaryValue: { fontWeight: 'bold', fontSize: 14, marginTop: 4 },
  summaryLabel: { color: colors.textTertiary, fontSize: 11 },
  meditationCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  meditationCircleActive: { borderColor: colors.primary },
  meditationTime: { fontSize: 32, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontWeight: 'bold', fontSize: 14, marginTop: 4 },
  statLabel: { color: colors.textTertiary, fontSize: 10, marginTop: 2 },
  formLabel: { fontWeight: '600', fontSize: 13, color: colors.textSecondary, marginTop: 8 },
  input: { marginBottom: 4, backgroundColor: colors.surface },
  ratingDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
});
