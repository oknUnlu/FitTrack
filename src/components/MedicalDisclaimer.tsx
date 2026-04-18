import React from 'react';
import { View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useLanguage } from '../i18n';

/**
 * MedicalDisclaimer
 *
 * Legal safeguard shown anywhere the app could be perceived as giving medical
 * advice: AI Coach, calorie targets, fasting, supplement recommendations,
 * BMI/body metrics. Keeps FitTrack outside the scope of EU MDR 2017/745
 * (medical device regulation) by making clear it is a wellness/fitness tool
 * only, not a diagnostic or therapeutic device.
 *
 * Variants:
 *   - "inline"  → small banner embedded inline in a screen.
 *   - "warning" → stronger, red warning (used for extreme calorie/fasting).
 *   - "card"    → full card style (used on first-use of AI/calorie screens).
 */

type Variant = 'inline' | 'warning' | 'card';

interface MedicalDisclaimerProps {
  variant?: Variant;
  message?: string;
  title?: string;
  onDismiss?: () => void;
  style?: any;
}

export function MedicalDisclaimer({
  variant = 'inline',
  message,
  title,
  onDismiss,
  style,
}: MedicalDisclaimerProps) {
  const theme = useTheme();
  const { t } = useLanguage();

  const disclaimerText =
    message ||
    (t as any)?.legal?.medicalDisclaimer?.body ||
    'Bu uygulama tıbbi tavsiye, teşhis veya tedavi amacıyla kullanılamaz. İçerik yalnızca genel bilgilendirme amaçlıdır. Herhangi bir sağlık kararı almadan önce mutlaka bir hekime veya diyetisyene danışın. Acil durumlarda 112\'yi arayın.';

  const disclaimerTitle =
    title ||
    (t as any)?.legal?.medicalDisclaimer?.title ||
    'Tıbbi Uyarı';

  const isWarning = variant === 'warning';
  const isCard = variant === 'card';

  const bg = isWarning ? colors.errorBg : colors.warningBg;
  const fg = isWarning ? colors.red : colors.orange;
  const iconName = isWarning ? 'alert-octagon' : 'alert-circle-outline';

  return (
    <View
      style={[
        styles.container,
        isCard ? styles.card : styles.banner,
        { backgroundColor: bg, borderColor: fg },
        style,
      ]}
      accessibilityRole="alert"
      accessibilityLabel={disclaimerTitle}
    >
      <View style={styles.row}>
        <MaterialCommunityIcons name={iconName as any} size={isCard ? 24 : 18} color={fg} />
        <Text style={[styles.title, { color: fg, fontSize: isCard ? 15 : 13 }]}>
          {disclaimerTitle}
        </Text>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} hitSlop={10} style={{ marginLeft: 'auto' }}>
            <MaterialCommunityIcons name="close" size={18} color={fg} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={[styles.body, { color: theme.colors.onSurface, fontSize: isCard ? 13 : 12 }]}>
        {disclaimerText}
      </Text>
      {isCard && (
        <TouchableOpacity
          onPress={() => Linking.openURL('tel:112').catch(() => {})}
          style={styles.emergencyButton}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="phone" size={14} color="#fff" />
          <Text style={styles.emergencyText}>
            {(t as any)?.legal?.medicalDisclaimer?.emergency || 'Acil durum: 112'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    marginVertical: spacing.sm,
  },
  banner: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  card: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  title: {
    fontWeight: '700',
  },
  body: {
    lineHeight: 18,
  },
  emergencyButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.red,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    gap: 6,
  },
  emergencyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
