import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePremiumStore } from '../store/premiumStore';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useLanguage } from '../i18n';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  feature?: string;
}

const PREMIUM_FEATURES = [
  { icon: 'robot', key: 'aiCoachUnlimited' },
  { icon: 'camera', key: 'foodRecognitionUnlimited' },
  { icon: 'barcode-scan', key: 'barcodeUnlimited' },
  { icon: 'chart-timeline-variant', key: 'progressFull' },
  { icon: 'download', key: 'dataExport' },
  { icon: 'dumbbell', key: 'advancedPrograms' },
  { icon: 'heart-pulse', key: 'wellnessDetail' },
  { icon: 'watch', key: 'healthHubFull' },
];

export function PaywallModal({ visible, onClose, feature }: PaywallModalProps) {
  const theme = useTheme();
  const { t } = useLanguage();
  const setPremium = usePremiumStore((s) => s.setPremium);

  const premiumTexts = (t as any).premium || {};

  const handleRestore = () => {
    // TODO: RevenueCat restore purchases
    onClose();
  };

  const handlePurchase = async (plan: 'monthly' | 'yearly' | 'lifetime') => {
    // TODO: RevenueCat purchase flow
    // For now, activate premium directly (mock)
    const expiresAt = plan === 'lifetime'
      ? null
      : Date.now() + (plan === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000;
    await setPremium(plan, expiresAt);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Close button */}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <MaterialCommunityIcons name="crown" size={48} color="#FFD700" />
              <Text style={styles.title}>{premiumTexts.title || 'FitTrack Premium'}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {premiumTexts.subtitle || 'Unlock all features'}
              </Text>
            </View>

            {/* Feature triggered */}
            {feature && (
              <View style={[styles.featureBanner, { backgroundColor: colors.warningBg }]}>
                <MaterialCommunityIcons name="lock" size={16} color={colors.orange} />
                <Text style={{ marginLeft: 8, fontSize: 13, color: colors.orange, flex: 1 }}>
                  {premiumTexts.featureLockedMsg || 'This feature requires Premium'}
                </Text>
              </View>
            )}

            {/* Features list */}
            <View style={styles.featureList}>
              {PREMIUM_FEATURES.map((f) => (
                <View key={f.key} style={styles.featureRow}>
                  <MaterialCommunityIcons name={f.icon as any} size={22} color={colors.primary} />
                  <Text style={[styles.featureText, { color: theme.colors.onSurface }]}>
                    {premiumTexts[f.key] || f.key}
                  </Text>
                  <MaterialCommunityIcons name="check-circle" size={18} color={colors.primary} />
                </View>
              ))}
            </View>

            {/* Pricing */}
            <View style={styles.pricingSection}>
              <TouchableOpacity
                style={[styles.planCard, styles.popularPlan]}
                onPress={() => handlePurchase('yearly')}
              >
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>{premiumTexts.popular || 'Popular'}</Text>
                </View>
                <Text style={styles.planName}>{premiumTexts.yearly || 'Yearly'}</Text>
                <Text style={styles.planPrice}>$29.99/{premiumTexts.year || 'year'}</Text>
                <Text style={styles.planSave}>{premiumTexts.savePercent || 'Save 58%'}</Text>
              </TouchableOpacity>

              <View style={styles.planRow}>
                <TouchableOpacity
                  style={[styles.planCard, styles.smallPlan, { backgroundColor: theme.colors.surfaceVariant }]}
                  onPress={() => handlePurchase('monthly')}
                >
                  <Text style={[styles.planName, { fontSize: 14 }]}>{premiumTexts.monthly || 'Monthly'}</Text>
                  <Text style={[styles.planPrice, { fontSize: 16 }]}>$5.99/{premiumTexts.month || 'mo'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.planCard, styles.smallPlan, { backgroundColor: theme.colors.surfaceVariant }]}
                  onPress={() => handlePurchase('lifetime')}
                >
                  <Text style={[styles.planName, { fontSize: 14 }]}>{premiumTexts.lifetime || 'Lifetime'}</Text>
                  <Text style={[styles.planPrice, { fontSize: 16 }]}>$59.99</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Restore */}
            <Button mode="text" onPress={handleRestore} style={{ marginTop: spacing.sm }}>
              {premiumTexts.restore || 'Restore Purchases'}
            </Button>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: spacing.xs,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  featureBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  featureList: {
    marginBottom: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.divider,
  },
  featureText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
  },
  pricingSection: {
    marginBottom: spacing.md,
  },
  planCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  popularPlan: {
    backgroundColor: colors.primary,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 10,
  },
  popularText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 4,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 2,
  },
  planSave: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  planRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  smallPlan: {
    flex: 1,
  },
});
