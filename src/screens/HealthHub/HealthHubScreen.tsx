import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert, Share, Platform, ActivityIndicator } from 'react-native';
import { Text, Card, useTheme, Button, Portal, Dialog, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  exportAllData,
  HealthDataPoint,
} from '../../services/health/healthService';
import { getHealthServiceName } from '../../services/health/nativeHealthAdapter';
import { useHealthStore } from '../../store/healthStore';
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
  const healthTexts = (t as any).healthHub || {};

  const DATA_TYPES: { key: HealthDataPoint['type']; label: string; icon: string; color: string; unit: string; placeholder: string }[] = [
    { key: 'steps', label: healthTexts.steps, icon: 'walk', color: colors.primary, unit: healthTexts.stepsUnit, placeholder: '10000' },
    { key: 'heartRate', label: healthTexts.heartRate, icon: 'heart-pulse', color: colors.red, unit: 'bpm', placeholder: '72' },
    { key: 'sleep', label: healthTexts.sleepLabel, icon: 'sleep', color: colors.secondary, unit: healthTexts.sleepUnit, placeholder: '7.5' },
    { key: 'activeCalories', label: healthTexts.activeCalories, icon: 'fire', color: colors.orange, unit: 'kcal', placeholder: '350' },
  ];

  // Store
  const config = useHealthStore((s) => s.config);
  const todayData = useHealthStore((s) => s.todayData);
  const stats = useHealthStore((s) => s.stats);
  const isLoading = useHealthStore((s) => s.isLoading);
  const isSyncing = useHealthStore((s) => s.isSyncing);
  const isNativeAvailable = useHealthStore((s) => s.isNativeAvailable);
  const connectionError = useHealthStore((s) => s.connectionError);
  const loadConfig = useHealthStore((s) => s.loadConfig);
  const loadTodayData = useHealthStore((s) => s.loadTodayData);
  const loadStats = useHealthStore((s) => s.loadStats);
  const addDataPoint = useHealthStore((s) => s.addDataPoint);
  const checkNativeAvailability = useHealthStore((s) => s.checkNativeAvailability);
  const connectHealth = useHealthStore((s) => s.connect);
  const disconnectHealth = useHealthStore((s) => s.disconnect);
  const syncNative = useHealthStore((s) => s.syncNative);

  const [addDialogVisible, setAddDialogVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<HealthDataPoint['type']>('steps');
  const [inputValue, setInputValue] = useState('');
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const isPremium = usePremiumStore((s) => s.isPremium);
  const hasFullAccess = isHealthHubFullAvailable();

  const serviceName = getHealthServiceName();

  const loadData = useCallback(async () => {
    await Promise.all([
      loadConfig(),
      loadTodayData(today),
      loadStats(7),
      checkNativeAvailability(),
    ]);
  }, [today]);

  // Auto-sync when screen is focused and connected
  useFocusEffect(useCallback(() => {
    loadData().then(() => {
      const currentConfig = useHealthStore.getState().config;
      if (currentConfig.isConnected) {
        syncNative();
      }
    });
  }, [loadData]));

  const handleAddData = async () => {
    const val = parseFloat(inputValue);
    if (isNaN(val) || val <= 0) return;
    const typeInfo = DATA_TYPES.find((t) => t.key === selectedType)!;
    await addDataPoint({
      id: generateId(),
      date: today,
      type: selectedType,
      value: val,
      unit: typeInfo.unit,
      source: 'manual',
    });
    setInputValue('');
    setAddDialogVisible(false);
    loadStats(7);
  };

  const handleExport = async () => {
    if (!canAccessFeature('data_export')) {
      setPaywallVisible(true);
      return;
    }
    try {
      const data = await exportAllData();
      if (Platform.OS === 'web') {
        Alert.alert(healthTexts.export, healthTexts.exportSuccess);
        return;
      }
      await Share.share({
        message: data,
        title: healthTexts.shareTitle,
      });
    } catch (e) {
      Alert.alert(t.common.error, healthTexts.exportFailed);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    const success = await connectHealth();
    setIsConnecting(false);
    if (success) {
      loadTodayData(today);
      loadStats(7);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      healthTexts.disconnect || 'Bağlantıyı Kes',
      healthTexts.disconnectConfirm || `${serviceName} bağlantısı kesilecek. Verileriniz korunacak.`,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: healthTexts.disconnect || 'Bağlantıyı Kes',
          style: 'destructive',
          onPress: async () => {
            await disconnectHealth();
            loadConfig();
          },
        },
      ]
    );
  };

  const handleSync = async () => {
    await syncNative();
    loadStats(7);
  };

  const getDataValue = (type: string) => {
    const point = todayData.find((d) => d.type === type);
    return point ? point.value : null;
  };

  const getDataSource = (type: string) => {
    const point = todayData.find((d) => d.type === type);
    return point?.source || null;
  };

  const openAddDialog = (type: HealthDataPoint['type']) => {
    setSelectedType(type);
    const existing = todayData.find((d) => d.type === type);
    setInputValue(existing ? existing.value.toString() : '');
    setAddDialogVisible(true);
  };

  const formatLastSync = (dateStr: string | null): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const hours = date.getHours().toString().padStart(2, '0');
      const mins = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${mins}`;
    } catch {
      return '';
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.md, paddingBottom: 40 }}
    >
      <View style={styles.headerRow}>
        <Button mode="outlined" onPress={handleExport} icon="export" compact>
          {healthTexts.export}
        </Button>
      </View>

      {/* Connection Status Card */}
      <Card style={[styles.card, { backgroundColor: config.isConnected ? colors.successBg || '#E8F5E9' : colors.infoBg }]} mode="elevated">
        <Card.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons
              name={config.isConnected ? 'heart-pulse' : 'watch'}
              size={32}
              color={config.isConnected ? colors.primary : colors.secondary}
            />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={{ fontWeight: 'bold' }}>
                {config.isConnected ? serviceName : (healthTexts.deviceConnection || 'Cihaz Bağlantısı')}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                {config.isConnected
                  ? config.lastSyncDate
                    ? `${healthTexts.lastSync || 'Son senkronizasyon'}: ${formatLastSync(config.lastSyncDate)}`
                    : (healthTexts.connected || 'Bağlı')
                  : isNativeAvailable
                    ? (healthTexts.tapToConnect || `${serviceName} bağlantısı için dokunun`)
                    : (healthTexts.manualInput || 'Manuel veri girişi aktif')
                }
              </Text>
            </View>

            {config.isConnected ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {isSyncing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <TouchableOpacity onPress={handleSync} style={styles.syncButton}>
                    <MaterialCommunityIcons name="sync" size={20} color={colors.primary} />
                  </TouchableOpacity>
                )}
                <View style={[styles.statusBadge, { backgroundColor: colors.primary }]}>
                  <Text style={{ color: colors.textOnPrimary, fontSize: 10, fontWeight: 'bold' }}>
                    {healthTexts.connected || 'Bağlı'}
                  </Text>
                </View>
              </View>
            ) : isNativeAvailable ? (
              <Button
                mode="contained"
                onPress={handleConnect}
                loading={isConnecting}
                disabled={isConnecting}
                compact
                buttonColor={colors.primary}
                style={{ borderRadius: 20 }}
              >
                {healthTexts.connect || 'Bağlan'}
              </Button>
            ) : (
              <View style={[styles.statusBadge, { backgroundColor: colors.textTertiary }]}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                  {healthTexts.manual || 'Manuel'}
                </Text>
              </View>
            )}
          </View>

          {/* Disconnect option */}
          {config.isConnected && (
            <TouchableOpacity onPress={handleDisconnect} style={{ marginTop: spacing.sm }}>
              <Text style={{ color: colors.textTertiary, fontSize: 12, textDecorationLine: 'underline' }}>
                {healthTexts.disconnect || 'Bağlantıyı kes'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Connection error */}
          {connectionError && !config.isConnected && (
            <View style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="alert-circle" size={14} color={colors.red} />
              <Text style={{ color: colors.red, fontSize: 12, marginLeft: 4 }}>
                {connectionError === 'permission_denied'
                  ? (healthTexts.permissionDenied || 'İzin reddedildi. Ayarlardan izin verin.')
                  : (healthTexts.connectionFailed || 'Bağlantı başarısız. Tekrar deneyin.')}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Today's Health Data */}
      <Text variant="titleMedium" style={styles.sectionTitle}>{healthTexts.todayData}</Text>
      <View style={styles.dataGrid}>
        {DATA_TYPES.map((type) => {
          const value = getDataValue(type.key);
          const source = getDataSource(type.key);
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
                  {/* Source indicator */}
                  {!isLocked && source && source !== 'manual' && (
                    <MaterialCommunityIcons
                      name={source === 'healthkit' ? 'apple' : 'google-fit'}
                      size={12}
                      color={colors.textTertiary}
                      style={{ position: 'absolute', top: 8, left: 8 }}
                    />
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
            <Text style={{ fontWeight: 'bold', marginBottom: 12 }}>{healthTexts.weeklyAverages}</Text>
            <View style={styles.statsGrid}>
              {stats.avgSteps > 0 && (
                <StatItem icon="walk" color={colors.primary} label={healthTexts.steps} value={`${stats.avgSteps}`} />
              )}
              {stats.avgHeartRate > 0 && (
                <StatItem icon="heart-pulse" color={colors.red} label={healthTexts.heartRate} value={`${stats.avgHeartRate} bpm`} />
              )}
              {stats.avgSleep > 0 && (
                <StatItem icon="sleep" color={colors.secondary} label={healthTexts.sleepLabel} value={`${stats.avgSleep}s`} />
              )}
              {stats.avgActiveCalories > 0 && (
                <StatItem icon="fire" color={colors.orange} label={healthTexts.activeCalories} value={`${stats.avgActiveCalories}`} />
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
            <Text style={{ fontWeight: 'bold', marginLeft: 8, color: colors.orange }}>{healthTexts.info}</Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
            {config.isConnected
              ? (healthTexts.infoTextConnected || `${serviceName} ile senkronize ediliyor. Manuel düzenleme de yapabilirsiniz.`)
              : isNativeAvailable
                ? (healthTexts.infoTextAvailable || `${serviceName} cihazınızda mevcut. Bağlanarak otomatik senkronizasyon yapabilirsiniz.`)
                : (healthTexts.infoText || 'Sağlık verilerinizi manuel olarak girebilirsiniz.')
            }
          </Text>
        </Card.Content>
      </Card>

      {/* Add Data Dialog */}
      <Portal>
        <Dialog visible={addDialogVisible} onDismiss={() => setAddDialogVisible(false)}>
          <Dialog.Title>{DATA_TYPES.find((dt) => dt.key === selectedType)?.label} - {healthTexts.addValue}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label={`${healthTexts.valueLabel} (${DATA_TYPES.find((dt) => dt.key === selectedType)?.unit})`}
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
  syncButton: { padding: 6, borderRadius: 20, backgroundColor: 'rgba(76,175,80,0.1)' },
  dataGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  dataCard: { width: '48%', flexGrow: 1 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap' },
  statItem: { alignItems: 'center', minWidth: 70 },
});
