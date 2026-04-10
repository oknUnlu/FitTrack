import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Exercise } from '../services/database/workoutDao';
import { colors, spacing, borderRadius, getSemanticColors } from '../theme/theme';

// Kas grubu görsel yapılandırması
const MUSCLE_GROUP_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  chest: { icon: 'arm-flex', color: '#E53935', label: 'Göğüs' },
  back: { icon: 'human-handsup', color: '#1E88E5', label: 'Sırt' },
  shoulders: { icon: 'shield-account', color: '#FB8C00', label: 'Omuz' },
  legs: { icon: 'run', color: '#43A047', label: 'Bacak' },
  biceps: { icon: 'arm-flex', color: '#8E24AA', label: 'Biceps' },
  triceps: { icon: 'arm-flex-outline', color: '#5E35B1', label: 'Triceps' },
  core: { icon: 'shield-outline', color: '#00ACC1', label: 'Karın' },
  obliques: { icon: 'shield-half-full', color: '#00ACC1', label: 'Yan Karın' },
  glutes: { icon: 'seat', color: '#F4511E', label: 'Kalça' },
  hamstrings: { icon: 'human-male-height', color: '#2E7D32', label: 'Arka Bacak' },
  quadriceps: { icon: 'human-male-height-variant', color: '#388E3C', label: 'Ön Bacak' },
  calves: { icon: 'shoe-sneaker', color: '#558B2F', label: 'Baldır' },
  traps: { icon: 'human', color: '#1565C0', label: 'Trapez' },
  forearms: { icon: 'hand-back-right', color: '#6A1B9A', label: 'Ön Kol' },
  cardio: { icon: 'heart-pulse', color: '#EF5350', label: 'Kardiyo' },
  hip_flexors: { icon: 'human', color: '#4CAF50', label: 'Kalça Fleksör' },
};

const EQUIPMENT_CONFIG: Record<string, { icon: string; label: string }> = {
  barbell: { icon: 'dumbbell', label: 'Halter' },
  dumbbell: { icon: 'dumbbell', label: 'Dambıl' },
  cable: { icon: 'pipe', label: 'Kablo Makinesi' },
  machine: { icon: 'cog-outline', label: 'Makine' },
  bodyweight: { icon: 'human-handsup', label: 'Vücut Ağırlığı' },
  cardio: { icon: 'heart-pulse', label: 'Kardiyo Ekipmanı' },
};

interface ExerciseGuideProps {
  exercise: Exercise;
  isExpanded: boolean;
  onToggle: () => void;
  compact?: boolean;
}

