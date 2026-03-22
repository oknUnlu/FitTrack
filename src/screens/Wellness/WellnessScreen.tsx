import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Vibration, AppState } from 'react-native';
import { Text, Card, useTheme, Button, Portal, Dialog, TextInput, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getWellnessEntryByDate,
  addWellnessEntry,
  getWellnessStats,
  WellnessEntry,
} from '../../services/wellness/wellnessService';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { generateId, todayString } from '../../utils/helpers';

const MOOD_OPTIONS: { key: WellnessEntry['mood']; icon: string; label: string; color: string }[] = [
  { key: 'great', icon: 'emoticon-excited', label: 'Harika', color: '#4CAF50' },
  { key: 'good', icon: 'emoticon-happy', label: 'İyi', color: '#8BC34A' },
  { key: 'neutral', icon: 'emoticon-neutral', label: 'Normal', color: '#FFC107' },
  { key: 'bad', icon: 'emoticon-sad', label: 'Kötü', color: '#FF9800' },
  { key: 'terrible', icon: 'emoticon-dead', label: 'Berbat', color: '#F44336' },
];

const SLEEP_QUALITY_LABELS = ['', 'Çok Kötü', 'Kötü', 'Normal', 'İyi', 'Mükemmel'];

export function WellnessScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const today = todayString();

  const [entry, setEntry] = useState<WellnessEntry | null>(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [meditationActive, setMeditationActive] = useState(false);
  const [meditationSeconds, setMeditationSeconds] = useState(0);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getWellnessStats>> | null>(null);
  const meditationTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Form state
  const [formSleepHours, setFormSleepHours] = useState('7');
  const [formSleepQuality, setFormSleepQuality] = useState<number>(3);
  const [formStressLevel, setFormStressLevel] = useState<number>(3);
  const [formMood, setFormMood] = useState<WellnessEntry['mood']>('neutral');
  const [formEnergyLevel, setFormEnergyLevel] = useState<number>(3);
  const [formNotes, setFormNotes] = useState('');

  const loadData = useCallback(async () => {
    const [todayEntry, weekStats] = await Promise.all([
      getWellnessEntryByDate(today),
      getWellnessStats(7),
    ]);
    setEntry(todayEntry);
    setStats(weekStats);
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

  const startMeditation = () => {
    setMeditationActive(true);
    setMeditationSeconds(0);
    meditationTimer.current = setInterval(() => {
      setMeditationSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopMeditation = async () => {
    if (meditationTimer.current) clearInterval(meditationTimer.current);
    setMeditationActive(false);
    const addedMinutes = Math.max(1, Math.round(meditationSeconds / 60));
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

  const getMoodEmoji = (mood: string) => MOOD_OPTIONS.find((m) => m.key === mood);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.md, paddingBottom: 40 }}
    >
      <View style={styles.headerRow}>
        <Text variant="headlineSmall" style={styles.title}>Wellness</Text>
        <Button mode="contained" onPress={() => setDialogVisible(true)} icon="pencil" compact>
          {entry ? 'Güncelle' : 'Kaydet'}
        </Button>
      </View>

      {/* Today's Summary */}
      {entry ? (
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Bugünkü Durum</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <MaterialCommunityIcons name="sleep" size={24} color="#5C6BC0" />
                <Text style={styles.summaryValue}>{entry.sleepHours}s</Text>
                <Text style={styles.summaryLabel}>Uyku</Text>
              </View>
              <View style={styles.summaryItem}>
                <MaterialCommunityIcons name={(getMoodEmoji(entry.mood)?.icon || 'emoticon') as any} size={24} color={getMoodEmoji(entry.mood)?.color || '#999'} />
                <Text style={styles.summaryValue}>{getMoodEmoji(entry.mood)?.label}</Text>
                <Text style={styles.summaryLabel}>Ruh Hali</Text>
              </View>
              <View style={styles.summaryItem}>
                <MaterialCommunityIcons name="lightning-bolt" size={24} color="#FF9800" />
                <Text style={styles.summaryValue}>{entry.energyLevel}/5</Text>
                <Text style={styles.summaryLabel}>Enerji</Text>
              </View>
              <View style={styles.summaryItem}>
                <MaterialCommunityIcons name="head-heart" size={24} color="#E91E63" />
                <Text style={styles.summaryValue}>{entry.stressLevel}/5</Text>
                <Text style={styles.summaryLabel}>Stres</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      ) : (
        <Card style={styles.card} mode="elevated">
          <Card.Content style={{ alignItems: 'center', padding: spacing.lg }}>
            <MaterialCommunityIcons name="heart-pulse" size={48} color="#ccc" />
            <Text style={{ color: '#999', marginTop: 8 }}>Bugün henüz kayıt yok</Text>
            <Button mode="outlined" onPress={() => setDialogVisible(true)} style={{ marginTop: 12 }}>
              Günlük Kayıt Ekle
            </Button>
          </Card.Content>
        </Card>
      )}

      {/* Meditation Timer */}
      <Card style={styles.card} mode="elevated">
        <Card.Content style={{ alignItems: 'center' }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 12 }}>Meditasyon Zamanlayıcı</Text>
          <View style={[styles.meditationCircle, meditationActive && styles.meditationCircleActive]}>
            <Text style={styles.meditationTime}>{formatTime(meditationSeconds)}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            {!meditationActive ? (
              <Button mode="contained" onPress={startMeditation} icon="play" style={{ backgroundColor: '#4CAF50' }}>
                Başlat
              </Button>
            ) : (
              <Button mode="contained" onPress={stopMeditation} icon="stop" style={{ backgroundColor: '#F44336' }}>
                Bitir
              </Button>
            )}
          </View>
          {entry && entry.meditationMinutes > 0 && (
            <Text style={{ color: '#999', marginTop: 8, fontSize: 12 }}>
              Bugün toplam: {entry.meditationMinutes} dk
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* Weekly Stats */}
      {stats && stats.totalEntries > 0 && (
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text style={{ fontWeight: 'bold', marginBottom: 12 }}>Haftalık Özet</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="sleep" size={20} color="#5C6BC0" />
                <Text style={styles.statValue}>{stats.avgSleep}s</Text>
                <Text style={styles.statLabel}>Ort. Uyku</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="head-heart" size={20} color="#E91E63" />
                <Text style={styles.statValue}>{stats.avgStress}/5</Text>
                <Text style={styles.statLabel}>Ort. Stres</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FF9800" />
                <Text style={styles.statValue}>{stats.avgEnergy}/5</Text>
                <Text style={styles.statLabel}>Ort. Enerji</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="meditation" size={20} color="#9C27B0" />
                <Text style={styles.statValue}>{stats.avgMeditation}dk</Text>
                <Text style={styles.statLabel}>Ort. Meditasyon</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Entry Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)} style={{ maxHeight: '80%' }}>
          <Dialog.Title>Günlük Wellness Kaydı</Dialog.Title>
          <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 8 }}>
              {/* Sleep */}
              <Text style={styles.formLabel}>Uyku Süresi (saat)</Text>
              <TextInput
                value={formSleepHours}
                onChangeText={setFormSleepHours}
                keyboardType="numeric"
                mode="outlined"
                dense
                style={styles.input}
              />

              {/* Sleep Quality */}
              <Text style={styles.formLabel}>Uyku Kalitesi</Text>
              {renderRatingDots(formSleepQuality, setFormSleepQuality, '#5C6BC0')}
              <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{SLEEP_QUALITY_LABELS[formSleepQuality]}</Text>

              {/* Mood */}
              <Text style={[styles.formLabel, { marginTop: 12 }]}>Ruh Hali</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                {MOOD_OPTIONS.map((m) => (
                  <TouchableOpacity key={m.key} onPress={() => setFormMood(m.key)}>
                    <View style={[styles.moodOption, formMood === m.key && { backgroundColor: m.color + '20', borderColor: m.color }]}>
                      <MaterialCommunityIcons name={m.icon as any} size={24} color={formMood === m.key ? m.color : '#999'} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Energy */}
              <Text style={[styles.formLabel, { marginTop: 12 }]}>Enerji Seviyesi</Text>
              {renderRatingDots(formEnergyLevel, setFormEnergyLevel, '#FF9800')}

              {/* Stress */}
              <Text style={[styles.formLabel, { marginTop: 12 }]}>Stres Seviyesi</Text>
              {renderRatingDots(formStressLevel, setFormStressLevel, '#E91E63')}

              {/* Notes */}
              <Text style={[styles.formLabel, { marginTop: 12 }]}>Notlar</Text>
              <TextInput
                value={formNotes}
                onChangeText={setFormNotes}
                mode="outlined"
                dense
                multiline
                numberOfLines={2}
                style={styles.input}
                placeholder="İsteğe bağlı..."
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>İptal</Button>
            <Button onPress={handleSave}>Kaydet</Button>
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
  summaryLabel: { color: '#999', fontSize: 11 },
  meditationCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  meditationCircleActive: { borderColor: '#4CAF50' },
  meditationTime: { fontSize: 32, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontWeight: 'bold', fontSize: 14, marginTop: 4 },
  statLabel: { color: '#999', fontSize: 10, marginTop: 2 },
  formLabel: { fontWeight: '600', fontSize: 13, color: '#555', marginTop: 8 },
  input: { marginBottom: 4, backgroundColor: '#fff' },
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
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
