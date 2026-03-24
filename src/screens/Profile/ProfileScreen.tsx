import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Platform, Alert } from 'react-native';
import { Text, Card, List, Switch, Button, Divider, useTheme, Dialog, Portal, TextInput, RadioButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '../../store/themeStore';
import { useUserStore } from '../../store/userStore';
import { getUserById, User } from '../../services/database/userDao';
import { initializeGemini } from '../../services/ai';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage, LANGUAGES } from '../../i18n';
import type { Language } from '../../i18n';
import {
  requestNotificationPermission,
  scheduleMealReminders,
  scheduleWaterReminders,
  scheduleWorkoutReminder,
} from '../../services/notifications/notificationService';

const NOTIF_MEAL_KEY = 'pref_meal_reminder';
const NOTIF_WORKOUT_KEY = 'pref_workout_reminder';
const GEMINI_KEY_STORAGE = 'gemini_api_key_plain';

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
  const [apiKeyDialogVisible, setApiKeyDialogVisible] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeySet, setApiKeySet] = useState(false);
  const [langDialogVisible, setLangDialogVisible] = useState(false);

  const GOAL_LABELS: Record<string, string> = {
    lose: t.profile.loseWeight, gain: t.profile.gainWeight, muscle: t.profile.buildMuscle, maintain: t.profile.maintainWeight,
  };
  const ACTIVITY_LABELS: Record<string, string> = {
    sedentary: t.profile.sedentary, light: t.profile.lightlyActive, moderate: t.profile.moderatelyActive, active: t.profile.active, veryActive: t.profile.veryActive,
  };

  const loadData = useCallback(async () => {
    try {
      const [meal, workout, savedKey] = await Promise.all([
        AsyncStorage.getItem(NOTIF_MEAL_KEY),
        AsyncStorage.getItem(NOTIF_WORKOUT_KEY),
        AsyncStorage.getItem(GEMINI_KEY_STORAGE),
      ]);
      setMealReminder(meal === 'true');
      setWorkoutReminder(workout === 'true');
      if (savedKey) {
        setApiKeySet(true);
        initializeGemini(savedKey);
      }
      if (Platform.OS !== 'web') {
        const u = await getUserById(userId);
        setUser(u);
      }
    } catch (e) {
      console.warn('ProfileScreen load failed:', e);
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

  const saveApiKey = async () => {
    const key = apiKeyInput.trim();
    if (!key) return;
    try {
      await AsyncStorage.setItem(GEMINI_KEY_STORAGE, key);
      initializeGemini(key);
      setApiKeySet(true);
      setApiKeyDialogVisible(false);
      setApiKeyInput('');
      Alert.alert(t.common.success, t.profile.apiKeySaved);
    } catch (e) {
      Alert.alert(t.common.error, t.profile.apiKeySaveError);
    }
  };

  const removeApiKey = async () => {
    Alert.alert(t.profile.deleteApiKey, t.profile.deleteApiKeyConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete, style: 'destructive', onPress: async () => {
          await AsyncStorage.removeItem(GEMINI_KEY_STORAGE);
          setApiKeySet(false);
        },
      },
    ]);
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
          <Divider />
          <List.Subheader>{t.profile.aiCoachSection}</List.Subheader>
          <List.Item
            title={t.profile.geminiApiKey}
            description={apiKeySet ? t.profile.configured : t.profile.notConfigured}
            left={(props) => <List.Icon {...props} icon="key" />}
            right={() => (
              <Button
                compact
                mode="outlined"
                onPress={() => apiKeySet ? removeApiKey() : setApiKeyDialogVisible(true)}
              >
                {apiKeySet ? t.common.delete : t.common.add}
              </Button>
            )}
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

      {/* API Key Dialog */}
      <Portal>
        <Dialog visible={apiKeyDialogVisible} onDismiss={() => setApiKeyDialogVisible(false)}>
          <Dialog.Title>{t.profile.geminiApiKey}</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: colors.textSecondary, marginBottom: spacing.sm, fontSize: 13 }}>
              {t.profile.apiKeyInstruction}
            </Text>
            <TextInput
              label={t.profile.geminiApiKey}
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              mode="outlined"
              secureTextEntry
              dense
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setApiKeyDialogVisible(false)}>{t.common.cancel}</Button>
            <Button onPress={saveApiKey} disabled={!apiKeyInput.trim()}>{t.common.save}</Button>
          </Dialog.Actions>
        </Dialog>

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
