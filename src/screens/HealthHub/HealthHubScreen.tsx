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

const DATA_TYPES: { key: HealthDataPoint['type']; label: string; icon: string; color: string; unit: string; placeholder: string }[] = [
  { key: 'steps', label: 'Adım', icon: 'walk', color: '#4CAF50', unit: 'adım', placeholder: '10000' },
  { key: 'heartRate', label: 'Kalp Atışı', icon: 'heart-pulse', color: '#F44336', unit: 'bpm', placeholder: '72' },
  { key: 'sleep', label: 'Uyku', icon: 'sleep', color: '#5C6BC0', unit: 'saat', placeholder: '7.5' },
  { key: 'activeCalories', label: 'Aktif Kalori', icon: 'fire', color: '#FF9800', unit: 'kcal', placeholder: '350' },
];

export function HealthHubScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const today = todayString();

  const [config, setConfig] = useState<HealthSyncConfig | null>(null);
  const [todayData, setTodayData] = useState<HealthDataPoint[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getHealthStats>> | null>(null);
  const [addDialogVisible, setAddDialogVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<HealthDataPoint['type']>('steps');
  const [inputValue, setInputValue] = useState('');

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
    try {
      const data = await exportAllData();
      if (Platform.OS === 'web') {
        Alert.alert('Dışa Aktarma', 'Veri panoya kopyalandı');
        return;
      }
      await Share.share({
        message: data,
        title: 'FitTrack Sağlık Verileri',
      });
    } catch (e) {
      Alert.alert('Hata', 'Dışa aktarma başarısız');
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
        <Text variant="headlineSmall" style={styles.title}>Sağlık Merkezi</Text>
        <Button mode="outlined" onPress={handleExport} icon="export" compact>
          Dışa Aktar
        </Button>
      </View>

      {/* Connection Status */}
      <Card style={[styles.card, { backgroundColor: '#E3F2FD' }]} mode="elevated">
        <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="watch" size={32} color="#1976D2" />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ fontWeight: 'bold' }}>Cihaz Bağlantısı</Text>
            <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
              Manuel veri girişi aktif
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' }]}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>Aktif</Text>
          </View>
        </Card.Content>
      </Card>

      {/* Today's Health Data */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Bugünkü Veriler</Text>
      <View style={styles.dataGrid}>
        {DATA_TYPES.map((type) => {
          const value = getDataValue(type.key);
          return (
            <TouchableOpacity
              key={type.key}
              style={styles.dataCard}
              onPress={() => openAddDialog(type.key)}
              activeOpacity={0.7}
            >
              <Card style={{ borderRadius: borderRadius.md }} mode="elevated">
                <Card.Content style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                  <MaterialCommunityIcons name={type.icon as any} size={28} color={type.color} />
                  <Text style={{ fontWeight: 'bold', fontSize: 20, marginTop: 8 }}>
                    {value !== null ? value : '--'}
                  </Text>
                  <Text style={{ color: '#999', fontSize: 11 }}>{type.unit}</Text>
                  <Text style={{ fontWeight: '600', fontSize: 12, marginTop: 4 }}>{type.label}</Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Weekly Averages */}
      {stats && stats.totalEntries > 0 && (
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text style={{ fontWeight: 'bold', marginBottom: 12 }}>Haftalık Ortalamalar</Text>
            <View style={styles.statsGrid}>
              {stats.avgSteps > 0 && (
                <StatItem icon="walk" color="#4CAF50" label="Adım" value={`${stats.avgSteps}`} />
              )}
              {stats.avgHeartRate > 0 && (
                <StatItem icon="heart-pulse" color="#F44336" label="Kalp" value={`${stats.avgHeartRate} bpm`} />
              )}
              {stats.avgSleep > 0 && (
                <StatItem icon="sleep" color="#5C6BC0" label="Uyku" value={`${stats.avgSleep}s`} />
              )}
              {stats.avgActiveCalories > 0 && (
                <StatItem icon="fire" color="#FF9800" label="Kalori" value={`${stats.avgActiveCalories}`} />
              )}
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Info Card */}
      <Card style={[styles.card, { backgroundColor: '#FFF8E1' }]} mode="elevated">
        <Card.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <MaterialCommunityIcons name="information" size={20} color="#F57F17" />
            <Text style={{ fontWeight: 'bold', marginLeft: 8, color: '#F57F17' }}>Bilgi</Text>
          </View>
          <Text style={{ color: '#666', fontSize: 13, lineHeight: 20 }}>
            Sağlık verilerinizi manuel olarak girebilirsiniz. Apple Health ve Google Fit entegrasyonu
            gelecek güncellemelerde eklenecektir. Verilerinizi dışa aktarma butonu ile paylaşabilirsiniz.
          </Text>
        </Card.Content>
      </Card>

      {/* Add Data Dialog */}
      <Portal>
        <Dialog visible={addDialogVisible} onDismiss={() => setAddDialogVisible(false)}>
          <Dialog.Title>{DATA_TYPES.find((t) => t.key === selectedType)?.label} Ekle</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label={`Değer (${DATA_TYPES.find((t) => t.key === selectedType)?.unit})`}
              value={inputValue}
              onChangeText={setInputValue}
              keyboardType="numeric"
              mode="outlined"
              dense
              placeholder={DATA_TYPES.find((t) => t.key === selectedType)?.placeholder}
              style={{ backgroundColor: '#fff' }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddDialogVisible(false)}>İptal</Button>
            <Button onPress={handleAddData} disabled={!inputValue.trim()}>Kaydet</Button>
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
      <Text style={{ color: '#999', fontSize: 10 }}>{label}</Text>
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
