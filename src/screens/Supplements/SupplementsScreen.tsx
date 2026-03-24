import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, Card, useTheme, TextInput, Button, Portal, Dialog, IconButton, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getSupplements,
  addSupplement,
  removeSupplement,
  getSupplementLogs,
  toggleSupplementLog,
  Supplement,
  SupplementLog,
} from '../../services/supplements/supplementService';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';
import { generateId, todayString } from '../../utils/helpers';

const TIME_ICONS: Record<string, string> = {
  morning: 'weather-sunny',
  afternoon: 'weather-partly-cloudy',
  evening: 'weather-night',
  pre_workout: 'run',
  post_workout: 'arm-flex',
};

const TIME_LABEL_KEYS: Record<string, string> = {
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
  pre_workout: 'preWorkout',
  post_workout: 'postWorkout',
};

export function SupplementsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const today = todayString();

  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [logs, setLogs] = useState<SupplementLog[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<string>('morning');

  const loadData = useCallback(async () => {
    const [sups, todayLogs] = await Promise.all([
      getSupplements(),
      getSupplementLogs(today),
    ]);
    setSupplements(sups);
    setLogs(todayLogs);
  }, [today]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleAdd = async () => {
    if (!name.trim()) return;
    await addSupplement({
      id: generateId(),
      name: name.trim(),
      dosage: dosage.trim(),
      frequency: 'daily',
      timeOfDay: timeOfDay as any,
      notes: '',
    });
    setName(''); setDosage(''); setTimeOfDay('morning');
    setDialogVisible(false);
    loadData();
  };

  const handleRemove = async (id: string) => {
    Alert.alert(t.common.delete, '', [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: async () => {
        await removeSupplement(id);
        loadData();
      }},
    ]);
  };

  const handleToggle = async (supplementId: string) => {
    await toggleSupplementLog(supplementId, today);
    loadData();
  };

  const isTaken = (id: string) => logs.find((l) => l.supplementId === id)?.taken ?? false;
  const takenCount = supplements.filter((s) => isTaken(s.id)).length;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.md, paddingBottom: 40 }}
    >
      <View style={styles.headerRow}>
        <Button mode="contained" onPress={() => setDialogVisible(true)} icon="plus" compact>
          {t.common.add}
        </Button>
      </View>

      {/* Today progress */}
      {supplements.length > 0 && (
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: 'bold' }}>{t.supplements.today}</Text>
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{takenCount}/{supplements.length}</Text>
            </View>
            <View style={[styles.progressBg, { marginTop: 8 }]}>
              <View style={[styles.progressFill, { width: `${supplements.length > 0 ? (takenCount / supplements.length) * 100 : 0}%` }]} />
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Supplement list */}
      {supplements.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="pill" size={48} color={colors.textDisabled} />
          <Text style={{ color: colors.textTertiary, marginTop: 8 }}>{t.supplements.noSupplements}</Text>
        </View>
      ) : (
        supplements.map((s) => {
          const taken = isTaken(s.id);
          return (
            <Card key={s.id} style={[styles.supCard, taken && styles.supCardDone]} mode="elevated">
              <Card.Content style={styles.supRow}>
                <TouchableOpacity
                  style={[styles.checkbox, taken && styles.checkboxDone]}
                  onPress={() => handleToggle(s.id)}
                >
                  {taken && <MaterialCommunityIcons name="check" size={18} color="#fff" />}
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.supName, taken && styles.supNameDone]}>{s.name}</Text>
                  {s.dosage ? <Text style={styles.supDosage}>{s.dosage}</Text> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                    <MaterialCommunityIcons name={(TIME_ICONS[s.timeOfDay] || 'clock') as any} size={14} color="#999" />
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>{(t.supplements as any)[TIME_LABEL_KEYS[s.timeOfDay]] || s.timeOfDay}</Text>
                  </View>
                </View>
                <IconButton icon="delete-outline" size={18} onPress={() => handleRemove(s.id)} />
              </Card.Content>
            </Card>
          );
        })
      )}

      {/* Add Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)} style={{ maxHeight: '80%' }}>
          <Dialog.Title>{t.supplements.addSupplement}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 8 }}>
              <TextInput label={t.supplements.supplementName} value={name} onChangeText={setName} mode="outlined" style={styles.input} dense placeholder="Vitamin D3" />
              <TextInput label={t.supplements.dosage} value={dosage} onChangeText={setDosage} mode="outlined" style={styles.input} dense placeholder="1000 IU" />
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8, marginBottom: 4 }}>{t.supplements.intakeTime}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(TIME_LABEL_KEYS).map(([key, labelKey]) => (
                  <Chip
                    key={key}
                    selected={timeOfDay === key}
                    onPress={() => setTimeOfDay(key)}
                    compact
                    textStyle={{ fontSize: 11 }}
                  >
                    {(t.supplements as any)[labelKey] || key}
                  </Chip>
                ))}
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>{t.common.cancel}</Button>
            <Button onPress={handleAdd} disabled={!name.trim()}>{t.common.add}</Button>
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
  progressBg: { height: 8, borderRadius: 4, backgroundColor: colors.border },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  supCard: { borderRadius: borderRadius.md, marginBottom: 8 },
  supCardDone: { opacity: 0.7 },
  supRow: { flexDirection: 'row', alignItems: 'center' },
  supName: { fontWeight: '600', fontSize: 15 },
  supNameDone: { textDecorationLine: 'line-through', color: colors.textTertiary },
  supDosage: { color: colors.textTertiary, fontSize: 12 },
  checkbox: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  checkboxDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  input: { marginBottom: 8, backgroundColor: colors.surface },
});
