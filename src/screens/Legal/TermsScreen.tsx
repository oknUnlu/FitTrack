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
  description: string;
  iconColor?: string;
};

function Section({ icon, title, description, iconColor = colors.primary }: SectionProps) {
  const theme = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.iconWrap, { backgroundColor: iconColor + '18' }]}>
          <MaterialCommunityIcons name={icon as any} size={18} color={iconColor} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.paragraph}>{description}</Text>
    </View>
  );
}

export function TermsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const tx = t.terms;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.primary + '18' }]}>
          <MaterialCommunityIcons name="file-document-outline" size={32} color={colors.primary} />
        </View>
        <Text variant="headlineSmall" style={styles.headerTitle}>{tx.title}</Text>
        <Text style={styles.lastUpdated}>{tx.lastUpdated}</Text>
      </View>

      <Section icon="information-outline" title={tx.introTitle} description={tx.introDesc} />
      <Section icon="account-group" title={tx.partiesTitle} description={tx.partiesDesc} />
      <Section icon="cellphone-cog" title={tx.serviceTitle} description={tx.serviceDesc} />
      <Section icon="account-check" title={tx.userObligationsTitle} description={tx.userObligationsDesc} />
      <Section icon="crown" title={tx.premiumTitle} description={tx.premiumDesc} iconColor="#FFB800" />
      <Section icon="cash-refund" title={tx.cancellationTitle} description={tx.cancellationDesc} />
      <Section icon="copyright" title={tx.ipTitle} description={tx.ipDesc} />
      <Section icon="shield-alert" title={tx.liabilityTitle} description={tx.liabilityDesc} iconColor="#FF6B00" />
      <Section icon="medical-bag" title={tx.healthDisclaimerTitle} description={tx.healthDisclaimerDesc} iconColor="#E53935" />
      <Section icon="update" title={tx.changesTitle} description={tx.changesDesc} />
      <Section icon="gavel" title={tx.governingLawTitle} description={tx.governingLawDesc} />
      <Section icon="email" title={tx.contactTitle} description={tx.contactDesc} />
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
  paragraph: { fontSize: 13, lineHeight: 20, color: colors.textSecondary },
});
