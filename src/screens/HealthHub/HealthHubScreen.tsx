import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert, Share, Platform } from 'react-native';
import { Text, Card, useTheme, Button, Portal, Dialog, TextInput, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getHealthSyncConfig,
  saveHealthSyncConfig,
  getHealthData,
  addHealthDataPoint,
  getHealthStats,
  exportAllData,
  HealthSyncConfig,
  HealthDataPoint,
} from '../../services/health/healthService';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { generateId, todayString } from '../../utils/helpers';
import { useLanguage } from '../../i18n';
import { usePremiumStore } from '../../store/premiumStore';
import { canAccessFeature, isHealthHubFullAvailable } from '../../services/premium/featureGate';
import { PaywallModal } from '../../components/PaywallModal';

export function HealthHubScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const today = todayString();

  const DATA_TYPES: { key: HealthDataPoint['type']; label: string; icon: string; color: string; unit: string; placeholder: string }[] = [
    { key: 'steps', label: t.healthHub.steps, icon: 'walk', color: colors.primary, unit: t.healthHub.stepsUnit, placeholder: '10000' },
    { key: 'heartRate', label: t.healthHub.heartRate, icon: 'heart-pulse', color: colors.red, unit: 'bpm', placeholder: '72' },
    { key: 'sleep', label: t.healthHub.sleepLabel, icon: 'sleep', color: colors.secondary, unit: t.healthHub.sleepUnit, placeholder: '7.5' },
    { key: 'activeCalories', label: t.healthHub.activeCalories, icon: 'fire', color: colors.orange, unit: 'kcal', placeholder: '350' },
  ];

  const [config, setConfig] = useState<HealthSyncConfig | null>(null);
  const [todayData, setTodayData] = useState<HealthDataPoint[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getHealthStats>> | null>(null);
  const [addDialogVisible, setAddDialogVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<HealthDataPoint['type']>('steps');
  const [inputValue, setInputValue] = useState('');
  const [paywallVisible, setPaywallVisible] = useState(false);
  const isPremium = usePremiumStore((s) => s.isPremium);
  const hasFullAccess = isHealthHubFullAvailable();

  const loadData = useCallback(async () => {
    const [cfg, data, weekStats] = await Promise.all([
      getHealthSyncConfig(),
      getHealthData(today),
      getHealthStats(7),
    ]);
    setConfig(cfg);
    setTodayData(data);
    setStats(weekStats);
  }, [today]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleAddData = async () => {
    const val = parseFloat(inputValue);
    if (isNaN(val) || val <= 0) return;
    const typeInfo = DATA_TYPES.find((t) => t.key === selectedType)!;
    await addHealthDataPoint({
      id: generateId(),
      date: today,
      type: selectedType,
      value: val,
      unit: typeInfo.unit,
      source: 'manual',
    });
    setInputValue('');
    setAddDialogVisible(false);
    loadData();
  };

  const handleExport = async () => {
    if (!canAccessFeature('data_export')) {
      setPaywallVisible(true);
      return;
    }
    try {
      const data = await exportAllData();
      if (Platform.OS === 'web') {
        Alert.alert(t.healthHub.export, t.healthHub.exportSuccess);
        return;
      }
      await Share.share({
        message: data,
        title: t.healthHub.shareTitle,
      });
    } catch (e) {
      Alert.alert(t.common.error, t.healthHub.exportFailed);
    }
  };

  const getDataValue = (type: string) => {
    const point = todayData.find((d) => d.type === type);
    return point ? point.value : null;
  };

  const openAddDialog = (type: HealthDataPoint['type']) => {
    setSelectedType(type);
    const existing = todayData.find((d) => d.type === type);
    setInputValue(existing ? existing.value.toString() : '');
    setAddDialogVisible(true);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.md, paddingBottom: 40 }}
    >
      <View style={styles.headerRow}>
        <Button mode="outlined" onPress={handleExport} icon="export" compact>
          {t.healthHub.export}
        </Button>
      </View>

      {/* Connection Status */}
      <Card style={[styles.card, { backgroundColor: colors.infoBg }]} mode="elevated">
        <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="watch" size={32} color={colors.secondary} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ fontWeight: 'bold' }}>{t.healthHub.deviceConnection}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
              {t.healthHub.manualInput}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: colors.primary }]}>
            <Text style={{ color: colors.textOnPrimary, fontSize: 10, fontWeight: 'bold' }}>{t.healthHub.active}</Text>
          </View>
        </Card.Content>
      </Card>

      {/* Today's Health Data */}
      <Text variant="titleMedium" style={styles.sectionTitle}>{t.healthHub.todayData}</Text>
      <View style={styles.dataGrid}>
        {DATA_TYPES.map((type) => {
          const value = getDataValue(type.key);
          const isLocked = !hasFullAccess && type.key !== 'steps';
          return (
            <TouchableOpacity
              key={type.key}
              style={styles.dataCard}
              onPress={() => {
                if (isLocked) { setPaywallVisible(true); return; }
                openAddDialog(type.key);
              }}
              activeOpacity={0.7}
            >
              <Card style={{ borderRadius: borderRadius.md, opacity: isLocked ? 0.6 : 1 }} mode="elevated">
                <Card.Content style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                  {isLocked && (
                    <MaterialCommunityIcons name="lock" size={16} color={colors.orange} style={{ position: 'absolute', top: 8, right: 8 }} />
                  )}
                  <MaterialCommunityIcons name={type.icon as any} size={28} color={type.color} />
                  <Text style={{ fontWeight: 'bold', fontSize: 20, marginTop: 8 }}>
                    {isLocked ? '🔒' : value !== null ? value : '--'}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{type.unit}</Text>
                  <Text style={{ fontWeight: '600', fontSize: 12, marginTop: 4 }}>{type.label}</Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          );
        })}
      </View>

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} feature="health_hub" />

      {/* Weekly Averages */}
      {stats && stats.totalEntries > 0 && (
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text style={{ fontWeight: 'bold', marginBottom: 12 }}>{t.healthHub.weeklyAverages}</Text>
            <View style={styles.statsGrid}>
              {stats.avgSteps > 0 && (
                <StatItem icon="walk" color={colors.primary} label={t.healthHub.steps} value={`${stats.avgSteps}`} />
              )}
              {stats.avgHeartRate > 0 && (
                <StatItem icon="heart-pulse" color={colors.red} label={t.healthHub.heartRate} value={`${stats.avgHeartRate} bpm`} />
              )}
              {stats.avgSleep > 0 && (
                <StatItem icon="sleep" color={colors.secondary} label={t.healthHub.sleepLabel} value={`${stats.avgSleep}s`} />
              )}
              {stats.avgActiveCalories > 0 && (
                <StatItem icon="fire" color={colors.orange} label={t.healthHub.activeCalories} value={`${stats.avgActiveCalories}`} />
              )}
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Info Card */}
      <Card style={[styles.card, { backgroundColor: colors.warningBg }]} mode="elevated">
        <Card.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <MaterialCommunityIcons name="information" size={20} color={colors.orange} />
            <Text style={{ fontWeight: 'bold', marginLeft: 8, color: colors.orange }}>{t.healthHub.info}</Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
            {t.healthHub.infoText}
          </Text>
        </Card.Content>
      </Card>

      {/* Add Data Dialog */}
      <Portal>
        <Dialog visible={addDialogVisible} onDismiss={() => setAddDialogVisible(false)}>
          <Dialog.Title>{DATA_TYPES.find((dt) => dt.key === selectedType)?.label} - {t.healthHub.addValue}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label={`${t.healthHub.valueLabel} (${DATA_TYPES.find((dt) => dt.key === selectedType)?.unit})`}
              value={inputValue}
              onChangeText={setInputValue}
              keyboardType="numeric"
              mode="outlined"
              dense
              placeholder={DATA_TYPES.find((dt) => dt.key === selectedType)?.placeholder}
              style={{ backgroundColor: colors.surface }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddDialogVisible(false)}>{t.common.cancel}</Button>
            <Button onPress={handleAddData} disabled={!inputValue.trim()}>{t.common.save}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

function StatItem({ icon, color, label, value }: { icon: string; color: string; label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <MaterialCommunityIcons name={icon as any} size={20} color={color} />
      <Text style={{ fontWeight: 'bold', fontSize: 14, marginTop: 4 }}>{value}</Text>
      <Text style={{ color: colors.textTertiary, fontSize: 10 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontWeight: 'bold' },
  sectionTitle: { fontWeight: 'bold', marginBottom: spacing.sm },
  card: { borderRadius: borderRadius.lg, marginBottom: spacing.md },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  dataGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  dataCard: { width: '48%', flexGrow: 1 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap' },
  statItem: { alignItems: 'center', minWidth: 70 },
});
