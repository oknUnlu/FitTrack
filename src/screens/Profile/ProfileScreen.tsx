import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, List, Switch, Button, Divider, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';
import { colors, spacing, borderRadius } from '../../theme/theme';

export function ProfileScreen() {
  const theme = useTheme();
  const isDark = useThemeStore((s) => s.isDarkMode);
  const toggleDark = useThemeStore((s) => s.toggleDarkMode);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md }}
    >
      <Text variant="headlineSmall" style={styles.title}>Profil & Ayarlar</Text>

      {/* User Card */}
      <Card style={styles.card} mode="elevated">
        <Card.Content style={{ alignItems: 'center', padding: spacing.lg }}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account" size={48} color="#fff" />
          </View>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginTop: spacing.sm }}>Kullanıcı</Text>
          <Text style={{ color: '#999' }}>Profil bilgilerini düzenle</Text>
        </Card.Content>
      </Card>

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
          <List.Item title="Öğün Hatırlatıcısı" left={(props) => <List.Icon {...props} icon="bell" />}
            right={() => <Switch value={false} />} />
          <List.Item title="Antrenman Hatırlatıcısı" left={(props) => <List.Icon {...props} icon="bell-ring" />}
            right={() => <Switch value={false} />} />
          <Divider />
          <List.Subheader>AI Koç</List.Subheader>
          <List.Item title="Gemini API Anahtarı" description="API key ekle veya güncelle"
            left={(props) => <List.Icon {...props} icon="key" />} />
          <Divider />
          <List.Subheader>Veri Yönetimi</List.Subheader>
          <List.Item title="Verileri Dışa Aktar" description="JSON olarak indir"
            left={(props) => <List.Icon {...props} icon="download" />} />
          <List.Item title="Verileri İçe Aktar" left={(props) => <List.Icon {...props} icon="upload" />} />
        </List.Section>
      </Card>

      <Text style={{ textAlign: 'center', color: '#999', marginTop: spacing.md, fontSize: 12 }}>
        FitTrack v1.0.0
      </Text>
    </ScrollView>
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
});
