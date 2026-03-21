import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, TextInput, Button, SegmentedButtons, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../theme/theme';
import {
  calculateBMR, calculateTDEE, calculateCalorieTarget, calculateMacroTargets,
  calculate1RM, calculateBMI, calculateWaterNeeds, calculateIdealWeightHamwi, calculateIdealWeightDevine,
} from '../../utils/calculations';
import { useLanguage } from '../../i18n';

export function ToolsScreen() {
  const theme = useTheme();
  const { t } = useLanguage();
  const [activeTool, setActiveTool] = useState('tdee');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>
        {[
          { key: 'tdee', label: t.tools.tdee, icon: 'fire' },
          { key: '1rm', label: t.tools.oneRm, icon: 'weight-lifter' },
          { key: 'bmi', label: t.tools.bmi, icon: 'scale-bathroom' },
          { key: 'water', label: t.tools.water, icon: 'water' },
          { key: 'ideal', label: t.tools.idealWeight, icon: 'human' },
        ].map((tool) => (
          <Button
            key={tool.key}
            mode={activeTool === tool.key ? 'contained' : 'outlined'}
            onPress={() => setActiveTool(tool.key)}
            compact
            icon={tool.icon}
          >
            {tool.label}
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
  const { t } = useLanguage();
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
        <Text variant="titleMedium" style={styles.cardTitle}>{t.tools.tdeeCalc}</Text>
        <TextInput label={t.tools.weight} value={weight} onChangeText={setWeight} keyboardType="numeric" mode="outlined" style={styles.input} />
        <TextInput label={t.tools.height} value={height} onChangeText={setHeight} keyboardType="numeric" mode="outlined" style={styles.input} />
        <TextInput label={t.tools.age} value={age} onChangeText={setAge} keyboardType="numeric" mode="outlined" style={styles.input} />

        <SegmentedButtons value={gender} onValueChange={setGender}
          buttons={[{ value: 'male', label: t.tools.male }, { value: 'female', label: t.tools.female }]}
          style={styles.input} />

        <SegmentedButtons value={activity} onValueChange={setActivity}
          buttons={[
            { value: 'sedentary', label: t.tools.sedentary }, { value: 'light', label: t.tools.light },
            { value: 'moderate', label: t.tools.moderate }, { value: 'active', label: t.tools.activeLevel },
          ]}
          style={styles.input} />

        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>BMR</Text>
          <Text style={styles.resultValue}>{Math.round(bmr)} {t.common.kcal}</Text>
          <Text style={[styles.resultLabel, { marginTop: 8 }]}>TDEE</Text>
          <Text style={[styles.resultValue, { color: colors.primary }]}>{tdee} {t.common.kcal}</Text>
        </View>
      </Card.Content>
    </Card>
  );
}

function OneRMCalculator() {
  const { t } = useLanguage();
  const [weight, setWeight] = useState('100');
  const [reps, setReps] = useState('5');
  const result = calculate1RM(+weight, +reps);

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitle}>{t.tools.oneRmCalc}</Text>
        <TextInput label={t.tools.weight} value={weight} onChangeText={setWeight} keyboardType="numeric" mode="outlined" style={styles.input} />
        <TextInput label={t.tools.repCount} value={reps} onChangeText={setReps} keyboardType="numeric" mode="outlined" style={styles.input} />
        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>Epley: {result.epley.toFixed(1)} {t.common.kg}</Text>
          <Text style={styles.resultLabel}>Brzycki: {result.brzycki.toFixed(1)} {t.common.kg}</Text>
          <Text style={[styles.resultValue, { color: colors.primary, marginTop: 4 }]}>
            {t.tools.average}: {result.average.toFixed(1)} {t.common.kg}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

function BMICalculator() {
  const { t } = useLanguage();
  const [weight, setWeight] = useState('80');
  const [height, setHeight] = useState('180');
  const bmi = calculateBMI(+weight, +height);
  const category = bmi < 18.5 ? t.tools.underweight : bmi < 25 ? t.tools.normal : bmi < 30 ? t.tools.overweight : t.tools.obese;

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitle}>{t.tools.bmiCalc}</Text>
        <TextInput label={t.tools.weight} value={weight} onChangeText={setWeight} keyboardType="numeric" mode="outlined" style={styles.input} />
        <TextInput label={t.tools.height} value={height} onChangeText={setHeight} keyboardType="numeric" mode="outlined" style={styles.input} />
        <View style={styles.resultBox}>
          <Text style={[styles.resultValue, { color: colors.primary }]}>{bmi.toFixed(1)}</Text>
          <Text style={styles.resultLabel}>{category}</Text>
        </View>
      </Card.Content>
    </Card>
  );
}

function WaterCalculator() {
  const { t } = useLanguage();
  const [weight, setWeight] = useState('70');
  const [activity, setActivity] = useState('moderate');
  const water = calculateWaterNeeds(+weight, activity);

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitle}>{t.tools.waterNeeds}</Text>
        <TextInput label={t.tools.weight} value={weight} onChangeText={setWeight} keyboardType="numeric" mode="outlined" style={styles.input} />
        <SegmentedButtons value={activity} onValueChange={setActivity}
          buttons={[{ value: 'sedentary', label: t.tools.sedentary }, { value: 'active', label: t.tools.activeLevel }]}
          style={styles.input} />
        <View style={styles.resultBox}>
          <Text style={[styles.resultValue, { color: colors.water }]}>{water} {t.common.ml}</Text>
          <Text style={styles.resultLabel}>{t.tools.glassesPerDay}</Text>
        </View>
      </Card.Content>
    </Card>
  );
}

function IdealWeightCalculator() {
  const { t } = useLanguage();
  const [height, setHeight] = useState('175');
  const [gender, setGender] = useState('male');
  const hamwi = calculateIdealWeightHamwi(+height, gender);
  const devine = calculateIdealWeightDevine(+height, gender);

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitle}>{t.tools.idealWeight}</Text>
        <TextInput label={t.tools.height} value={height} onChangeText={setHeight} keyboardType="numeric" mode="outlined" style={styles.input} />
        <SegmentedButtons value={gender} onValueChange={setGender}
          buttons={[{ value: 'male', label: t.tools.male }, { value: 'female', label: t.tools.female }]}
          style={styles.input} />
        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>Hamwi: {hamwi.toFixed(1)} {t.common.kg}</Text>
          <Text style={styles.resultLabel}>Devine: {devine.toFixed(1)} {t.common.kg}</Text>
          <Text style={[styles.resultValue, { color: colors.primary, marginTop: 4 }]}>
            {t.tools.average}: {((hamwi + devine) / 2).toFixed(1)} {t.common.kg}
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
