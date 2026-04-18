import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePremiumStore } from '../store/premiumStore';
import {
  isBillingConfigured,
  getSubscriptions,
  purchaseSubscription,
  restorePurchases,
  PRODUCT_IDS,
} from '../services/premium/googleBilling';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useLanguage } from '../i18n';
import { getLocalizedPrices } from '../utils/locale';

// Pre-contractual information URLs (TKHK 6502 / Distance Contracts Regulation)
const TERMS_URL = 'https://fittrack-a958c.web.app/terms';
const PRIVACY_URL = 'https://fittrack-a958c.web.app/privacy';
// Google Play: manage/cancel subscriptions — required by Play Policy and TKHK 6502.
const MANAGE_SUB_URL_ANDROID = 'https://play.google.com/store/account/subscriptions';
const MANAGE_SUB_URL_IOS = 'https://apps.apple.com/account/subscriptions';

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
  const { t } = useLanguage();
  const setPremium = usePremiumStore((s) => s.setPremium);
  const insets = useSafeAreaInsets();

  const billingReady = isBillingConfigured();

  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [isLoadingSubs, setIsLoadingSubs] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  // Consumer-right acknowledgement: user must accept that by starting the
  // subscription the 14-day withdrawal right is consumed once the digital
  // service begins (TKHK m.15/1-ğ / MSY m.15 exception).
  const [consumerRightAck, setConsumerRightAck] = useState(false);

  // Load subscriptions when modal opens
  useEffect(() => {
    if (visible && billingReady && subscriptions.length === 0) {
      loadSubscriptions();
    }
  }, [visible]);

  const loadSubscriptions = async () => {
    setIsLoadingSubs(true);
    try {
      const result = await getSubscriptions();
      setSubscriptions(result);
    } catch (e) {
      if (__DEV__) console.warn('Failed to load subscriptions:', e);
    }
    setIsLoadingSubs(false);
  };

  const getSubPrice = (plan: 'monthly' | 'quarterly' | 'yearly'): string | null => {
    const productId = PRODUCT_IDS[plan];
    const sub = subscriptions.find(
      (s: any) => s.id === productId || s.productId === productId
    );
    if (!sub) return null;

    // Android subscription: pricing phase'den formattedPrice al (en doğru kaynak)
    const phase = sub.subscriptionOfferDetailsAndroid?.[0]?.pricingPhases?.pricingPhaseList?.[0];
    if (phase?.formattedPrice) return phase.formattedPrice;

    // Common field'lar (Android/iOS)
    return sub.displayPrice || sub.localizedPrice || null;
  };

  const handleRestore = async () => {
    if (!billingReady) {
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

  const openManageSubscription = async () => {
    const url = Platform.OS === 'ios' ? MANAGE_SUB_URL_IOS : MANAGE_SUB_URL_ANDROID;
    try {
      await Linking.openURL(url);
    } catch {
      // ignore — user can still navigate manually
    }
  };

  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {}
  };

  const handlePurchase = async (plan: 'monthly' | 'quarterly' | 'yearly') => {
    // Consumer right acknowledgement must be granted before any purchase is
    // initiated (TKHK 6502 m.48 pre-contractual info obligation).
    if (!consumerRightAck) {
      Alert.alert(
        (t as any).premium?.consumerRightTitle || 'Onay Gerekli',
        (t as any).premium?.consumerRightAckRequired ||
          'Devam etmeden önce ön bilgilendirme ve cayma hakkı bildirimini onaylayın.',
      );
      return;
    }

    if (!billingReady) {
      // Mock mode: activate directly for development
      const days = plan === 'monthly' ? 30 : plan === 'quarterly' ? 90 : 365;
      const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
      await setPremium(plan, expiresAt);
      onClose();
      return;
    }

    const productId = PRODUCT_IDS[plan];
    setIsPurchasing(true);
    try {
      const token = await purchaseSubscription(productId);
      if (token) {
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

  // Default prices by device country (shown when Google Play isn't available)
  // When billing is active, Play Store returns localized prices
  const localPrices = getLocalizedPrices();
  const monthlyPrice = getSubPrice('monthly') || localPrices.monthly;
  const quarterlyPrice = getSubPrice('quarterly') || localPrices.quarterly;
  const yearlyPrice = getSubPrice('yearly') || localPrices.yearly;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.md }}
          >
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

            {/* Loading indicator for subscriptions */}
            {isLoadingSubs && (
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
                style={[styles.planCard, styles.quarterlyPlan]}
                onPress={() => handlePurchase('quarterly')}
                disabled={isPurchasing}
                accessibilityLabel={`3-month plan, ${quarterlyPrice} per 3 months`}
                accessibilityRole="button"
                accessibilityHint="Purchase the 3-month premium plan"
              >
                <Text style={styles.planName}>{t.premium.quarterly}</Text>
                <Text style={styles.planPrice}>{quarterlyPrice}/{t.premium.threeMonths}</Text>
                <Text style={styles.planSave}>{t.premium.savePercentQuarterly}</Text>
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

            {/* ───── Pre-contractual info (TKHK 6502 m.48 / MSY) ───── */}
            <View style={styles.legalBlock}>
              <Text style={[styles.legalTitle, { color: theme.colors.onSurface }]}>
                {(t as any).premium?.preContractualTitle || 'Ön Bilgilendirme'}
              </Text>
              <Text style={[styles.legalBody, { color: colors.textSecondary }]}>
                {(t as any).premium?.preContractualBody ||
                  'Abonelik ücretleri ekranda gösterilen fiyatlar üzerinden Google Play (Android) veya App Store (iOS) tarafından tahsil edilir. Fiyatlara geçerli KDV dahildir. Abonelik, iptal edilmediği sürece aynı süre ile otomatik olarak yenilenir. Seçtiğiniz plana göre ödeme, mevcut dönemin sonunda mağaza hesabınızdan otomatik olarak alınır.'}
              </Text>

              <Text style={[styles.legalTitle, { color: theme.colors.onSurface, marginTop: spacing.sm }]}>
                {(t as any).premium?.withdrawalTitle || 'Cayma Hakkı'}
              </Text>
              <Text style={[styles.legalBody, { color: colors.textSecondary }]}>
                {(t as any).premium?.withdrawalBody ||
                  '6502 sayılı Tüketicinin Korunması Hakkında Kanun kapsamında 14 gün içinde gerekçe göstermeksizin cayma hakkınız bulunmaktadır. Premium özellikler satın alma ile birlikte anında açıldığından (dijital içerik ifası), cayma hakkınız ifa ile birlikte sona erer. Aşağıdaki kutuyu işaretleyerek bu durumu kabul etmiş olursunuz.'}
              </Text>

              <TouchableOpacity
                onPress={() => setConsumerRightAck((v) => !v)}
                style={styles.ackRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consumerRightAck }}
              >
                <MaterialCommunityIcons
                  name={consumerRightAck ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={22}
                  color={consumerRightAck ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.ackText, { color: theme.colors.onSurface }]}>
                  {(t as any).premium?.consumerRightAck ||
                    'Ön bilgilendirmeyi okudum; dijital içeriğin anında ifası ile cayma hakkımın sona ereceğini kabul ediyorum.'}
                </Text>
              </TouchableOpacity>

              <View style={styles.linkRow}>
                <Button
                  mode="text"
                  compact
                  onPress={() => openUrl(TERMS_URL)}
                  labelStyle={styles.linkLabel}
                >
                  {(t as any).premium?.viewTerms || 'Üyelik Sözleşmesi'}
                </Button>
                <Button
                  mode="text"
                  compact
                  onPress={() => openUrl(PRIVACY_URL)}
                  labelStyle={styles.linkLabel}
                >
                  {(t as any).premium?.viewPrivacy || 'Gizlilik Politikası'}
                </Button>
                <Button
                  mode="text"
                  compact
                  onPress={openManageSubscription}
                  labelStyle={styles.linkLabel}
                >
                  {(t as any).premium?.manageSubscription || 'Aboneliği Yönet / İptal Et'}
                </Button>
              </View>
            </View>

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
            {__DEV__ && !billingReady && (
              <Text style={styles.devNote}>
                DEV: Google Play Billing not available — mock purchases active
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
  quarterlyPlan: {
    backgroundColor: '#1A7A4C',
    marginBottom: spacing.sm,
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
  legalBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: colors.divider,
  },
  legalTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  legalBody: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  ackRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: 6,
  },
  ackText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    marginLeft: 8,
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  linkLabel: {
    fontSize: 11,
    marginHorizontal: 2,
  },
});