export function ExerciseGuide({ exercise, isExpanded, onToggle, compact }: ExerciseGuideProps) {
  const theme = useTheme();
  const isDark = theme.dark;
  const sc = getSemanticColors(isDark);

  const primaryMuscle = exercise.muscleGroups?.[0] || 'chest';
  const muscleConfig = MUSCLE_GROUP_CONFIG[primaryMuscle] || MUSCLE_GROUP_CONFIG.chest;
  const equipConfig = EQUIPMENT_CONFIG[exercise.equipmentType] || EQUIPMENT_CONFIG.bodyweight;

  // Talimatları adımlara böl
  const steps = (exercise.instructions || '')
    .split('.')
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  if (compact) {
    return (
      <TouchableOpacity onPress={onToggle} style={styles.compactRow} activeOpacity={0.6}>
        <View style={[styles.compactIcon, { backgroundColor: muscleConfig.color + '18' }]}>
          <MaterialCommunityIcons name={muscleConfig.icon as any} size={20} color={muscleConfig.color} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.compactName, { color: sc.textPrimary }]} numberOfLines={1}>
            {exercise.nameTr || exercise.name}
          </Text>
          <View style={styles.compactMeta}>
            {exercise.muscleGroups?.slice(0, 2).map((mg) => {
              const cfg = MUSCLE_GROUP_CONFIG[mg];
              return cfg ? (
                <Text key={mg} style={[styles.compactMetaText, { color: cfg.color }]}>{cfg.label}</Text>
              ) : null;
            })}
            <Text style={[styles.compactMetaText, { color: sc.textTertiary }]}> · {equipConfig.label}</Text>
          </View>
        </View>
        <MaterialCommunityIcons
          name={isExpanded ? 'chevron-up' : 'information-outline'}
          size={18}
          color={sc.textTertiary}
        />
      </TouchableOpacity>
    );
  }

  return (
    <View>
      {/* Toggle Butonu */}
      <TouchableOpacity onPress={onToggle} style={styles.toggleBtn} activeOpacity={0.7}>
        <MaterialCommunityIcons name="information-outline" size={15} color={colors.primary} />
        <Text style={styles.toggleText}>
          {isExpanded ? 'Kılavuzu Gizle' : 'Nasıl Yapılır?'}
        </Text>
        <MaterialCommunityIcons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={15}
          color={colors.primary}
        />
      </TouchableOpacity>

      {/* Genişletilmiş Kılavuz */}
      {isExpanded && (
        <View style={[styles.guideContainer, { backgroundColor: isDark ? sc.surfaceVariant : muscleConfig.color + '08' }]}>
          {/* Görsel Başlık */}
          <View style={[styles.visualHeader, { backgroundColor: muscleConfig.color + '12', borderColor: muscleConfig.color + '20' }]}>
            <View style={[styles.muscleIconLarge, { backgroundColor: muscleConfig.color + '20' }]}>
              <MaterialCommunityIcons name={muscleConfig.icon as any} size={36} color={muscleConfig.color} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.guideName, { color: sc.textPrimary }]}>
                {exercise.nameTr || exercise.name}
              </Text>
              {/* Kas grupları */}
              <View style={styles.muscleRow}>
                {exercise.muscleGroups?.map((mg) => {
                  const config = MUSCLE_GROUP_CONFIG[mg];
                  return config ? (
                    <View key={mg} style={[styles.muscleBadge, { backgroundColor: config.color + '18' }]}>
                      <MaterialCommunityIcons name={config.icon as any} size={10} color={config.color} />
                      <Text style={[styles.muscleBadgeText, { color: config.color }]}>{config.label}</Text>
                    </View>
                  ) : null;
                })}
              </View>
              {/* Ekipman */}
              <View style={styles.equipRow}>
                <MaterialCommunityIcons name={equipConfig.icon as any} size={13} color={sc.textTertiary} />
                <Text style={[styles.equipText, { color: sc.textTertiary }]}>{equipConfig.label}</Text>
              </View>
            </View>
          </View>

          {/* Adım adım talimatlar */}
          <View style={styles.stepsContainer}>
            <Text style={[styles.stepsTitle, { color: sc.textSecondary }]}>Adım Adım</Text>
            {steps.map((step, idx) => (
              <View key={idx} style={styles.stepRow}>
                <View style={[styles.stepNum, { backgroundColor: muscleConfig.color }]}>
                  <Text style={styles.stepNumText}>{idx + 1}</Text>
                </View>
                <Text style={[styles.stepText, { color: sc.textPrimary }]}>{step}.</Text>
              </View>
            ))}
          </View>

          {/* MET Bilgisi */}
          <View style={[styles.metRow, { borderTopColor: isDark ? sc.border : muscleConfig.color + '15' }]}>
            <MaterialCommunityIcons name="fire" size={14} color={colors.orange} />
            <Text style={[styles.metText, { color: sc.textTertiary }]}>
              Yoğunluk: {exercise.metValue} MET · ~{Math.round(exercise.metValue * 3.5)} kcal/30dk
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

/** Küçük egzersiz önizleme satırı (modal için) */
export function ExercisePreviewRow({ exercise }: { exercise: Exercise }) {
  const theme = useTheme();
  const isDark = theme.dark;
  const sc = getSemanticColors(isDark);
  const primaryMuscle = exercise.muscleGroups?.[0] || 'chest';
  const muscleConfig = MUSCLE_GROUP_CONFIG[primaryMuscle] || MUSCLE_GROUP_CONFIG.chest;
  const equipConfig = EQUIPMENT_CONFIG[exercise.equipmentType] || EQUIPMENT_CONFIG.bodyweight;

  return (
    <View style={[styles.previewRow, { borderBottomColor: sc.divider }]}>
      <View style={[styles.previewIcon, { backgroundColor: muscleConfig.color + '15' }]}>
        <MaterialCommunityIcons name={muscleConfig.icon as any} size={18} color={muscleConfig.color} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[styles.previewName, { color: sc.textPrimary }]} numberOfLines={1}>
          {exercise.nameTr || exercise.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          {exercise.muscleGroups?.slice(0, 2).map((mg) => {
            const cfg = MUSCLE_GROUP_CONFIG[mg];
            return cfg ? (
              <View key={mg} style={[styles.previewBadge, { backgroundColor: cfg.color + '12' }]}>
                <Text style={{ fontSize: 9, color: cfg.color, fontWeight: '600' }}>{cfg.label}</Text>
              </View>
            ) : null;
          })}
          <View style={[styles.previewBadge, { backgroundColor: sc.surfaceVariant }]}>
            <MaterialCommunityIcons name={equipConfig.icon as any} size={9} color={sc.textTertiary} />
            <Text style={{ fontSize: 9, color: sc.textTertiary, marginLeft: 2 }}>{equipConfig.label}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Toggle Button
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginTop: 4,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },

  // Guide Container
  guideContainer: {
    borderRadius: borderRadius.md,
    marginTop: 8,
    overflow: 'hidden',
  },
  visualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 0,
    borderBottomWidth: 1,
  },
  muscleIconLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  muscleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  muscleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  muscleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  equipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  equipText: {
    fontSize: 11,
  },

  // Steps
  stepsContainer: {
    padding: 14,
  },
  stepsTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  stepNumText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  stepText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    lineHeight: 19,
  },

  // MET Row
  metRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 6,
  },
  metText: {
    fontSize: 11,
  },

  // Compact Row
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  compactIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactName: {
    fontSize: 14,
    fontWeight: '600',
  },
  compactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  compactMetaText: {
    fontSize: 11,
  },

  // Preview Row (for modal)
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  previewIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewName: {
    fontSize: 13,
    fontWeight: '600',
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
});
