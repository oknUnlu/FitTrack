import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, TextInput, Button, SegmentedButtons, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../theme/theme';
import {
  calculateBMR, calculateTDEE, calculateCalorieTarget, calculateMacroTargets,
  calculate1RM, calculateBMI, calculateWaterNeeds, calculateIdealWeightHamwi, calculateIdealWeightDevine,
} from '../../utils/calculations';

export function ToolsScreen() {
  const theme = useTheme();
  const [activeTool, setActiveTool] = useState('tdee');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>
        {[
          { key: 'tdee', label: 'TDEE', icon: 'fire' },
          { key: '1rm', label: '1RM', icon: 'weight-lifter' },
          { key: 'bmi', label: 'BMI', icon: 'scale-bathroom' },
          { key: 'water', label: 'Su', icon: 'water' },
          { key: 'ideal', label: 'İdeal Kilo', icon: 'human' },
        ].map((t) => (
          <Button
            key={t.key}
            mode={activeTool === t.key ? 'contained' : 'outlined'}
            onPress={() => setActiveTool(t.key)}
            compact
            icon={t.icon}
          >
            {t.label}
          </Button>
        ))}
      </View>

      {activeTool === 'tdee' && <TDEECalculator />}
      {activeTool === '1rm' && <OneRMCalculator />}
      {activeTool === 'bmi' && <BMICalculator />}
      {activeTool === 'water' && <WaterCalculator />}
      {activeTool === 'ideal' && <IdealWeightCalculator />}
    </ScrollView>
  );
}

function TDEECalculator() {
  const [weight, setWeight] = useState('80');
  const [height, setHeight] = useState('180');
  const [age, setAge] = useState('25');
  const [gender, setGender] = useState('male');
  const [activity, setActivity] = useState('moderate');

  const bmr = calculateBMR(+weight, +height, +age, gender);
  const tdee = calculateTDEE(bmr, activity);

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitle}>TDEE Hesaplayıcı</Text>
        <TextInput label="Kilo (kg)" value={weight} onChangeText={setWeight} keyboardType="numeric" mode="outlined" style={styles.input} />
        <TextInput label="Boy (cm)" value={height} onChangeText={setHeight} keyboardType="numeric" mode="outlined" style={styles.input} />
        <TextInput label="Yaş" value={age} onChangeText={setAge} keyboardType="numeric" mode="outlined" style={styles.input} />

        <SegmentedButtons value={gender} onValueChange={setGender}
          buttons={[{ value: 'male', label: 'Erkek' }, { value: 'female', label: 'Kadın' }]}
          style={styles.input} />

        <SegmentedButtons value={activity} onValueChange={setActivity}
          buttons={[
            { value: 'sedentary', label: 'Hareketsiz' }, { value: 'light', label: 'Hafif' },
            { value: 'moderate', label: 'Orta' }, { value: 'active', label: 'Aktif' },
          ]}
          style={styles.input} />

        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>BMR</Text>
          <Text style={styles.resultValue}>{Math.round(bmr)} kcal</Text>
          <Text style={[styles.resultLabel, { marginTop: 8 }]}>TDEE</Text>
          <Text style={[styles.resultValue, { color: colors.primary }]}>{tdee} kcal</Text>
        </View>
      </Card.Content>
    </Card>
  );
}

function OneRMCalculator() {
  const [weight, setWeight] = useState('100');
  const [reps, setReps] = useState('5');
  const result = calculate1RM(+weight, +reps);

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitle}>1RM Hesaplayıcı</Text>
        <TextInput label="Ağırlık (kg)" value={weight} onChangeText={setWeight} keyboardType="numeric" mode="outlined" style={styles.input} />
        <TextInput label="Tekrar Sayısı" value={reps} onChangeText={setReps} keyboardType="numeric" mode="outlined" style={styles.input} />
        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>Epley: {result.epley.toFixed(1)} kg</Text>
          <Text style={styles.resultLabel}>Brzycki: {result.brzycki.toFixed(1)} kg</Text>
          <Text style={[styles.resultValue, { color: colors.primary, marginTop: 4 }]}>
            Ortalama: {result.average.toFixed(1)} kg
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

function BMICalculator() {
  const [weight, setWeight] = useState('80');
  const [height, setHeight] = useState('180');
  const bmi = calculateBMI(+weight, +height);
  const category = bmi < 18.5 ? 'Zayıf' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Fazla Kilolu' : 'Obez';

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitle}>BMI Hesaplayıcı</Text>
        <TextInput label="Kilo (kg)" value={weight} onChangeText={setWeight} keyboardType="numeric" mode="outlined" style={styles.input} />
        <TextInput label="Boy (cm)" value={height} onChangeText={setHeight} keyboardType="numeric" mode="outlined" style={styles.input} />
        <View style={styles.resultBox}>
          <Text style={[styles.resultValue, { color: colors.primary }]}>{bmi.toFixed(1)}</Text>
          <Text style={styles.resultLabel}>{category}</Text>
        </View>
      </Card.Content>
    </Card>
  );
}

function WaterCalculator() {
  const [weight, setWeight] = useState('70');
  const [activity, setActivity] = useState('moderate');
  const water = calculateWaterNeeds(+weight, activity);

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitle}>Su İhtiyacı</Text>
        <TextInput label="Kilo (kg)" value={weight} onChangeText={setWeight} keyboardType="numeric" mode="outlined" style={styles.input} />
        <SegmentedButtons value={activity} onValueChange={setActivity}
          buttons={[{ value: 'sedentary', label: 'Hareketsiz' }, { value: 'active', label: 'Aktif' }]}
          style={styles.input} />
        <View style={styles.resultBox}>
          <Text style={[styles.resultValue, { color: colors.water }]}>{water} ml</Text>
          <Text style={styles.resultLabel}>{Math.round(water / 250)} bardak / gün</Text>
        </View>
      </Card.Content>
    </Card>
  );
}

function IdealWeightCalculator() {
  const [height, setHeight] = useState('175');
  const [gender, setGender] = useState('male');
  const hamwi = calculateIdealWeightHamwi(+height, gender);
  const devine = calculateIdealWeightDevine(+height, gender);

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitle}>İdeal Kilo</Text>
        <TextInput label="Boy (cm)" value={height} onChangeText={setHeight} keyboardType="numeric" mode="outlined" style={styles.input} />
        <SegmentedButtons value={gender} onValueChange={setGender}
          buttons={[{ value: 'male', label: 'Erkek' }, { value: 'female', label: 'Kadın' }]}
          style={styles.input} />
        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>Hamwi: {hamwi.toFixed(1)} kg</Text>
          <Text style={styles.resultLabel}>Devine: {devine.toFixed(1)} kg</Text>
          <Text style={[styles.resultValue, { color: colors.primary, marginTop: 4 }]}>
            Ortalama: {((hamwi + devine) / 2).toFixed(1)} kg
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { borderRadius: borderRadius.lg, marginBottom: spacing.md },
  cardTitle: { fontWeight: 'bold', marginBottom: spacing.sm },
  input: { marginBottom: spacing.sm },
  resultBox: { backgroundColor: '#f5f5f5', borderRadius: borderRadius.md, padding: spacing.md, marginTop: spacing.sm, alignItems: 'center' },
  resultLabel: { fontSize: 14, color: '#666' },
  resultValue: { fontSize: 28, fontWeight: 'bold' },
});
