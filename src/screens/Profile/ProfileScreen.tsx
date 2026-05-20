import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Platform, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, List, Switch, Button, Divider, useTheme, Dialog, Portal, TextInput, RadioButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../store/themeStore';
import { useUserStore } from '../../store/userStore';
import { getUserById, User } from '../../services/database/userDao';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage, LANGUAGES } from '../../i18n';
import type { Language } from '../../i18n';
import { usePremiumStore, PremiumPlan } from '../../store/premiumStore';
import { PaywallModal } from '../../components/PaywallModal';
import {
  requestNotificationPermission,
  scheduleMealReminders,
  scheduleWaterReminders,
  scheduleWorkoutReminder,
  getNotificationPreferences,
} from '../../services/notifications/notificationService';
import { validatePromoCode } from '../../services/api/promoService';
import { exportUserData, deleteAccount } from '../../services/privacy/dataPrivacy';
import { resetAdConsent } from '../../services/ads/adService';

export function ProfileScreen() {
  const theme = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const isDark = useThemeStore((s) => s.isDarkMode);
  const toggleDark = useThemeStore((s) => s.toggleDarkMode);
  const userId = useUserStore((s) => s.userId);
  const resetOnboarding = useUserStore((s) => s.resetOnboarding);

  const navigation = useNavigation();
  const [user, setUser] = useState<User | null>(null);
  const [mealReminder, setMealReminder] = useState(false);
  const [workoutReminder, setWorkoutReminder] = useState(false);
  const [waterReminder, setWaterReminder] = useState(false);
  const [langDialogVisible, setLangDialogVisible] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [promoDialogVisible, setPromoDialogVisible] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const isPremium = usePremiumStore((s) => s.isPremium);
  const premiumPlan = usePremiumStore((s) => s.plan);
  const premiumExpiresAt = usePremiumStore((s) => s.expiresAt);
  const setPremium = usePremiumStore((s) => s.setPremium);

  const GOAL_LABELS: Record<string, string> = {
    lose: t.profile.loseWeight, gain: t.profile.gainWeight, muscle: t.profile.buildMuscle, maintain: t.profile.maintainWeight,
  };
  const ACTIVITY_LABELS: Record<string, string> = {
    sedentary: t.profile.sedentary, light: t.profile.lightlyActive, moderate: t.profile.moderatelyActive, active: t.profile.active, veryActive: t.profile.veryActive,
  };

  const loadData = useCallback(async () => {
    try {
      // Pull every reminder pref from the single source of truth in
      // notificationService. Previously we read meal+workout directly from
      // AsyncStorage and silently dropped water — meaning water reminders
      // could be scheduled but the toggle UI showed disabled, leaving the
      // user with phantom notifications they couldn't see how to cancel.
      const prefs = await getNotificationPreferences();
      setMealReminder(prefs.meal);
      setWaterReminder(prefs.water);
      setWorkoutReminder(prefs.workout);
      if (Platform.OS !== 'web') {
        const u = await getUserById(userId);
        setUser(u);
      }
    } catch (e) {
      if (__DEV__) console.warn('ProfileScreen load failed:', e);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleMealReminder = async (val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermission();
      if (!granted) return;
    }
    await scheduleMealReminders(val);
    setMealReminder(val);
  };

  const toggleWorkoutReminder = async (val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermission();
      if (!granted) return;
    }
    await scheduleWorkoutReminder(val);
    setWorkoutReminder(val);
  };

  const toggleWaterReminder = async (val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermission();
      if (!granted) return;
    }
    await scheduleWaterReminders(val);
    setWaterReminder(val);
  };

  const handlePromoSubmit = async () => {
    const code = promoCode.trim();
    if (!code) return;

    setPromoLoading(true);
    try {
      const result = await validatePromoCode(code);
      if (result.success) {
        await setPremium('promo', result.expiresAt);
        setPromoDialogVisible(false);
        setPromoCode('');
        Alert.alert(t.common.success, t.premium.promoActivated);
      }
    } catch (error: any) {
      const msg = error.message || '';
      if (msg.includes('Invalid') || msg.includes('404')) {
        Alert.alert(t.common.error, t.premium.promoInvalid);
      } else if (msg.includes('expired') || msg.includes('410')) {
        Alert.alert(t.common.error, t.premium.promoExpired);
      } else {
        Alert.alert(t.common.error, t.premium.promoError);
      }
    } finally {
      setPromoLoading(false);
    }
  };

  const currentLangName = LANGUAGES.find((l) => l.code === language)?.nativeName ?? language;

  const insets = useSafeAreaInsets();


  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingTop: insets.top + spacing.md, paddingBottom: 100 }}
    >
      <Text variant="headlineSmall" style={styles.title}>{t.profile.title}</Text>

      {/* User Card */}
      <Card style={styles.card} mode="elevated">
        <Card.Content style={styles.userCardContent}>
          <View style={styles.userTopRow}>
            <View style={styles.avatar}>
              <MaterialCommunityIcons name="account" size={28} color="#fff" />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {user?.name ?? t.profile.user}
              </Text>
              {user && (
                <Text style={styles.userStats}>
                  {user.age} {t.profile.age} • {user.height} {t.common.cm} • {user.weight} {t.common.kg}
                </Text>
              )}
            </View>
          </View>

          {user && (
            <View style={styles.infoRow}>
              <InfoChip icon="bullseye-arrow" label={GOAL_LABELS[user.goal] ?? user.goal} />
              <InfoChip icon="run-fast" label={ACTIVITY_LABELS[user.activityLevel] ?? user.activityLevel} />
              <InfoChip icon="fire" label={`${user.tdee} ${t.common.kcal} TDEE`} />
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Premium Section */}
      {isPremium ? (
        <Card style={[styles.card, { borderColor: '#FFD700', borderWidth: 1 }]} mode="elevated">
          <Card.Content>
            <View style={styles.premiumRow}>
              <MaterialCommunityIcons name="crown" size={20} color="#FFD700" />
              <Text style={styles.premiumTitle}>{t.premium.title}</Text>
              <View style={styles.premiumPlanBadge}>
                <Text style={styles.premiumPlanText}>{(premiumPlan ?? 'FREE').toString().toUpperCase()}</Text>
              </View>
            </View>
            {premiumExpiresAt && (
              <Text style={styles.premiumExpiry}>
                {t.premium.expiresAt}: {new Date(premiumExpiresAt).toLocaleDateString()}
              </Text>
            )}
          </Card.Content>
        </Card>
      ) : (
        <>
          <TouchableOpacity
            onPress={() => setPaywallVisible(true)}
            activeOpacity={0.85}
            accessibilityLabel="Upgrade to Premium, unlock all features"
            accessibilityRole="button"
            style={styles.premiumHeroWrap}
          >
            <View style={styles.premiumHeroCard}>
              <View style={styles.premiumHeroCrownCircle}>
                <MaterialCommunityIcons name="crown" size={26} color="#1A1A2E" />
              </View>
              <View style={styles.premiumHeroTextCol}>
                <View style={styles.premiumHeroTitleRow}>
                  <Text style={styles.premiumHeroTitle}>{t.premium.upgradeNow}</Text>
                  <View style={styles.premiumHeroBadge}>
                    <Text style={styles.premiumHeroBadgeText}>PRO</Text>
                  </View>
                </View>
                <Text style={styles.premiumHeroSubtitle} numberOfLines={2}>
                  {t.premium.subtitle}
                </Text>
              </View>
              <View style={styles.premiumHeroArrow}>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#FFD700" />
              </View>
            </View>
          </TouchableOpacity>
          <Card style={styles.card} mode="elevated">
            <List.Section>
              <List.Item
                title={t.premium.promoCode}
                description={t.premium.enterPromoCode}
                left={(props) => <List.Icon {...props} icon="ticket-percent" />}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => setPromoDialogVisible(true)}
              />
            </List.Section>
          </Card>
        </>
      )}

      {/* Makro Hedefler */}
      {user && (
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text style={styles.sectionLabel}>{t.profile.dailyGoals}</Text>
            <View style={styles.macroRow}>
              <MacroItem label={t.dashboard.protein} value={`${user.proteinTargetG}g`} color={colors.protein} />
              <MacroItem label={t.dashboard.carbs} value={`${user.carbsTargetG}g`} color={colors.carbs} />
              <MacroItem label={t.dashboard.fat} value={`${user.fatTargetG}g`} color={colors.fat} />
              <MacroItem label={t.profile.water} value={`${(user.waterTargetMl / 1000).toFixed(1)}L`} color={colors.water} />
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Body Metrics shortcut */}
      <Card style={styles.card} mode="elevated">
        <List.Section>
          <List.Item
            title={t.bodyMetrics.title}
            description={t.bodyMetrics.trackProgress}
            left={(props) => <List.Icon {...props} icon="tape-measure" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => (navigation as any).navigate('BodyMetrics')}
          />
        </List.Section>
      </Card>

      {/* Settings */}
      <Card style={styles.card} mode="elevated">
        <List.Section>
          <List.Subheader>{t.profile.appearance}</List.Subheader>
          <List.Item
            title={t.profile.darkTheme}
            left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
            right={() => <Switch value={isDark} onValueChange={toggleDark} />}
          />
          <List.Item
            title={t.profile.language}
            description={currentLangName}
            left={(props) => <List.Icon {...props} icon="translate" />}
            onPress={() => setLangDialogVisible(true)}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
          />
          <Divider />
          <List.Subheader>{t.profile.notifications}</List.Subheader>
          <List.Item
            title={t.profile.mealReminder}
            description={mealReminder ? t.profile.on : t.profile.off}
            left={(props) => <List.Icon {...props} icon="bell" />}
            right={() => <Switch value={mealReminder} onValueChange={toggleMealReminder} />}
          />
          <List.Item
            title={t.profile.waterReminder}
            description={waterReminder ? t.profile.on : t.profile.off}
            left={(props) => <List.Icon {...props} icon="water" />}
            right={() => <Switch value={waterReminder} onValueChange={toggleWaterReminder} />}
          />
          <List.Item
            title={t.profile.workoutReminder}
            description={workoutReminder ? t.profile.on : t.profile.off}
            left={(props) => <List.Icon {...props} icon="bell-ring" />}
            right={() => <Switch value={workoutReminder} onValueChange={toggleWorkoutReminder} />}
          />
        </List.Section>
      </Card>

      {/* Legal */}
      <Card style={styles.card} mode="elevated">
        <List.Section>
          <List.Item
            title={t.privacy.title}
            left={(props) => <List.Icon {...props} icon="shield-lock" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => (navigation as any).navigate('Privacy')}
          />
          <List.Item
            title={t.kvkk.title}
            left={(props) => <List.Icon {...props} icon="shield-account" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => (navigation as any).navigate('Kvkk')}
          />
          <List.Item
            title={t.terms.title}
            left={(props) => <List.Icon {...props} icon="file-document-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => (navigation as any).navigate('Terms')}
          />
          {/* Reklam tercihleri — Google AdMob'un UMP TOS'u, kullanıcının
              consent form'unu yeniden açabilmesini zorunlu kılıyor. Bu
              satır o gerekliliği karşılıyor; bilinçli olarak Yasal kartının
              içine yerleştirildi (Privacy/KVKK/Terms ile aynı tematik
              bağlam) — ayrı bir "Gizlilik" kartı kurmadan tek satırla
              compliance sağlanır. */}
          <List.Item
            title={(t as any).profile?.adPreferencesTitle || 'Reklam tercihleri'}
            left={(props) => <List.Icon {...props} icon="bullhorn-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={async () => {
              const ok = await resetAdConsent();
              if (!ok) {
                Alert.alert(
                  '',
                  (t as any).profile?.adPreferencesUnavailable ||
                    'Bu özellik şu an cihazında kullanılamıyor.'
                );
              }
            }}
          />
        </List.Section>
      </Card>

      {/* Privacy: export + delete (KVKK/GDPR rights) */}
      <Card style={styles.card} mode="elevated">
        <List.Section>
          <List.Item
            title={(t as any).profile?.exportData || 'Verilerimi Dışa Aktar'}
            description={(t as any).profile?.exportDataDesc || 'Tüm verilerinizi JSON dosyası olarak indirin'}
            left={(props) => <List.Icon {...props} icon="download" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={async () => {
              try {
                const result = await exportUserData();
                if (!result) {
                  Alert.alert(t.common.error, (t as any).profile?.exportFailed || 'Dışa aktarma başarısız.');
                }
              } catch {
                Alert.alert(t.common.error, (t as any).profile?.exportFailed || 'Dışa aktarma başarısız.');
              }
            }}
          />
          <List.Item
            title={(t as any).profile?.deleteAccount || 'Hesabımı Sil'}
            description={(t as any).profile?.deleteAccountDesc || 'Tüm verileriniz kalıcı olarak silinir (geri alınamaz)'}
            left={(props) => <List.Icon {...props} icon="delete-forever" color="#D32F2F" />}
            onPress={() =>
              Alert.alert(
                (t as any).profile?.deleteAccount || 'Hesabımı Sil',
                (t as any).profile?.deleteAccountConfirm ||
                  'Bu işlem geri alınamaz. Tüm antrenman, öğün, vücut ölçümü ve AI sohbet kayıtlarınız kalıcı olarak silinecek. Devam etmek istiyor musunuz?',
                [
                  { text: t.common.cancel, style: 'cancel' },
                  {
                    text: (t as any).profile?.deleteConfirmCta || 'Evet, Kalıcı Olarak Sil',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await deleteAccount();
                        await resetOnboarding();
                      } catch (e) {
                        Alert.alert(t.common.error, (t as any).profile?.deleteFailed || 'Silme başarısız.');
                      }
                    },
                  },
                ]
              )
            }
          />
        </List.Section>
      </Card>

      {/* Reset Account (soft reset — keeps data but re-runs onboarding) */}
      <Card style={styles.card} mode="elevated">
        <List.Section>
          <List.Item
            title={t.profile.resetAccount}
            description={t.profile.resetAccountDesc}
            left={(props) => <List.Icon {...props} icon="refresh" color="#F44336" />}
            onPress={() =>
              Alert.alert(
                t.profile.resetAccount,
                t.profile.resetAccountConfirm,
                [
                  { text: t.common.cancel, style: 'cancel' },
                  {
                    text: t.common.yes,
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        // Wipe all local data (SQLite + zustand + AsyncStorage)
                        // without notifying the server — user may still want to
                        // re-onboard with the same account.
                        await deleteAccount({ notifyServer: false });
                      } catch (e) {
                        if (__DEV__) console.warn('resetAccount deleteAccount failed:', e);
                      }
                      try {
                        await resetOnboarding();
                      } catch (e) {
                        if (__DEV__) console.warn('resetAccount resetOnboarding failed:', e);
                      }
                    },
                  },
                ]
              )
            }
          />
        </List.Section>
      </Card>

      <Text style={{ textAlign: 'center', color: colors.textTertiary, marginTop: spacing.md, fontSize: 12 }}>
        {t.profile.version}
      </Text>

      <Portal>
        {/* Language Selection Dialog */}
        <Dialog visible={langDialogVisible} onDismiss={() => setLangDialogVisible(false)}>
          <Dialog.Title>{t.profile.selectLanguage}</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group onValueChange={(val) => { setLanguage(val as Language); setLangDialogVisible(false); }} value={language}>
              {LANGUAGES.map((lang) => (
                <RadioButton.Item
                  key={lang.code}
                  label={lang.nativeName}
                  value={lang.code}
                  style={{ paddingVertical: 2 }}
                />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLangDialogVisible(false)}>{t.common.cancel}</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Promo Code Dialog */}
        <Dialog visible={promoDialogVisible} onDismiss={() => { setPromoDialogVisible(false); setPromoCode(''); }}>
          <Dialog.Title>{t.premium.enterPromoCode}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              placeholder={t.premium.promoPlaceholder}
              value={promoCode}
              onChangeText={setPromoCode}
              autoCapitalize="characters"
              maxLength={30}
              disabled={promoLoading}
              style={{ marginTop: 4 }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setPromoDialogVisible(false); setPromoCode(''); }}>{t.common.cancel}</Button>
            <Button
              mode="contained"
              onPress={handlePromoSubmit}
              loading={promoLoading}
              disabled={promoLoading || !promoCode.trim()}
            >
              {t.premium.activate}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} />
    </ScrollView>
  );
}

