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

export function KvkkNoticeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const k = t.kvkk;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.primary + '18' }]}>
          <MaterialCommunityIcons name="shield-account" size={32} color={colors.primary} />
        </View>
        <Text variant="headlineSmall" style={styles.headerTitle}>{k.title}</Text>
        <Text style={styles.lastUpdated}>{k.lastUpdated}</Text>
      </View>

      <Section icon="information-outline" title={k.introTitle} description={k.introDesc} />
      <Section icon="account-tie" title={k.controllerTitle} description={k.controllerDesc} />
      <Section icon="database" title={k.dataTypesTitle} description={k.dataTypesDesc} />
      <Section icon="target" title={k.purposesTitle} description={k.purposesDesc} />
      <Section icon="scale-balance" title={k.legalBasisTitle} description={k.legalBasisDesc} />
      <Section icon="swap-horizontal" title={k.transferTitle} description={k.transferDesc} />
      <Section icon="clock-outline" title={k.retentionTitle} description={k.retentionDesc} />
      <Section icon="account-check" title={k.rightsTitle} description={k.rightsDesc} iconColor="#2196F3" />
      <Section icon="email" title={k.contactTitle} description={k.contactDesc} />
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
