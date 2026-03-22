import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, FlatList, Platform } from 'react-native';
import { Text, Card, Button, Chip, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useUserStore } from '../../store/userStore';
import { getRecentSessions, getBuiltInTemplates, getTotalCompletedWorkouts, WorkoutSession, WorkoutTemplate } from '../../services/database/workoutDao';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';

export function WorkoutScreen() {
  const userId = useUserStore((s) => s.userId);
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const { t } = useLanguage();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [totalWorkouts, setTotalWorkouts] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      try {
        const [sessionsData, templatesData, totalCount] = await Promise.all([
          getRecentSessions(userId),
          getBuiltInTemplates(),
          getTotalCompletedWorkouts(userId),
        ]);
        setSessions(sessionsData);
        setTemplates(templatesData);
        setTotalWorkouts(totalCount);
      } catch (e) {
        console.warn('WorkoutScreen load failed:', e);
      }
    })();
  }, [userId]);

  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingTop: insets.top + spacing.md, paddingBottom: 100 }}
    >
      <Text variant="headlineSmall" style={styles.title}>{t.workout.title}</Text>

      {/* Workout stats summary */}
      {totalWorkouts > 0 && (
        <Card style={styles.statsCard} mode="elevated">
          <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="trophy" size={28} color="#FFC107" />
            <View style={{ marginLeft: spacing.sm, flex: 1 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 18 }}>{totalWorkouts}</Text>
              <Text style={{ color: '#999', fontSize: 12 }}>{t.progress.totalWorkouts}</Text>
            </View>
            {sessions.length > 0 && sessions[0].completedAt && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontWeight: '600', color: colors.primary }}>{sessions[0].caloriesBurned} {t.common.kcal}</Text>
                <Text style={{ color: '#999', fontSize: 11 }}>{t.workout.recentWorkouts}</Text>
              </View>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Start empty workout */}
      <Button
        mode="contained"
        icon="play"
        style={{ backgroundColor: colors.primary, marginBottom: spacing.lg, borderRadius: borderRadius.md }}
        onPress={() => navigation.navigate('ActiveWorkout')}
      >
        {t.workout.startEmpty}
      </Button>

      {/* Templates */}
      <Text variant="titleMedium" style={styles.sectionTitle}>{t.workout.builtInPrograms}</Text>
      <FlatList
        horizontal
        data={templates}
        keyExtractor={(tmpl) => tmpl.id}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Card style={styles.templateCard} mode="elevated">
            <Card.Content>
              <Text style={{ fontWeight: 'bold', fontSize: 14 }}>{item.name}</Text>
              <Text style={{ color: '#999', fontSize: 11, marginTop: 4 }}>{item.description}</Text>
              <View style={{ flexDirection: 'row', marginTop: 8, gap: 4, flexWrap: 'wrap' }}>
                <Chip compact textStyle={{ fontSize: 10 }}>{item.difficulty}</Chip>
                <Chip compact textStyle={{ fontSize: 10 }}>{item.days.length} {t.common.days}</Chip>
                <Chip compact textStyle={{ fontSize: 10 }}>{item.estimatedDuration} {t.common.min}</Chip>
              </View>
            </Card.Content>
          </Card>
        )}
        style={{ marginBottom: spacing.lg }}
      />

      {/* Recent Sessions */}
      <Text variant="titleMedium" style={styles.sectionTitle}>{t.workout.recentWorkouts}</Text>
      {sessions.length === 0 ? (
        <Card style={styles.emptyCard} mode="elevated">
          <Card.Content style={{ alignItems: 'center', padding: spacing.lg }}>
            <MaterialCommunityIcons name="dumbbell" size={48} color="#ccc" />
            <Text style={{ color: '#999', marginTop: 8 }}>{t.workout.noRecords}</Text>
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
                <Text style={{ fontWeight: '600' }}>{s.durationMinutes} {t.common.min}</Text>
                <Text style={{ color: colors.orange, fontSize: 12 }}>{s.caloriesBurned} {t.common.kcal}</Text>
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
  statsCard: { borderRadius: borderRadius.md, marginBottom: spacing.md, backgroundColor: '#FFFDE7' },
});
