import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePremiumStore } from '../store/premiumStore';
import {
  isRevenueCatConfigured,
  getOfferings,
  purchasePackage,
  restorePurchases,
  PRODUCT_IDS,
} from '../services/premium/revenueCat';
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
  { icon: 'chart-timeline-variant', key: 'progressFull' },
  { icon: 'download', key: 'dataExport' },
  { icon: 'dumbbell', key: 'advancedPrograms' },
  { icon: 'heart-pulse', key: 'wellnessDetail' },
  { icon: 'watch', key: 'healthHubFull' },
  { icon: 'advertisements-off', key: 'adFree' },
];

export function PaywallModal({ visible, onClose, feature }: PaywallModalProps) {
  const theme = useTheme();
  const { t, language } = useLanguage();
  const setPremium = usePremiumStore((s) => s.setPremium);

  const rcConfigured = isRevenueCatConfigured();

  const [offerings, setOfferings] = useState<any>(null);
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Load offerings when modal opens
  useEffect(() => {
    if (visible && rcConfigured && !offerings) {
      loadOfferings();
    }
  }, [visible]);

  const loadOfferings = async () => {
    setIsLoadingOfferings(true);
    try {
      const result = await getOfferings();
      setOfferings(result);
    } catch (e) {
      if (__DEV__) console.warn('Failed to load offerings:', e);
    }
    setIsLoadingOfferings(false);
  };

  const getPackageByPlan = (plan: 'monthly' | 'yearly') => {
    if (!offerings?.availablePackages) return null;
    const productId = PRODUCT_IDS[plan];
    return offerings.availablePackages.find(
      (pkg: any) => pkg.product?.identifier === productId
    ) || null;
  };

  const getPackagePrice = (plan: 'monthly' | 'yearly'): string | null => {
    const pkg = getPackageByPlan(plan);
    return pkg?.product?.priceString || null;
  };

  const handleRestore = async () => {
    if (!rcConfigured) {
      // Mock mode: just close
      onClose();
      return;
    }

    setIsRestoring(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        Alert.alert(
          t.premium.restore,
          t.premium.restoreSuccess,
          [{ text: 'OK', onPress: onClose }]
        );
      } else {
        Alert.alert(
          t.premium.restore,
          t.premium.restoreNotFound
        );
      }
    } catch (e) {
      Alert.alert(
        t.common.error,
        t.premium.restoreFailed
      );
    }
    setIsRestoring(false);
  };

  const handlePurchase = async (plan: 'monthly' | 'yearly') => {
    if (!rcConfigured) {
      // Mock mode: activate directly for development
      const expiresAt = Date.now() + (plan === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000;
      await setPremium(plan, expiresAt);
      onClose();
      return;
    }

    const pkg = getPackageByPlan(plan);
    if (!pkg) {
      Alert.alert(t.common.error, t.common.errorOccurred);
      return;
    }

    setIsPurchasing(true);
    try {
      const success = await purchasePackage(pkg);
      if (success) {
        onClose();
      }
    } catch (e: any) {
      Alert.alert(
        t.common.error,
        t.premium.purchaseFailed
      );
    }
    setIsPurchasing(false);
  };

  // Default prices (shown when RevenueCat isn't configured or offerings haven't loaded)
  const isTR = language === 'tr';
  const monthlyPrice = getPackagePrice('monthly') || (isTR ? '₺59,99' : '$4.99');
  const yearlyPrice = getPackagePrice('yearly') || (isTR ? '₺299,99' : '$24.99');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Close button */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              disabled={isPurchasing}
              accessibilityLabel="Close premium modal"
              accessibilityRole="button"
              accessibilityHint="Dismisses the premium upgrade modal"
            >
              <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <MaterialCommunityIcons name="crown" size={48} color="#FFD700" />
              <Text style={styles.title}>{t.premium.title}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t.premium.subtitle}
              </Text>
            </View>

            {/* Feature triggered */}
            {feature && (
              <View style={[styles.featureBanner, { backgroundColor: colors.warningBg }]}>
                <MaterialCommunityIcons name="lock" size={16} color={colors.orange} />
                <Text style={{ marginLeft: 8, fontSize: 13, color: colors.orange, flex: 1 }}>
                  {t.premium.featureLockedMsg}
                </Text>
              </View>
            )}

            {/* Features list */}
            <View style={styles.featureList}>
              {PREMIUM_FEATURES.map((f) => (
                <View key={f.key} style={styles.featureRow}>
                  <MaterialCommunityIcons name={f.icon as any} size={22} color={colors.primary} />
                  <Text style={[styles.featureText, { color: theme.colors.onSurface }]}>
                    {(t.premium as any)[f.key] || f.key}
                  </Text>
                  <MaterialCommunityIcons name="check-circle" size={18} color={colors.primary} />
                </View>
              ))}
            </View>

            {/* Loading indicator for offerings */}
            {isLoadingOfferings && (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: spacing.md }} />
            )}

            {/* Pricing */}
            <View style={styles.pricingSection}>
              <TouchableOpacity
                style={[styles.planCard, styles.popularPlan]}
                onPress={() => handlePurchase('yearly')}
                disabled={isPurchasing}
                accessibilityLabel={`Yearly plan, ${yearlyPrice} per year`}
                accessibilityRole="button"
                accessibilityHint="Purchase the yearly premium plan"
              >
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>{t.premium.popular}</Text>
                </View>
                <Text style={styles.planName}>{t.premium.yearly}</Text>
                <Text style={styles.planPrice}>{yearlyPrice}/{t.premium.year}</Text>
                <Text style={styles.planSave}>{t.premium.savePercent}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.planCard, { backgroundColor: theme.colors.surfaceVariant }]}
                onPress={() => handlePurchase('monthly')}
                disabled={isPurchasing}
              >
                <Text style={[styles.planName, { color: theme.colors.onSurface }]}>{t.premium.monthly}</Text>
                <Text style={[styles.planPrice, { color: theme.colors.onSurface }]}>{monthlyPrice}/{t.premium.month}</Text>
              </TouchableOpacity>
            </View>

            {/* Purchase loading */}
            {isPurchasing && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ marginLeft: 8, color: colors.textSecondary, fontSize: 13 }}>
                  {t.premium.processing}
                </Text>
              </View>
            )}

            {/* Restore */}
            <Button
              mode="text"
              onPress={handleRestore}
              loading={isRestoring}
              disabled={isPurchasing || isRestoring}
              style={{ marginTop: spacing.sm }}
            >
              {t.premium.restore}
            </Button>

            {/* Dev mode indicator */}
            {__DEV__ && !rcConfigured && (
              <Text style={styles.devNote}>
                DEV: RevenueCat not configured — mock purchases active
              </Text>
            )}
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  devNote: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
});
