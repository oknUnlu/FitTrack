import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Platform, Alert } from 'react-native';
import { Text, Card, List, Switch, Button, Divider, useTheme, Dialog, Portal, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '../../store/themeStore';
import { useUserStore } from '../../store/userStore';
import { getUserById, User } from '../../services/database/userDao';
import { initializeGemini } from '../../services/ai';
import { colors, spacing, borderRadius } from '../../theme/theme';

const NOTIF_MEAL_KEY = 'pref_meal_reminder';
const NOTIF_WORKOUT_KEY = 'pref_workout_reminder';
const GEMINI_KEY_STORAGE = 'gemini_api_key_plain';

const GOAL_LABELS: Record<string, string> = {
  lose: 'Kilo vermek', gain: 'Kilo almak', muscle: 'Kas geliştirmek', maintain: 'Kiloyu korumak',
};
const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Hareketsiz', light: 'Hafif aktif', moderate: 'Orta aktif', active: 'Aktif', veryActive: 'Çok aktif',
};

export function ProfileScreen() {
  const theme = useTheme();
  const isDark = useThemeStore((s) => s.isDarkMode);
  const toggleDark = useThemeStore((s) => s.toggleDarkMode);
  const userId = useUserStore((s) => s.userId);

  const [user, setUser] = useState<User | null>(null);
  const [mealReminder, setMealReminder] = useState(false);
  const [workoutReminder, setWorkoutReminder] = useState(false);
  const [apiKeyDialogVisible, setApiKeyDialogVisible] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeySet, setApiKeySet] = useState(false);

  const loadData = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const [u, meal, workout, savedKey] = await Promise.all([
        getUserById(userId),
        AsyncStorage.getItem(NOTIF_MEAL_KEY),
        AsyncStorage.getItem(NOTIF_WORKOUT_KEY),
        AsyncStorage.getItem(GEMINI_KEY_STORAGE),
      ]);
      setUser(u);
      setMealReminder(meal === 'true');
      setWorkoutReminder(workout === 'true');
      if (savedKey) {
        setApiKeySet(true);
        initializeGemini(savedKey);
      }
    } catch (e) {
      console.warn('ProfileScreen load failed:', e);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleMealReminder = async (val: boolean) => {
    setMealReminder(val);
    await AsyncStorage.setItem(NOTIF_MEAL_KEY, String(val));
  };

  const toggleWorkoutReminder = async (val: boolean) => {
    setWorkoutReminder(val);
    await AsyncStorage.setItem(NOTIF_WORKOUT_KEY, String(val));
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
      Alert.alert('Başarılı', 'Gemini API anahtarı kaydedildi.');
    } catch (e) {
      Alert.alert('Hata', 'API anahtarı kaydedilemedi.');
    }
  };

  const removeApiKey = async () => {
    Alert.alert('API Anahtarını Sil', 'Gemini API anahtarını silmek istiyor musun?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          await AsyncStorage.removeItem(GEMINI_KEY_STORAGE);
          setApiKeySet(false);
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
    >
      <Text variant="headlineSmall" style={styles.title}>Profil & Ayarlar</Text>

      {/* User Card */}
      <Card style={styles.card} mode="elevated">
        <Card.Content style={{ alignItems: 'center', padding: spacing.lg }}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account" size={48} color="#fff" />
          </View>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginTop: spacing.sm }}>
            {user?.name ?? 'Kullanıcı'}
          </Text>
          {user && (
            <Text style={{ color: '#999', marginTop: 4 }}>
              {user.age} yaş • {user.height} cm • {user.weight} kg
            </Text>
          )}
        </Card.Content>

        {user && (
          <Card.Content style={{ paddingTop: 0, paddingBottom: spacing.md }}>
            <View style={styles.infoRow}>
              <InfoChip icon="bullseye-arrow" label={GOAL_LABELS[user.goal] ?? user.goal} />
              <InfoChip icon="run-fast" label={ACTIVITY_LABELS[user.activityLevel] ?? user.activityLevel} />
              <InfoChip icon="fire" label={`${user.tdee} kcal TDEE`} />
            </View>
          </Card.Content>
        )}
      </Card>

      {/* Makro Hedefler */}
      {user && (
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text style={styles.sectionLabel}>Günlük Hedefler</Text>
            <View style={styles.macroRow}>
              <MacroItem label="Protein" value={`${user.proteinTargetG}g`} color={colors.protein} />
              <MacroItem label="Karbonhidrat" value={`${user.carbsTargetG}g`} color={colors.carbs} />
              <MacroItem label="Yağ" value={`${user.fatTargetG}g`} color={colors.fat} />
              <MacroItem label="Su" value={`${(user.waterTargetMl / 1000).toFixed(1)}L`} color={colors.water} />
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Settings */}
      <Card style={styles.card} mode="elevated">
        <List.Section>
          <List.Subheader>Görünüm</List.Subheader>
          <List.Item
            title="Karanlık Tema"
            left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
            right={() => <Switch value={isDark} onValueChange={toggleDark} />}
          />
          <Divider />
          <List.Subheader>Bildirimler</List.Subheader>
          <List.Item
            title="Öğün Hatırlatıcısı"
            description={mealReminder ? 'Açık' : 'Kapalı'}
            left={(props) => <List.Icon {...props} icon="bell" />}
            right={() => <Switch value={mealReminder} onValueChange={toggleMealReminder} />}
          />
          <List.Item
            title="Antrenman Hatırlatıcısı"
            description={workoutReminder ? 'Açık' : 'Kapalı'}
            left={(props) => <List.Icon {...props} icon="bell-ring" />}
            right={() => <Switch value={workoutReminder} onValueChange={toggleWorkoutReminder} />}
          />
          <Divider />
          <List.Subheader>AI Koç</List.Subheader>
          <List.Item
            title="Gemini API Anahtarı"
            description={apiKeySet ? 'Ayarlandı ✓' : 'Henüz eklenmedi'}
            left={(props) => <List.Icon {...props} icon="key" />}
            right={() => (
              <Button
                compact
                mode="outlined"
                onPress={() => apiKeySet ? removeApiKey() : setApiKeyDialogVisible(true)}
              >
                {apiKeySet ? 'Sil' : 'Ekle'}
              </Button>
            )}
          />
        </List.Section>
      </Card>

      <Text style={{ textAlign: 'center', color: '#999', marginTop: spacing.md, fontSize: 12 }}>
        FitTrack v1.0.0
      </Text>

      {/* API Key Dialog */}
      <Portal>
        <Dialog visible={apiKeyDialogVisible} onDismiss={() => setApiKeyDialogVisible(false)}>
          <Dialog.Title>Gemini API Anahtarı</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: '#666', marginBottom: spacing.sm, fontSize: 13 }}>
              Google AI Studio'dan aldığın API anahtarını gir.
            </Text>
            <TextInput
              label="API Anahtarı"
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              mode="outlined"
              secureTextEntry
              dense
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setApiKeyDialogVisible(false)}>İptal</Button>
            <Button onPress={saveApiKey} disabled={!apiKeyInput.trim()}>Kaydet</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

function InfoChip({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.chip}>
      <MaterialCommunityIcons name={icon as any} size={14} color={colors.primary} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function MacroItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontWeight: 'bold', fontSize: 15, color }}>{value}</Text>
      <Text style={{ color: '#999', fontSize: 11 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontWeight: 'bold', marginBottom: spacing.md },
  card: { borderRadius: borderRadius.lg, marginBottom: spacing.md },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  sectionLabel: { fontWeight: 'bold', fontSize: 14, marginBottom: spacing.sm, color: '#555' },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12,
  },
  chipText: { fontSize: 12, color: '#333' },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.sm },
});
