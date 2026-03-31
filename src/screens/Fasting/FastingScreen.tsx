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
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';
import { generateId, todayString } from '../../utils/helpers';

export function FastingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [settings, setSettings] = useState<FastingSettings | null>(null);
  const [todayLog, setTodayLog] = useState<FastingLog | null>(null);
  const [streak, setStreak] = useState(0);
  const [remainingMinutes, setRemainingMinutes] = useState(0);

  const loadData = useCallback(async () => {
    const [s, log, str] = await Promise.all([
      getFastingSettings(),
      getTodayFastingLog(),
      getFastingStreak(),
    ]);
    setSettings(s);
    setTodayLog(log);
    setStreak(str);
    if (s && !log?.completed) {
      setRemainingMinutes(getRemainingFastingMinutes(s.defaultEndTime));
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

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
