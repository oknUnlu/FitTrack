import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, FlatList, Platform } from 'react-native';
import { Text, Card, Button, Chip, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useUserStore } from '../../store/userStore';
import { getRecentSessions, getBuiltInTemplates, WorkoutSession, WorkoutTemplate } from '../../services/database/workoutDao';
import { colors, spacing, borderRadius } from '../../theme/theme';

export function WorkoutScreen() {
  const userId = useUserStore((s) => s.userId);
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      try {
        const [s, t] = await Promise.all([
          getRecentSessions(userId),
          getBuiltInTemplates(),
        ]);
        setSessions(s);
        setTemplates(t);
      } catch (e) {
        console.warn('WorkoutScreen load failed:', e);
      }
    })();
  }, [userId]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
    >
      <Text variant="headlineSmall" style={styles.title}>Antrenman</Text>

      {/* Start empty workout */}
      <Button
        mode="contained"
        icon="play"
        style={{ backgroundColor: colors.primary, marginBottom: spacing.lg, borderRadius: borderRadius.md }}
        onPress={() => navigation.navigate('ActiveWorkout')}
      >
        Boş Antrenman Başlat
      </Button>

      {/* Templates */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Hazır Programlar</Text>
      <FlatList
        horizontal
        data={templates}
        keyExtractor={(t) => t.id}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Card style={styles.templateCard} mode="elevated">
            <Card.Content>
              <Text style={{ fontWeight: 'bold', fontSize: 14 }}>{item.name}</Text>
              <Text style={{ color: '#999', fontSize: 11, marginTop: 4 }}>{item.description}</Text>
              <View style={{ flexDirection: 'row', marginTop: 8, gap: 4, flexWrap: 'wrap' }}>
                <Chip compact textStyle={{ fontSize: 10 }}>{item.difficulty}</Chip>
                <Chip compact textStyle={{ fontSize: 10 }}>{item.days.length} gün</Chip>
                <Chip compact textStyle={{ fontSize: 10 }}>{item.estimatedDuration} dk</Chip>
              </View>
            </Card.Content>
          </Card>
        )}
        style={{ marginBottom: spacing.lg }}
      />

      {/* Recent Sessions */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Son Antrenmanlar</Text>
      {sessions.length === 0 ? (
        <Card style={styles.emptyCard} mode="elevated">
          <Card.Content style={{ alignItems: 'center', padding: spacing.lg }}>
            <MaterialCommunityIcons name="dumbbell" size={48} color="#ccc" />
            <Text style={{ color: '#999', marginTop: 8 }}>Henüz antrenman kaydı yok</Text>
          </Card.Content>
        </Card>
      ) : (
        sessions.map((s) => (
          <Card key={s.id} style={styles.sessionCard} mode="elevated">
            <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontWeight: 'bold' }}>{s.name}</Text>
                <Text style={{ color: '#999', fontSize: 12 }}>{s.date}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontWeight: '600' }}>{s.durationMinutes} dk</Text>
                <Text style={{ color: colors.orange, fontSize: 12 }}>{s.caloriesBurned} kcal</Text>
              </View>
            </Card.Content>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontWeight: 'bold', marginBottom: spacing.md },
  sectionTitle: { fontWeight: 'bold', marginBottom: spacing.sm },
  templateCard: { width: 200, borderRadius: borderRadius.md, marginRight: spacing.sm },
  sessionCard: { borderRadius: borderRadius.md, marginBottom: spacing.sm },
  emptyCard: { borderRadius: borderRadius.md },
});
