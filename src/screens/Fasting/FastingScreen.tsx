import React, { useState, useCallback, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Card, Button, useTheme, Switch, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getFastingSettings,
  saveFastingSettings,
  getTodayFastingLog,
  saveFastingLog,
  completeFasting,
  getFastingStreak,
  getRemainingFastingMinutes,
  formatFastingDuration,
  FastingLog,
  FastingSettings,
} from '../../services/fasting/fastingService';
import {
  requestLocationAndGetCoords,
  fetchPrayerTimes,
  getLastCachedPrayerTimes,
  PrayerTimes,
} from '../../services/fasting/prayerTimes';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';
import { generateId, todayString } from '../../utils/helpers';
import { useUserStore } from '../../store/userStore';
import { fastingEligibility } from '../../utils/calculations';
import { MedicalDisclaimer } from '../../components/MedicalDisclaimer';
import { getUserById, User } from '../../services/database/userDao';

export function FastingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const userId = useUserStore((s) => s.userId);

  const [settings, setSettings] = useState<FastingSettings | null>(null);
  const [todayLog, setTodayLog] = useState<FastingLog | null>(null);
  const [streak, setStreak] = useState(0);
  const [remainingMinutes, setRemainingMinutes] = useState(0);
  const [profile, setProfile] = useState<User | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Safety check: block under-18 users and underweight users from fasting.
  const eligibility = fastingEligibility({
    age: profile?.age,
    weightKg: profile?.weight,
    heightCm: profile?.height,
  });

  const loadData = useCallback(async () => {
    try {
      const [s, log, str, u, cachedPT] = await Promise.all([
        getFastingSettings(),
        getTodayFastingLog(),
        getFastingStreak(),
        getUserById(userId),
        getLastCachedPrayerTimes(),
      ]);
      setSettings(s);
      setTodayLog(log);
      setStreak(str);
      setProfile(u);
      if (cachedPT) setPrayerTimes(cachedPT);
      if (s && !log?.completed) {
        setRemainingMinutes(getRemainingFastingMinutes(s.defaultEndTime));
      }
    } catch (e) {
      if (__DEV__) console.warn('FastingScreen loadData failed:', e);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Fetch prayer times from the device's current location. Called from the
  // "Konumdan güncelle" button. Silent failures (denied / network) show an
  // inline message but never block the feature — user can still start a
  // fast with the default/cached times.
  const handleUpdateFromLocation = useCallback(async () => {
    if (!settings) return;
    setLocationLoading(true);
    setLocationError(null);
    try {
      const loc = await requestLocationAndGetCoords();
      if (loc.status !== 'granted' || !loc.coords) {
        setLocationError(
          loc.status === 'denied'
            ? (t as any).fasting?.locationDenied || 'Location permission denied.'
            : (t as any).fasting?.locationUnavailable || 'Could not get location.'
        );
        return;
      }
      const pt = await fetchPrayerTimes(loc.coords);
      if (!pt) {
        setLocationError(
          (t as any).fasting?.locationUnavailable || 'Could not get location.'
        );
        return;
      }
      setPrayerTimes(pt);
      const next: FastingSettings = {
        ...settings,
        defaultStartTime: pt.sahur,
        defaultEndTime: pt.iftar,
      };
      await saveFastingSettings(next);
      setSettings(next);
      if (!todayLog?.completed) {
        setRemainingMinutes(getRemainingFastingMinutes(next.defaultEndTime));
      }
    } catch (e) {
      if (__DEV__) console.warn('handleUpdateFromLocation failed:', e);
      setLocationError(
        (t as any).fasting?.locationUnavailable || 'Could not get location.'
      );
    } finally {
      setLocationLoading(false);
    }
  }, [settings, todayLog, t]);

  // Update remaining time every minute
  useEffect(() => {
    if (!settings || todayLog?.completed) return;
    const interval = setInterval(() => {
      setRemainingMinutes(getRemainingFastingMinutes(settings.defaultEndTime));
    }, 60000);
    return () => clearInterval(interval);
  }, [settings, todayLog]);

  const handleToggleFasting = async (val: boolean) => {
    if (!settings) return;
    const newSettings = { ...settings, enabled: val };
    await saveFastingSettings(newSettings);
    setSettings(newSettings);
  };

  const handleStartFasting = async () => {
    if (!settings) return;
    // Enforce safety gate before logging any session.
    if (!eligibility.allowed) {
      Alert.alert(
        (t as any).fasting?.blockedTitle || 'Safety Warning',
        eligibility.message || 'This feature is not suitable for you.',
      );
      return;
    }
    const log: FastingLog = {
      id: generateId(),
      date: todayString(),
      startTime: settings.defaultStartTime,
      endTime: settings.defaultEndTime,
      completed: false,
      notes: '',
    };
    await saveFastingLog(log);
    setTodayLog(log);
    setRemainingMinutes(getRemainingFastingMinutes(settings.defaultEndTime));
  };

  const handleCompleteFasting = async () => {
    if (!todayLog) return;
    await completeFasting(todayLog.id);
    setTodayLog({ ...todayLog, completed: true });
    setStreak((s) => s + 1);
  };

  if (!settings) return null;

  const fastingActive = todayLog && !todayLog.completed;
  const fastingDone = todayLog?.completed;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
    >
      {!eligibility.allowed && (
        <MedicalDisclaimer
          variant="warning"
          title={(t as any).fasting?.blockedTitle || 'Safety Warning'}
          message={
            eligibility.message ||
            ((t as any).fasting?.blockedBody ||
              'Based on the information you provided, fasting is not recommended for you.')
          }
        />
      )}

      <MedicalDisclaimer
        variant="inline"
        message={
          (t as any).fasting?.disclaimer ||
          'Fasting is not suitable for everyone. Pregnant users, people with diabetes, a history of eating disorders, low BMI, or chronic conditions must consult a doctor before fasting.'
        }
      />

      {/* Enable toggle */}
      <Card style={styles.card} mode="elevated">
        <Card.Content style={styles.rowBetween}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="moon-waning-crescent" size={24} color="#9C27B0" />
            <Text style={{ fontWeight: 'bold', marginLeft: 8 }}>
              {t.fasting.title}
            </Text>
          </View>
          <Switch value={settings.enabled} onValueChange={handleToggleFasting} />
        </Card.Content>
      </Card>

      {!settings.enabled ? (
        <Card style={styles.card} mode="elevated">
          <Card.Content style={{ alignItems: 'center', padding: spacing.lg }}>
            <MaterialCommunityIcons name="moon-waning-crescent" size={48} color={colors.textDisabled} />
            <Text style={{ color: colors.textTertiary, marginTop: 8, textAlign: 'center' }}>
              {t.fasting.enableDesc}
            </Text>
          </Card.Content>
        </Card>
      ) : (
        <>
          {/* Timer / Status Card */}
          <Card style={[styles.card, { backgroundColor: fastingDone ? '#E8F5E9' : fastingActive ? '#F3E5F5' : theme.colors.surface }]} mode="elevated">
            <Card.Content style={{ alignItems: 'center', padding: spacing.lg }}>
              {fastingDone ? (
                <>
                  <MaterialCommunityIcons name="check-circle" size={56} color={colors.primary} />
                  <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: spacing.sm, color: colors.primary }}>
                    {t.fasting.completed}
                  </Text>
                  <Text style={{ color: colors.textTertiary, marginTop: 4 }}>
                    {todayLog?.startTime} - {todayLog?.endTime}
                  </Text>
                </>
              ) : fastingActive ? (
                <>
                  <MaterialCommunityIcons name="timer-sand" size={56} color="#9C27B0" />
                  <Text style={{ fontSize: 32, fontWeight: 'bold', marginTop: spacing.sm, color: '#9C27B0' }}>
                    {formatFastingDuration(remainingMinutes)}
                  </Text>
                  <Text style={{ color: colors.textTertiary, marginTop: 4 }}>
                    {t.fasting.remaining}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 8 }}>
                    {todayLog?.startTime} → {todayLog?.endTime}
                  </Text>
                  {remainingMinutes <= 0 && (
                    <Button
                      mode="contained"
                      onPress={handleCompleteFasting}
                      style={{ marginTop: spacing.md, backgroundColor: colors.primary }}
                      icon="check"
                      accessibilityLabel="Complete fasting"
                    >
                      {t.fasting.complete}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="food-off" size={56} color="#9C27B0" />
                  <Text style={{ fontWeight: 'bold', fontSize: 16, marginTop: spacing.sm }}>
                    {t.fasting.notStarted}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>
                    {settings.defaultStartTime} - {settings.defaultEndTime}
                  </Text>
                  <Button
                    mode="contained"
                    onPress={handleStartFasting}
                    style={{ marginTop: spacing.md, backgroundColor: '#9C27B0' }}
                    icon="play"
                    accessibilityLabel="Start fasting"
                  >
                    {t.fasting.start}
                  </Button>
                </>
              )}
            </Card.Content>
          </Card>

          {/* Streak Card */}
          <Card style={styles.card} mode="elevated">
            <Card.Content style={styles.rowBetween}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 24 }}>🔥</Text>
                <View style={{ marginLeft: spacing.sm }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 18 }}>
                    {streak} {t.fasting.dayStreak}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                    {t.fasting.keepGoing}
                  </Text>
                </View>
              </View>
              <MaterialCommunityIcons name="moon-waning-crescent" size={24} color="#9C27B0" />
            </Card.Content>
          </Card>

          {/* Time Settings Card */}
          <Card style={styles.card} mode="elevated">
            <Card.Content>
              <Text style={{ fontWeight: 'bold', marginBottom: spacing.sm }}>
                {t.fasting.settings}
              </Text>
              <View style={styles.timeRow}>
                <View style={styles.timeItem}>
                  <MaterialCommunityIcons name="weather-night" size={20} color="#5C6BC0" />
                  <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                    {t.fasting.sahur}
                  </Text>
                  <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{settings.defaultStartTime}</Text>
                </View>
                <MaterialCommunityIcons name="arrow-right" size={20} color={colors.textDisabled} />
                <View style={styles.timeItem}>
                  <MaterialCommunityIcons name="weather-sunset" size={20} color="#FF9800" />
                  <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                    {t.fasting.iftar}
                  </Text>
                  <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{settings.defaultEndTime}</Text>
                </View>
              </View>

              {/* City / location row */}
              {prayerTimes?.city ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: spacing.sm,
                  }}
                >
                  <MaterialCommunityIcons name="map-marker" size={16} color="#9C27B0" />
                  <Text style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 4 }}>
                    {prayerTimes.city}
                  </Text>
                </View>
              ) : null}

              {locationError ? (
                <Text
                  style={{
                    color: '#E65100',
                    fontSize: 12,
                    textAlign: 'center',
                    marginTop: spacing.xs,
                  }}
                >
                  {locationError}
                </Text>
              ) : null}

              <Button
                mode="outlined"
                onPress={handleUpdateFromLocation}
                loading={locationLoading}
                disabled={locationLoading}
                icon="map-marker-radius"
                style={{ marginTop: spacing.md }}
                accessibilityLabel="Update fasting times from location"
              >
                {locationLoading
                  ? (t as any).fasting?.locationUpdating || 'Getting location…'
                  : (t as any).fasting?.useDeviceLocation || 'Update from my location'}
              </Button>
            </Card.Content>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { borderRadius: borderRadius.lg, marginBottom: spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: spacing.sm },
  timeItem: { alignItems: 'center' },
});
