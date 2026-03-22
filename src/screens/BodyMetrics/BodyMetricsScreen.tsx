import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Image, Alert, Platform } from 'react-native';
import { Text, Card, useTheme, TextInput, Button, Portal, Dialog, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useUserStore } from '../../store/userStore';
import { getAllMetrics, insertMetric, BodyMetric } from '../../services/database/progressDao';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';
import { generateId, todayString } from '../../utils/helpers';

export function BodyMetricsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const userId = useUserStore((s) => s.userId);

  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<[string | null, string | null]>([null, null]);

  // Form state
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [waist, setWaist] = useState('');
  const [hip, setHip] = useState('');
  const [chest, setChest] = useState('');
  const [bicep, setBicep] = useState('');
  const [thigh, setThigh] = useState('');
  const [photoPath, setPhotoPath] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') return;
      getAllMetrics(userId).then(setMetrics);
    }, [userId])
  );

  const resetForm = () => {
    setWeight(''); setBodyFat(''); setWaist(''); setHip('');
    setChest(''); setBicep(''); setThigh(''); setPhotoPath(null);
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('', t.barcode.cameraPermission);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoPath(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('', t.barcode.cameraPermission);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoPath(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!weight.trim()) {
      Alert.alert('', t.onboarding.fillAllFields);
      return;
    }
    const metric: BodyMetric = {
      id: generateId(),
      userId,
      date: todayString(),
      weight: parseFloat(weight),
      bodyFat: bodyFat ? parseFloat(bodyFat) : null,
      waistCm: waist ? parseFloat(waist) : null,
      hipCm: hip ? parseFloat(hip) : null,
      chestCm: chest ? parseFloat(chest) : null,
      bicepCm: bicep ? parseFloat(bicep) : null,
      thighCm: thigh ? parseFloat(thigh) : null,
      progressPhotoPath: photoPath,
    };
    await insertMetric(metric);
    const updated = await getAllMetrics(userId);
    setMetrics(updated);
    setDialogVisible(false);
    resetForm();
  };

  const photosWithImages = metrics.filter((m) => m.progressPhotoPath);
  const latestMetric = metrics.length > 0 ? metrics[0] : null;
  const previousMetric = metrics.length > 1 ? metrics[1] : null;

  const getDiff = (current: number | null, prev: number | null) => {
    if (current === null || prev === null) return null;
    return parseFloat((current - prev).toFixed(1));
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingTop: insets.top + spacing.md, paddingBottom: 40 }}
    >
      <View style={styles.headerRow}>
        <Text variant="headlineSmall" style={styles.title}>{t.bodyMetrics?.title || 'Vücut Ölçüleri'}</Text>
        <Button mode="contained" onPress={() => setDialogVisible(true)} icon="plus" compact>
          {t.common.add}
        </Button>
      </View>

      {/* Latest metrics summary */}
      {latestMetric && (
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text style={styles.cardTitle}>{t.bodyMetrics?.latest || 'Son Ölçüm'} - {latestMetric.date}</Text>
            <View style={styles.metricsGrid}>
              <MetricItem label={t.common.kg} value={`${latestMetric.weight}`} diff={getDiff(latestMetric.weight, previousMetric?.weight ?? null)} icon="scale-bathroom" color={colors.primary} />
              {latestMetric.bodyFat !== null && (
                <MetricItem label="% Yağ" value={`${latestMetric.bodyFat}`} diff={getDiff(latestMetric.bodyFat, previousMetric?.bodyFat ?? null)} icon="percent" color={colors.orange} />
              )}
              {latestMetric.waistCm !== null && (
                <MetricItem label={t.bodyMetrics?.waist || 'Bel'} value={`${latestMetric.waistCm}`} diff={getDiff(latestMetric.waistCm, previousMetric?.waistCm ?? null)} icon="tape-measure" color={colors.secondary} />
              )}
              {latestMetric.chestCm !== null && (
                <MetricItem label={t.bodyMetrics?.chest || 'Göğüs'} value={`${latestMetric.chestCm}`} diff={getDiff(latestMetric.chestCm, previousMetric?.chestCm ?? null)} icon="human" color={colors.purple} />
              )}
              {latestMetric.bicepCm !== null && (
                <MetricItem label={t.bodyMetrics?.bicep || 'Kol'} value={`${latestMetric.bicepCm}`} diff={getDiff(latestMetric.bicepCm, previousMetric?.bicepCm ?? null)} icon="arm-flex" color={colors.red} />
              )}
              {latestMetric.thighCm !== null && (
                <MetricItem label={t.bodyMetrics?.thigh || 'Bacak'} value={`${latestMetric.thighCm}`} diff={getDiff(latestMetric.thighCm, previousMetric?.thighCm ?? null)} icon="human-handsdown" color={colors.calorieGreen} />
              )}
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Photo comparison */}
      {photosWithImages.length >= 2 && (
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text style={styles.cardTitle}>{t.bodyMetrics?.photoCompare || 'Fotoğraf Karşılaştırma'}</Text>
            <View style={styles.photoCompareRow}>
              <View style={styles.photoColumn}>
                <Text style={styles.photoDate}>{photosWithImages[photosWithImages.length - 1].date}</Text>
                <Image
                  source={{ uri: photosWithImages[photosWithImages.length - 1].progressPhotoPath! }}
                  style={styles.comparePhoto}
                />
              </View>
              <MaterialCommunityIcons name="arrow-right" size={24} color="#999" />
              <View style={styles.photoColumn}>
                <Text style={styles.photoDate}>{photosWithImages[0].date}</Text>
                <Image
                  source={{ uri: photosWithImages[0].progressPhotoPath! }}
                  style={styles.comparePhoto}
                />
              </View>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* History */}
      <Text style={styles.sectionTitle}>{t.bodyMetrics?.history || 'Geçmiş'}</Text>
      {metrics.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="tape-measure" size={48} color="#ccc" />
          <Text style={{ color: '#999', marginTop: 8 }}>{t.bodyMetrics?.noData || 'Henüz ölçüm yok'}</Text>
        </View>
      )}
      {metrics.map((m) => (
        <Card key={m.id} style={styles.historyCard} mode="elevated">
          <Card.Content style={styles.historyRow}>
            <View>
              <Text style={{ fontWeight: 'bold' }}>{m.date}</Text>
              <Text style={{ color: '#999', fontSize: 12 }}>
                {m.weight} kg
                {m.bodyFat !== null ? ` · ${m.bodyFat}%` : ''}
                {m.waistCm !== null ? ` · Bel: ${m.waistCm}cm` : ''}
              </Text>
            </View>
            {m.progressPhotoPath && (
              <Image source={{ uri: m.progressPhotoPath }} style={styles.thumbPhoto} />
            )}
          </Card.Content>
        </Card>
      ))}

      {/* Add measurement dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)} style={{ maxHeight: '85%' }}>
          <Dialog.Title>{t.bodyMetrics?.addMeasurement || 'Ölçüm Ekle'}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={{ padding: spacing.sm }}>
              <TextInput label={`${t.common.kg} *`} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" mode="outlined" style={styles.input} dense />
              <TextInput label="% Yağ" value={bodyFat} onChangeText={setBodyFat} keyboardType="decimal-pad" mode="outlined" style={styles.input} dense />
              <TextInput label={`${t.bodyMetrics?.waist || 'Bel'} (cm)`} value={waist} onChangeText={setWaist} keyboardType="decimal-pad" mode="outlined" style={styles.input} dense />
              <TextInput label={`${t.bodyMetrics?.hip || 'Kalça'} (cm)`} value={hip} onChangeText={setHip} keyboardType="decimal-pad" mode="outlined" style={styles.input} dense />
              <TextInput label={`${t.bodyMetrics?.chest || 'Göğüs'} (cm)`} value={chest} onChangeText={setChest} keyboardType="decimal-pad" mode="outlined" style={styles.input} dense />
              <TextInput label={`${t.bodyMetrics?.bicep || 'Kol'} (cm)`} value={bicep} onChangeText={setBicep} keyboardType="decimal-pad" mode="outlined" style={styles.input} dense />
              <TextInput label={`${t.bodyMetrics?.thigh || 'Bacak'} (cm)`} value={thigh} onChangeText={setThigh} keyboardType="decimal-pad" mode="outlined" style={styles.input} dense />

              <View style={styles.photoButtons}>
                <Button mode="outlined" icon="camera" onPress={takePhoto} compact style={{ flex: 1 }}>
                  {t.bodyMetrics?.takePhoto || 'Fotoğraf Çek'}
                </Button>
                <Button mode="outlined" icon="image" onPress={pickPhoto} compact style={{ flex: 1 }}>
                  {t.bodyMetrics?.pickPhoto || 'Galeriden Seç'}
                </Button>
              </View>

              {photoPath && (
                <Image source={{ uri: photoPath }} style={styles.previewPhoto} />
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => { setDialogVisible(false); resetForm(); }}>{t.common.cancel}</Button>
            <Button onPress={handleSave} disabled={!weight.trim()}>{t.common.save}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

function MetricItem({ label, value, diff, icon, color }: { label: string; value: string; diff: number | null; icon: string; color: string }) {
  const diffColor = diff === null ? '#999' : diff < 0 ? colors.calorieGreen : diff > 0 ? colors.red : '#999';
  const diffSign = diff !== null && diff > 0 ? '+' : '';

  return (
    <View style={styles.metricItem}>
      <MaterialCommunityIcons name={icon as any} size={20} color={color} />
      <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: '#999' }}>{label}</Text>
      {diff !== null && (
        <Text style={{ fontSize: 10, color: diffColor }}>{diffSign}{diff}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontWeight: 'bold' },
  card: { borderRadius: borderRadius.lg, marginBottom: spacing.md },
  cardTitle: { fontWeight: 'bold', fontSize: 15, marginBottom: spacing.sm },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricItem: { alignItems: 'center', width: '30%' as any, paddingVertical: spacing.sm },
  sectionTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: spacing.sm, marginTop: spacing.sm },
  historyCard: { borderRadius: borderRadius.md, marginBottom: 8 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  input: { marginBottom: 8, backgroundColor: '#fff' },
  photoButtons: { flexDirection: 'row', gap: 8, marginVertical: spacing.sm },
  previewPhoto: { width: '100%', height: 200, borderRadius: borderRadius.md, marginTop: spacing.sm },
  photoCompareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photoColumn: { alignItems: 'center', flex: 1 },
  photoDate: { fontSize: 12, color: '#999', marginBottom: 4 },
  comparePhoto: { width: '90%', aspectRatio: 3 / 4, borderRadius: borderRadius.md },
  thumbPhoto: { width: 48, height: 64, borderRadius: 8 },
});
