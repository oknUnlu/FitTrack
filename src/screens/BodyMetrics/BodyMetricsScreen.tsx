import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Image, Alert, Platform, Keyboard } from 'react-native';
import { Text, Card, useTheme, TextInput, Button, Portal, Dialog } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useUserStore } from '../../store/userStore';
import { getAllMetrics, insertMetric, BodyMetric } from '../../services/database/progressDao';
import { updateUserWeight } from '../../services/database/userDao';
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
      getAllMetrics(userId).then(setMetrics).catch((e) => {
        if (__DEV__) console.warn('BodyMetrics load failed:', e);
      });
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
    const w = parseFloat(weight);
    if (!weight.trim() || isNaN(w) || w <= 0) {
      Alert.alert('', t.onboarding.fillAllFields);
      return;
    }
    const metric: BodyMetric = {
      id: generateId(),
      userId,
      date: todayString(),
      weight: w,
      bodyFat: bodyFat ? parseFloat(bodyFat) : null,
      waistCm: waist ? parseFloat(waist) : null,
      hipCm: hip ? parseFloat(hip) : null,
      chestCm: chest ? parseFloat(chest) : null,
      bicepCm: bicep ? parseFloat(bicep) : null,
      thighCm: thigh ? parseFloat(thigh) : null,
      progressPhotoPath: photoPath,
    };
    Keyboard.dismiss();
    await insertMetric(metric);
    // Keep the user's current weight (shown on the Profile screen) in sync with
    // the latest body-metrics entry.
    await updateUserWeight(userId, w);
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
      contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
    >
      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setDialogVisible(true)}
        activeOpacity={0.8}
      >
        <View style={styles.addButtonIcon}>
          <MaterialCommunityIcons name="plus" size={20} color="#fff" />
        </View>
        <Text style={styles.addButtonText}>{t.bodyMetrics.addMeasurement}</Text>
      </TouchableOpacity>

      {/* Latest metrics summary */}
      {latestMetric && (
        <Card style={styles.summaryCard} mode="elevated">
          <View style={styles.summaryAccent} />
          <Card.Content style={styles.summaryContent}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryTitleRow}>
                <MaterialCommunityIcons name="chart-line" size={18} color={colors.primary} />
                <Text style={styles.summaryTitle}>{t.bodyMetrics.latest}</Text>
              </View>
              <View style={styles.dateBadge}>
                <Text style={styles.dateBadgeText}>{latestMetric.date}</Text>
              </View>
            </View>
            <View style={styles.metricsGrid}>
              <MetricItem label={t.common.kg} value={`${latestMetric.weight}`} diff={getDiff(latestMetric.weight, previousMetric?.weight ?? null)} icon="scale-bathroom" color={colors.primary} />
              {latestMetric.bodyFat !== null && (
                <MetricItem label="% Yağ" value={`${latestMetric.bodyFat}`} diff={getDiff(latestMetric.bodyFat, previousMetric?.bodyFat ?? null)} icon="percent" color={colors.orange} />
              )}
              {latestMetric.waistCm !== null && (
                <MetricItem label={t.bodyMetrics.waist} value={`${latestMetric.waistCm}`} diff={getDiff(latestMetric.waistCm, previousMetric?.waistCm ?? null)} icon="tape-measure" color={colors.secondary} />
              )}
              {latestMetric.chestCm !== null && (
                <MetricItem label={t.bodyMetrics.chest} value={`${latestMetric.chestCm}`} diff={getDiff(latestMetric.chestCm, previousMetric?.chestCm ?? null)} icon="human" color={colors.purple} />
              )}
              {latestMetric.bicepCm !== null && (
                <MetricItem label={t.bodyMetrics.bicep} value={`${latestMetric.bicepCm}`} diff={getDiff(latestMetric.bicepCm, previousMetric?.bicepCm ?? null)} icon="arm-flex" color={colors.red} />
              )}
              {latestMetric.thighCm !== null && (
                <MetricItem label={t.bodyMetrics.thigh} value={`${latestMetric.thighCm}`} diff={getDiff(latestMetric.thighCm, previousMetric?.thighCm ?? null)} icon="human-handsdown" color={colors.calorieGreen} />
              )}
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Photo comparison */}
      {photosWithImages.length >= 2 && (
        <Card style={styles.photoCard} mode="elevated">
          <Card.Content>
            <View style={styles.photoCardHeader}>
              <MaterialCommunityIcons name="image-multiple" size={18} color={colors.secondary} />
              <Text style={styles.photoCardTitle}>{t.bodyMetrics.photoCompare}</Text>
            </View>
            <View style={styles.photoCompareRow}>
              <View style={styles.photoColumn}>
                <View style={styles.photoDateChip}>
                  <Text style={styles.photoDateText}>{photosWithImages[photosWithImages.length - 1].date}</Text>
                </View>
                <Image
                  source={{ uri: photosWithImages[photosWithImages.length - 1].progressPhotoPath! }}
                  style={styles.comparePhoto}
                />
              </View>
              <View style={styles.arrowWrap}>
                <MaterialCommunityIcons name="arrow-right" size={20} color={colors.primary} />
              </View>
              <View style={styles.photoColumn}>
                <View style={[styles.photoDateChip, { backgroundColor: colors.successBg }]}>
                  <Text style={[styles.photoDateText, { color: colors.primary }]}>{photosWithImages[0].date}</Text>
                </View>
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
      <View style={styles.historyHeader}>
        <MaterialCommunityIcons name="history" size={18} color={colors.textSecondary} />
        <Text style={styles.historyTitle}>{t.bodyMetrics.history}</Text>
      </View>

      {metrics.length === 0 && (
        <Card style={styles.emptyCard} mode="elevated">
          <Card.Content style={styles.emptyContent}>
            <View style={styles.emptyIconWrap}>
              <MaterialCommunityIcons name="tape-measure" size={36} color={colors.textDisabled} />
            </View>
            <Text style={styles.emptyText}>{t.bodyMetrics.noData}</Text>
          </Card.Content>
        </Card>
      )}

      {metrics.map((m, index) => (
        <Card key={m.id} style={styles.historyCard} mode="elevated">
          <Card.Content style={styles.historyRow}>
            <View style={[styles.historyDot, { backgroundColor: index === 0 ? colors.primary : colors.border }]} />
            <View style={styles.historyInfo}>
              <Text style={styles.historyDate}>{m.date}</Text>
              <View style={styles.historyMetrics}>
                <View style={styles.historyMetricChip}>
                  <MaterialCommunityIcons name="scale-bathroom" size={12} color={colors.primary} />
                  <Text style={styles.historyMetricText}>{m.weight} kg</Text>
                </View>
                {m.bodyFat !== null && (
                  <View style={styles.historyMetricChip}>
                    <MaterialCommunityIcons name="percent" size={12} color={colors.orange} />
                    <Text style={styles.historyMetricText}>{m.bodyFat}%</Text>
                  </View>
                )}
                {m.waistCm !== null && (
                  <View style={styles.historyMetricChip}>
                    <MaterialCommunityIcons name="tape-measure" size={12} color={colors.secondary} />
                    <Text style={styles.historyMetricText}>{m.waistCm} cm</Text>
                  </View>
                )}
              </View>
            </View>
            {m.progressPhotoPath && (
              <Image source={{ uri: m.progressPhotoPath }} style={styles.thumbPhoto} />
            )}
          </Card.Content>
        </Card>
      ))}

      {/* Add measurement dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title>{t.bodyMetrics.addMeasurement}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={{ padding: spacing.sm }}>
              <TextInput label={`${t.common.kg} *`} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" mode="outlined" style={styles.input} dense placeholder="75.0" />
              <TextInput label="% Yağ" value={bodyFat} onChangeText={setBodyFat} keyboardType="decimal-pad" mode="outlined" style={styles.input} dense placeholder="18.0" />
              <TextInput label={`${t.bodyMetrics.waist} (cm)`} value={waist} onChangeText={setWaist} keyboardType="decimal-pad" mode="outlined" style={styles.input} dense placeholder="80" />
              <TextInput label={`${t.bodyMetrics.hip} (cm)`} value={hip} onChangeText={setHip} keyboardType="decimal-pad" mode="outlined" style={styles.input} dense placeholder="95" />
              <TextInput label={`${t.bodyMetrics.chest} (cm)`} value={chest} onChangeText={setChest} keyboardType="decimal-pad" mode="outlined" style={styles.input} dense placeholder="100" />
              <TextInput label={`${t.bodyMetrics.bicep} (cm)`} value={bicep} onChangeText={setBicep} keyboardType="decimal-pad" mode="outlined" style={styles.input} dense placeholder="35" />
              <TextInput label={`${t.bodyMetrics.thigh} (cm)`} value={thigh} onChangeText={setThigh} keyboardType="decimal-pad" mode="outlined" style={styles.input} dense placeholder="55" />

              <View style={styles.photoButtons}>
                <TouchableOpacity style={styles.photoBtnAction} onPress={takePhoto} activeOpacity={0.7}>
                  <MaterialCommunityIcons name="camera" size={20} color={colors.primary} />
                  <Text style={styles.photoBtnText}>{t.bodyMetrics.takePhoto}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoBtnAction} onPress={pickPhoto} activeOpacity={0.7}>
                  <MaterialCommunityIcons name="image" size={20} color={colors.primary} />
                  <Text style={styles.photoBtnText}>{t.bodyMetrics.pickPhoto}</Text>
                </TouchableOpacity>
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

const MetricItem = React.memo(function MetricItem({ label, value, diff, icon, color }: { label: string; value: string; diff: number | null; icon: string; color: string }) {
  const diffColor = diff === null ? colors.textTertiary : diff < 0 ? colors.calorieGreen : diff > 0 ? colors.red : colors.textTertiary;
  const diffSign = diff !== null && diff > 0 ? '+' : '';

  return (
    <View style={[styles.metricItem, { backgroundColor: `${color}08` }]}>
      <View style={[styles.metricIconWrap, { backgroundColor: `${color}15` }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {diff !== null && (
        <View style={[styles.diffBadge, { backgroundColor: diffColor === colors.calorieGreen ? colors.successBg : diffColor === colors.red ? colors.errorBg : colors.surfaceVariant }]}>
          <Text style={[styles.diffText, { color: diffColor }]}>{diffSign}{diff}</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Add Button
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: 10,
  },
  addButtonIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },

  // Summary Card
  summaryCard: {
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  summaryAccent: {
    height: 3,
    backgroundColor: colors.primary,
  },
  summaryContent: {
    paddingTop: spacing.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryTitle: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  dateBadge: {
    backgroundColor: colors.infoBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dateBadgeText: {
    fontSize: 11,
    color: colors.secondary,
    fontWeight: '600',
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricItem: {
    alignItems: 'center',
    flexGrow: 1,
    flexBasis: '28%' as any,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricValue: {
    fontWeight: 'bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  metricLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 1,
  },
  diffBadge: {
    marginTop: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  diffText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Photo Compare Card
  photoCard: {
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  photoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  photoCardTitle: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  photoCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoColumn: {
    alignItems: 'center',
    flex: 1,
  },
  photoDateChip: {
    backgroundColor: colors.warningBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 6,
  },
  photoDateText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.orange,
  },
  comparePhoto: {
    width: '88%',
    aspectRatio: 3 / 4,
    borderRadius: borderRadius.md,
  },
  arrowWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.successBg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // History Section
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  historyTitle: {
    fontWeight: 'bold',
    fontSize: 15,
    color: colors.textSecondary,
  },
  historyCard: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyInfo: {
    flex: 1,
  },
  historyDate: {
    fontWeight: '600',
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: 3,
  },
  historyMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  historyMetricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  historyMetricText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  thumbPhoto: {
    width: 44,
    height: 58,
    borderRadius: 8,
  },

  // Empty State
  emptyCard: {
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 13,
  },

  // Dialog
  dialog: {
    maxHeight: '85%',
  },
  input: {
    marginBottom: 8,
    backgroundColor: colors.surface,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: spacing.sm,
  },
  photoBtnAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
  },
  photoBtnText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  previewPhoto: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
});
