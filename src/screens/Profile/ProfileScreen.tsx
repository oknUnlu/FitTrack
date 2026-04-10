import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Platform, Alert } from 'react-native';
import { Text, Card, List, Switch, Button, Divider, useTheme, Dialog, Portal, TextInput, RadioButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
} from '../../services/notifications/notificationService';
import { validatePromoCode } from '../../services/api/promoService';

const NOTIF_MEAL_KEY = 'pref_meal_reminder';
const NOTIF_WORKOUT_KEY = 'pref_workout_reminder';

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
      const [meal, workout] = await Promise.all([
        AsyncStorage.getItem(NOTIF_MEAL_KEY),
        AsyncStorage.getItem(NOTIF_WORKOUT_KEY),
      ]);
      setMealReminder(meal === 'true');
      setWorkoutReminder(workout === 'true');
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
    if (val) await requestNotificationPermission();
    setMealReminder(val);
    await scheduleMealReminders(val);
  };

  const toggleWorkoutReminder = async (val: boolean) => {
    if (val) await requestNotificationPermission();
    setWorkoutReminder(val);
    await scheduleWorkoutReminder(val);
  };

  const toggleWaterReminder = async (val: boolean) => {
    if (val) await requestNotificationPermission();
    setWaterReminder(val);
    await scheduleWaterReminders(val);
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
                <Text style={styles.premiumPlanText}>{premiumPlan.toUpperCase()}</Text>
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
          <Card
            style={[styles.card, { backgroundColor: 'rgba(255,215,0,0.08)' }]}
            mode="elevated"
            onPress={() => setPaywallVisible(true)}
            accessibilityLabel="Upgrade to Premium, unlock all features"
            accessibilityRole="button"
          >
            <Card.Content style={styles.premiumUpgradeRow}>
              <MaterialCommunityIcons name="crown" size={28} color="#FFD700" />
              <View style={styles.premiumUpgradeText}>
                <Text style={styles.premiumUpgradeTitle}>{t.premium.upgradeNow}</Text>
                <Text style={styles.premiumUpgradeSubtitle}>{t.premium.subtitle}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
            </Card.Content>
          </Card>
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

      {/* Privacy Policy */}
      <Card style={styles.card} mode="elevated">
        <List.Section>
          <List.Item
            title={t.privacy.title}
            left={(props) => <List.Icon {...props} icon="shield-lock" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => (navigation as any).navigate('Privacy')}
          />
        </List.Section>
      </Card>

      {/* Reset Account */}
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
                    onPress: () => resetOnboarding(),
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

  // Premium
  premiumRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  premiumTitle: { fontWeight: 'bold', fontSize: 15, flex: 1 },
  premiumPlanBadge: { backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  premiumPlanText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  premiumExpiry: { color: colors.textTertiary, fontSize: 11, marginTop: spacing.xs },
  premiumUpgradeRow: { flexDirection: 'row', alignItems: 'center' },
  premiumUpgradeText: { flex: 1, marginLeft: spacing.sm },
  premiumUpgradeTitle: { fontWeight: 'bold', fontSize: 15 },
  premiumUpgradeSubtitle: { color: colors.textTertiary, fontSize: 12 },

  // Macro Goals
  sectionLabel: { fontWeight: 'bold', fontSize: 13, marginBottom: spacing.sm, color: colors.textSecondary },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.xs },
});
