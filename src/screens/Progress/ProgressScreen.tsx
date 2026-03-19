import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, SegmentedButtons, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../theme/theme';

export function ProgressScreen() {
  const theme = useTheme();
  const [period, setPeriod] = React.useState('7');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md }}
    >
      <Text variant="headlineSmall" style={styles.title}>İlerleme & Analiz</Text>

      <SegmentedButtons
        value={period}
        onValueChange={setPeriod}
        buttons={[
          { value: '7', label: '7 Gün' },
          { value: '30', label: '30 Gün' },
          { value: '90', label: '90 Gün' },
          { value: 'all', label: 'Tümü' },
        ]}
        style={{ marginBottom: spacing.md }}
      />

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard icon="dumbbell" label="Toplam Antrenman" value="0" color={colors.primary} />
        <StatCard icon="fire" label="Yakılan Kalori" value="0" color={colors.orange} />
        <StatCard icon="trending-up" label="En Uzun Seri" value="0 gün" color={colors.secondary} />
        <StatCard icon="scale-bathroom" label="Kilo Değişimi" value="0 kg" color={colors.purple} />
      </View>

      {/* Placeholder for Charts */}
      <Card style={styles.chartCard} mode="elevated">
        <Card.Content style={{ alignItems: 'center', padding: spacing.xl }}>
          <MaterialCommunityIcons name="chart-line" size={64} color="#ccc" />
          <Text style={{ color: '#999', marginTop: spacing.sm }}>Kilo trendi grafiği burada görünecek</Text>
        </Card.Content>
      </Card>

      <Card style={styles.chartCard} mode="elevated">
        <Card.Content style={{ alignItems: 'center', padding: spacing.xl }}>
          <MaterialCommunityIcons name="chart-bar" size={64} color="#ccc" />
          <Text style={{ color: '#999', marginTop: spacing.sm }}>Kalori trendi grafiği burada görünecek</Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <Card style={styles.statCard} mode="elevated">
      <Card.Content style={{ alignItems: 'center' }}>
        <MaterialCommunityIcons name={icon as any} size={28} color={color} />
        <Text style={{ fontWeight: 'bold', fontSize: 18, marginTop: 4 }}>{value}</Text>
        <Text style={{ color: '#999', fontSize: 11, textAlign: 'center' }}>{label}</Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontWeight: 'bold', marginBottom: spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { width: '48%' as any, borderRadius: borderRadius.md },
  chartCard: { borderRadius: borderRadius.lg, marginBottom: spacing.md },
});
