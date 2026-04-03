import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert, Animated } from 'react-native';
import { Text, useTheme, TextInput, Button, Portal, Dialog, Chip } from 'react-native-paper';
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
import { colors, spacing, borderRadius, getSemanticColors } from '../../theme/theme';
import { useLanguage } from '../../i18n';
import { generateId, todayString } from '../../utils/helpers';
import { usePremiumStore } from '../../store/premiumStore';
import { PaywallModal } from '../../components/PaywallModal';

const TIME_ICONS: Record<string, string> = {
  morning: 'weather-sunny',
  afternoon: 'weather-partly-cloudy',
  evening: 'weather-night',
  pre_workout: 'run',
  post_workout: 'arm-flex',
};

const TIME_COLORS: Record<string, string> = {
  morning: '#FF9800',
  afternoon: '#2196F3',
  evening: '#7C4DFF',
  pre_workout: '#4CAF50',
  post_workout: '#E91E63',
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
  const isDark = theme.dark;
  const sc = getSemanticColors(isDark);
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const today = todayString();

  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [logs, setLogs] = useState<SupplementLog[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const isPremium = usePremiumStore((s) => s.isPremium);
  const FREE_SUPPLEMENT_LIMIT = 3;

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
  const progressPercent = supplements.length > 0 ? (takenCount / supplements.length) * 100 : 0;

  // Group supplements by time of day
  const groupedSupplements = supplements.reduce((acc, sup) => {
    const key = sup.timeOfDay || 'morning';
    if (!acc[key]) acc[key] = [];
    acc[key].push(sup);
    return acc;
  }, {} as Record<string, Supplement[]>);

  const timeOrder = ['morning', 'afternoon', 'evening', 'pre_workout', 'post_workout'];
  const sortedGroups = timeOrder.filter((key) => groupedSupplements[key]?.length > 0);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: insets.bottom + 40 }}
    >
      {/* Hero Progress Card */}
      {supplements.length > 0 && (
        <View style={[styles.heroCard, { backgroundColor: isDark ? '#1B3A1B' : '#E8F5E9' }]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={[styles.heroTitle, { color: sc.textPrimary }]}>{t.supplements.today}</Text>
              <Text style={[styles.heroSubtitle, { color: sc.textSecondary }]}>
                {takenCount === supplements.length
                  ? '\u2728 ' + ((t.supplements as any).allTaken || 'All taken!')
                  : `${supplements.length - takenCount} remaining`}
              </Text>
            </View>
            <View style={styles.heroCircleContainer}>
              <View style={[styles.heroCircleBg, { borderColor: isDark ? '#2E5A2E' : '#C8E6C9' }]}>
                <View style={[
                  styles.heroCircleFill,
                  {
                    borderColor: progressPercent >= 100 ? '#4CAF50' : progressPercent > 0 ? '#66BB6A' : 'transparent',
                    borderTopColor: progressPercent >= 100 ? '#4CAF50' : progressPercent >= 75 ? '#66BB6A' : progressPercent >= 50 ? '#FFA726' : progressPercent > 0 ? '#EF5350' : 'transparent',
                  },
                ]}>
                  <Text style={[styles.heroCircleText, { color: colors.primary }]}>
                    {takenCount}/{supplements.length}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          {/* Progress Bar */}
          <View style={[styles.progressBg, { backgroundColor: isDark ? '#2E5A2E' : '#C8E6C9' }]}>
            <View style={[
              styles.progressFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: progressPercent >= 100 ? '#4CAF50' : progressPercent >= 50 ? '#66BB6A' : '#FFA726',
              },
            ]} />
          </View>
        </View>
      )}

      {/* Add Button */}
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: isDark ? sc.surface : '#fff', borderColor: sc.border }]}
        onPress={() => {
          if (!isPremium && supplements.length >= FREE_SUPPLEMENT_LIMIT) {
            setPaywallVisible(true);
            return;
          }
          setDialogVisible(true);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.addIconCircle}>
          <MaterialCommunityIcons name="plus" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.addButtonText, { color: sc.textPrimary }]}>{t.supplements.addSupplement}</Text>
          <Text style={{ fontSize: 12, color: sc.textTertiary }}>
            {!isPremium && supplements.length < FREE_SUPPLEMENT_LIMIT
              ? `${supplements.length}/${FREE_SUPPLEMENT_LIMIT} free`
              : !isPremium && supplements.length >= FREE_SUPPLEMENT_LIMIT
              ? 'Upgrade for more'
              : 'Unlimited'}
          </Text>
        </View>
        {!isPremium && supplements.length >= FREE_SUPPLEMENT_LIMIT && (
          <View style={styles.proBadge}>
            <MaterialCommunityIcons name="lock" size={12} color="#FFD700" />
            <Text style={styles.proBadgeText}>PRO</Text>
          </View>
        )}
        <MaterialCommunityIcons name="chevron-right" size={24} color={sc.textTertiary} />
      </TouchableOpacity>

      {/* Empty State */}
      {supplements.length === 0 && (
        <View style={[styles.emptyState, { backgroundColor: isDark ? sc.surface : '#fff' }]}>
          <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? '#1B3A1B' : '#E8F5E9' }]}>
            <MaterialCommunityIcons name="pill" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: sc.textPrimary }]}>{t.supplements.noSupplements}</Text>
          <Text style={[styles.emptySubtitle, { color: sc.textTertiary }]}>
            {t.supplements.addSupplement}
          </Text>
        </View>
      )}

      {/* Grouped Supplement List */}
      {sortedGroups.map((timeKey) => {
        const groupSupps = groupedSupplements[timeKey];
        const timeColor = TIME_COLORS[timeKey] || colors.primary;
        const timeIcon = TIME_ICONS[timeKey] || 'clock';
        const timeLabel = (t.supplements as any)[TIME_LABEL_KEYS[timeKey]] || timeKey;
        const groupTaken = groupSupps.filter((s) => isTaken(s.id)).length;

        return (
          <View key={timeKey} style={styles.groupContainer}>
            {/* Group Header */}
            <View style={styles.groupHeader}>
              <View style={[styles.groupIconCircle, { backgroundColor: timeColor + '20' }]}>
                <MaterialCommunityIcons name={timeIcon as any} size={16} color={timeColor} />
              </View>
              <Text style={[styles.groupTitle, { color: sc.textPrimary }]}>{timeLabel}</Text>
              <View style={[styles.groupBadge, { backgroundColor: groupTaken === groupSupps.length ? colors.primary + '20' : sc.surfaceVariant }]}>
                <Text style={[styles.groupBadgeText, { color: groupTaken === groupSupps.length ? colors.primary : sc.textTertiary }]}>
                  {groupTaken}/{groupSupps.length}
                </Text>
              </View>
            </View>

            {/* Supplement Cards */}
            <View style={[styles.groupCards, { backgroundColor: isDark ? sc.surface : '#fff', borderColor: sc.border }]}>
              {groupSupps.map((s, index) => {
                const taken = isTaken(s.id);
                return (
                  <View key={s.id}>
                    <TouchableOpacity
                      style={styles.supItem}
                      onPress={() => handleToggle(s.id)}
                      activeOpacity={0.6}
                    >
                      <View style={[
                        styles.checkbox,
                        taken && styles.checkboxDone,
                        !taken && { borderColor: timeColor + '60' },
                      ]}>
                        {taken && <MaterialCommunityIcons name="check" size={16} color="#fff" />}
                      </View>
                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={[
                          styles.supName,
                          { color: sc.textPrimary },
                          taken && styles.supNameDone,
                          taken && { color: sc.textTertiary },
                        ]}>
                          {s.name}
                        </Text>
                        {s.dosage ? (
                          <Text style={[styles.supDosage, { color: sc.textTertiary }]}>{s.dosage}</Text>
                        ) : null}
                      </View>
                      {taken && (
                        <View style={[styles.takenBadge, { backgroundColor: colors.primary + '15' }]}>
                          <MaterialCommunityIcons name="check-circle" size={14} color={colors.primary} />
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={() => handleRemove(s.id)}
                        style={styles.deleteBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color={sc.textDisabled} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                    {index < groupSupps.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: sc.divider }]} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} feature="supplements" />

      {/* Add Dialog */}
      <Portal>
        <Dialog
          visible={dialogVisible}
          onDismiss={() => setDialogVisible(false)}
          style={[styles.dialog, { backgroundColor: isDark ? sc.surface : '#fff' }]}
        >
          <View style={styles.dialogHeader}>
            <View style={[styles.dialogIconCircle, { backgroundColor: colors.primary + '15' }]}>
              <MaterialCommunityIcons name="pill" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.dialogTitle, { color: sc.textPrimary }]}>{t.supplements.addSupplement}</Text>
          </View>
          <Dialog.ScrollArea style={{ paddingHorizontal: 0, borderTopWidth: 0, borderBottomWidth: 0 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 8 }}>
              <TextInput
                label={t.supplements.supplementName}
                value={name}
                onChangeText={setName}
                mode="outlined"
                style={styles.input}
                dense
                placeholder="Vitamin D3"
                left={<TextInput.Icon icon="pill" />}
              />
              <TextInput
                label={t.supplements.dosage}
                value={dosage}
                onChangeText={setDosage}
                mode="outlined"
                style={styles.input}
                dense
                placeholder="1000 IU"
                left={<TextInput.Icon icon="scale" />}
              />
              <Text style={[styles.timeLabel, { color: sc.textSecondary }]}>{t.supplements.intakeTime}</Text>
              <View style={styles.chipRow}>
                {Object.entries(TIME_LABEL_KEYS).map(([key, labelKey]) => {
                  const isSelected = timeOfDay === key;
                  const chipColor = TIME_COLORS[key] || colors.primary;
                  return (
                    <Chip
                      key={key}
                      selected={isSelected}
                      onPress={() => setTimeOfDay(key)}
                      style={[
                        styles.timeChip,
                        isSelected && { backgroundColor: chipColor + '20', borderColor: chipColor },
                        !isSelected && { borderColor: sc.border },
                      ]}
                      textStyle={[
                        styles.timeChipText,
                        isSelected && { color: chipColor, fontWeight: '600' },
                        !isSelected && { color: sc.textSecondary },
                      ]}
                      icon={() => (
                        <MaterialCommunityIcons
                          name={(TIME_ICONS[key] || 'clock') as any}
                          size={16}
                          color={isSelected ? chipColor : sc.textTertiary}
                        />
                      )}
                      showSelectedCheck={false}
                    >
                      {(t.supplements as any)[labelKey] || key}
                    </Chip>
                  );
                })}
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <View style={styles.dialogActions}>
            <TouchableOpacity
              onPress={() => setDialogVisible(false)}
              style={[styles.dialogBtn, styles.dialogBtnCancel, { borderColor: sc.border }]}
            >
              <Text style={[styles.dialogBtnText, { color: sc.textSecondary }]}>{t.common.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAdd}
              style={[styles.dialogBtn, styles.dialogBtnAdd, !name.trim() && { opacity: 0.5 }]}
              disabled={!name.trim()}
            >
              <MaterialCommunityIcons name="plus" size={18} color="#fff" />
              <Text style={[styles.dialogBtnText, { color: '#fff', marginLeft: 4 }]}>{t.common.add}</Text>
            </TouchableOpacity>
          </View>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Hero Card
  heroCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  heroSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  heroCircleContainer: {
    alignItems: 'center',
  },
  heroCircleBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCircleFill: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCircleText: {
    fontSize: 15,
    fontWeight: '800',
  },
  progressBg: {
    height: 8,
    borderRadius: 4,
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },

  // Add Button
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: spacing.lg,
  },
  addIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
    marginRight: 8,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFD700',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    borderRadius: borderRadius.xl,
    marginTop: spacing.md,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
  },

  // Group
  groupContainer: {
    marginBottom: spacing.lg,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: 4,
  },
  groupIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  groupBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  groupCards: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },

  // Supplement Item
  supItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  supName: {
    fontWeight: '600',
    fontSize: 15,
  },
  supNameDone: {
    textDecorationLine: 'line-through',
  },
  supDosage: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  takenBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  deleteBtn: {
    padding: 4,
    marginLeft: 4,
  },

  // Dialog
  dialog: {
    borderRadius: borderRadius.xl,
    maxHeight: '80%',
  },
  dialogHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 8,
  },
  dialogIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  input: {
    marginBottom: 12,
  },
  timeLabel: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 8,
    fontWeight: '500',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeChip: {
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  timeChipText: {
    fontSize: 12,
  },
  dialogActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
  },
  dialogBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
  },
  dialogBtnCancel: {
    borderWidth: 1,
  },
  dialogBtnAdd: {
    backgroundColor: colors.primary,
  },
  dialogBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
