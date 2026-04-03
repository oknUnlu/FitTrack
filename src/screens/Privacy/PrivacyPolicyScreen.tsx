import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';

type SectionProps = {
  icon: string;
  title: string;
  children: React.ReactNode;
  iconColor?: string;
};

function Section({ icon, title, children, iconColor = colors.primary }: SectionProps) {
  const theme = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.iconWrap, { backgroundColor: iconColor + '18' }]}>
          <MaterialCommunityIcons name={icon as any} size={18} color={iconColor} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Paragraph({ text }: { text: string }) {
  return <Text style={styles.paragraph}>{text}</Text>;
}

function DataItem({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <View style={styles.dataItem}>
      <View style={styles.dataItemHeader}>
        <MaterialCommunityIcons name={icon as any} size={16} color={colors.primary} />
        <Text style={styles.dataItemTitle}>{title}</Text>
      </View>
      <Text style={styles.dataItemDesc}>{description}</Text>
    </View>
  );
}

export function PrivacyPolicyScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const p = t.privacy;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.primary + '18' }]}>
          <MaterialCommunityIcons name="shield-lock" size={32} color={colors.primary} />
        </View>
        <Text variant="headlineSmall" style={styles.headerTitle}>{p.title}</Text>
        <Text style={styles.lastUpdated}>{p.lastUpdated}</Text>
      </View>

      {/* Data Collection */}
      <Section icon="database" title={p.dataCollection}>
        <Paragraph text={p.dataCollectionDesc} />
        <DataItem icon="account" title={p.personalData} description={p.personalDataDesc} />
        <DataItem icon="heart-pulse" title={p.healthData} description={p.healthDataDesc} />
        <DataItem icon="food-apple" title={p.nutritionData} description={p.nutritionDataDesc} />
        <DataItem icon="dumbbell" title={p.fitnessData} description={p.fitnessDataDesc} />
        <DataItem icon="camera" title={p.photoData} description={p.photoDataDesc} />
      </Section>

      {/* AI Data Usage - Warning Section */}
      <Section icon="robot" title={p.aiDataTitle} iconColor="#FF6B00">
        <Paragraph text={p.aiDataDesc} />
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>{p.aiTrainingWarning}</Text>
        </View>
      </Section>

      {/* Third Party Services */}
      <Section icon="link-variant" title={p.thirdPartyTitle}>
        <DataItem icon="google" title="Google Gemini AI" description={p.geminiDesc} />
        <DataItem icon="barcode-scan" title="Open Food Facts" description={p.openFoodFactsDesc} />
        <DataItem icon="heart" title="HealthKit / Health Connect" description={p.healthKitDesc} />
      </Section>

      {/* Local Storage */}
      <Section icon="cellphone" title={p.localStorage}>
        <Paragraph text={p.localStorageDesc} />
      </Section>

      {/* Data Security */}
      <Section icon="lock" title={p.dataSecurity}>
        <Paragraph text={p.dataSecurityDesc} />
      </Section>

      {/* User Rights */}
      <Section icon="scale-balance" title={p.userRights} iconColor="#2196F3">
        <Paragraph text={p.userRightsDesc} />
      </Section>

      {/* Data Retention */}
      <Section icon="clock-outline" title={p.dataRetention}>
        <Paragraph text={p.dataRetentionDesc} />
      </Section>

      {/* Contact */}
      <Section icon="email" title={p.contact}>
        <Paragraph text={p.contactDesc} />
      </Section>

      {/* Consent */}
      <View style={[styles.consentBox, { backgroundColor: theme.colors.surface }]}>
        <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary} />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={styles.consentTitle}>{p.consentTitle}</Text>
          <Text style={styles.consentDesc}>{p.consentDesc}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerTitle: { fontWeight: 'bold', textAlign: 'center' },
  lastUpdated: { color: colors.textTertiary, fontSize: 12, marginTop: 4 },

  section: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  sectionTitle: { fontWeight: 'bold', fontSize: 15, flex: 1 },

  paragraph: { fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: spacing.sm },

  dataItem: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  dataItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  dataItemTitle: { fontWeight: '600', fontSize: 13 },
  dataItemDesc: { fontSize: 12, lineHeight: 18, color: colors.textSecondary },

  warningBox: {
    backgroundColor: 'rgba(255,107,0,0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B00',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  warningText: { fontSize: 12, lineHeight: 18, color: '#CC5500' },

  consentBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  consentTitle: { fontWeight: 'bold', fontSize: 14, marginBottom: 4 },
  consentDesc: { fontSize: 12, lineHeight: 18, color: colors.textSecondary },
});
