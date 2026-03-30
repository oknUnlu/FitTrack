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
import { getReferralCode, shareReferralInvite, getReferralCount } from '../../services/referral/referralService';

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
  const [referralCode, setReferralCode] = useState('');
  const [referralCount, setReferralCount] = useState(0);
  const isPremium = usePremiumStore((s) => s.isPremium);
  const premiumPlan = usePremiumStore((s) => s.plan);
  const premiumExpiresAt = usePremiumStore((s) => s.expiresAt);
  const clearPremium = usePremiumStore((s) => s.clearPremium);

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
      // Load referral data
      const [code, count] = await Promise.all([
        getReferralCode(),
        getReferralCount(),
      ]);
      setReferralCode(code);
      setReferralCount(count);
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

  const handleShareReferral = async () => {
    await shareReferralInvite(
      'FitTrack ile fitness hedeflerine ulasmak cok kolay! AI destekli kocluk, kalori takibi ve daha fazlasi. Hemen dene!'
    );
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
        <Card.Content style={{ alignItems: 'center', padding: spacing.lg }}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account" size={48} color="#fff" />
          </View>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginTop: spacing.sm }}>
            {user?.name ?? t.profile.user}
          </Text>
          {user && (
            <Text style={{ color: colors.textTertiary, marginTop: 4 }}>
              {user.age} {t.profile.age} • {user.height} {t.common.cm} • {user.weight} {t.common.kg}
            </Text>
          )}
        </Card.Content>

        {user && (
          <Card.Content style={{ paddingTop: 0, paddingBottom: spacing.md }}>
            <View style={styles.infoRow}>
              <InfoChip icon="bullseye-arrow" label={GOAL_LABELS[user.goal] ?? user.goal} />
              <InfoChip icon="run-fast" label={ACTIVITY_LABELS[user.activityLevel] ?? user.activityLevel} />
              <InfoChip icon="fire" label={`${user.tdee} ${t.common.kcal} TDEE`} />
            </View>
          </Card.Content>
        )}
      </Card>

      {/* Premium Section */}
      {isPremium ? (
        <Card style={[styles.card, { borderColor: '#FFD700', borderWidth: 1 }]} mode="elevated">
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <MaterialCommunityIcons name="crown" size={24} color="#FFD700" />
              <Text style={{ fontWeight: 'bold', fontSize: 16, marginLeft: 8 }}>
                {(t as any).premium?.title || 'FitTrack Premium'}
              </Text>
              <View style={{ marginLeft: 'auto', backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                  {premiumPlan.toUpperCase()}
                </Text>
              </View>
            </View>
            {premiumExpiresAt && (
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                {(t as any).premium?.expiresAt || 'Expires'}: {new Date(premiumExpiresAt).toLocaleDateString()}
              </Text>
            )}
          </Card.Content>
        </Card>
      ) : (
        <Card
          style={[styles.card, { backgroundColor: 'rgba(255,215,0,0.08)' }]}
          mode="elevated"
          onPress={() => setPaywallVisible(true)}
          accessibilityLabel="Upgrade to Premium, unlock all features"
          accessibilityRole="button"
        >
          <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="crown" size={32} color="#FFD700" />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16 }}>
                {(t as any).premium?.upgradeNow || 'Upgrade to Premium'}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                {(t as any).premium?.subtitle || 'Unlock all features'}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textTertiary} />
          </Card.Content>
        </Card>
      )}

      {/* Referral Card */}
      <Card style={[styles.card, { backgroundColor: '#E8F5E9' }]} mode="elevated">
        <Card.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <MaterialCommunityIcons name="gift" size={24} color={colors.primary} />
            <Text style={{ fontWeight: 'bold', fontSize: 15, marginLeft: 8 }}>
              {(t as any).referral?.title || 'Invite Friends'}
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: spacing.sm }}>
            {(t as any).referral?.desc || 'Share FitTrack and earn 7 days free premium for each friend!'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontWeight: 'bold', fontSize: 13, letterSpacing: 1 }}>{referralCode}</Text>
              </View>
              <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{referralCount} {(t as any).referral?.invited || 'invited'}</Text>
            </View>
            <Button
              mode="contained"
              icon="share-variant"
              compact
              onPress={handleShareReferral}
              accessibilityLabel="Share referral invite"
            >
              {(t as any).referral?.share || 'Share'}
            </Button>
          </View>
        </Card.Content>
      </Card>

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
  card: { borderRadius: borderRadius.lg, marginBottom: spacing.md },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  sectionLabel: { fontWeight: 'bold', fontSize: 14, marginBottom: spacing.sm, color: colors.textSecondary },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.successBg, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12,
  },
  chipText: { fontSize: 12, color: colors.textPrimary },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.sm },
});