const InfoChip = React.memo(function InfoChip({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.chip}>
      <MaterialCommunityIcons name={icon as any} size={14} color={colors.primary} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
});

const MacroItem = React.memo(function MacroItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontWeight: 'bold', fontSize: 15, color }}>{value}</Text>
      <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontWeight: 'bold', marginBottom: spacing.md },
  card: { borderRadius: borderRadius.lg, marginBottom: spacing.sm },

  // User Card
  userCardContent: { padding: spacing.md },
  userTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  userInfo: { flex: 1, marginLeft: spacing.sm },
  userName: { fontWeight: 'bold', fontSize: 16 },
  userStats: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.successBg, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10,
  },
  chipText: { fontSize: 11, color: colors.textPrimary },

  // Premium (active)
  premiumRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  premiumTitle: { fontWeight: 'bold', fontSize: 15, flex: 1 },
  premiumPlanBadge: { backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  premiumPlanText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  premiumExpiry: { color: colors.textTertiary, fontSize: 11, marginTop: spacing.xs },

  // Premium Upgrade CTA (hero)
  premiumHeroWrap: {
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  premiumHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: '#1A1A2E',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: '#FFD700',
  },
  premiumHeroCrownCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumHeroTextCol: { flex: 1, marginLeft: spacing.md },
  premiumHeroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  premiumHeroTitle: { fontWeight: 'bold', fontSize: 16, color: '#FFFFFF' },
  premiumHeroBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  premiumHeroBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1A1A2E',
    letterSpacing: 0.5,
  },
  premiumHeroSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 3,
  },
  premiumHeroArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,215,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },

  // Macro Goals
  sectionLabel: { fontWeight: 'bold', fontSize: 13, marginBottom: spacing.sm, color: colors.textSecondary },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.xs },
});
