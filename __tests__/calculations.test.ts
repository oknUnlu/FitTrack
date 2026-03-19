import {
  calculateBMR, calculateTDEE, calculateCalorieTarget, calculateMacroTargets,
  calculateCaloriesBurned, calculate1RM, calculateWaterNeeds, calculateBMI,
  calculateWaistHipRatio, calculateProteinNeeds,
} from '../src/utils/calculations';

describe('CalculationUtils', () => {
  test('BMR male', () => {
    expect(calculateBMR(80, 180, 25, 'male')).toBeCloseTo(1805, 0);
  });

  test('BMR female', () => {
    expect(calculateBMR(60, 165, 30, 'female')).toBeCloseTo(1320.25, 0);
  });

  test('TDEE sedentary', () => {
    expect(calculateTDEE(1805, 'sedentary')).toBe(2166);
  });

  test('TDEE moderate', () => {
    expect(calculateTDEE(1805, 'moderate')).toBe(2798);
  });

  test('TDEE active', () => {
    expect(calculateTDEE(1805, 'active')).toBe(3114);
  });

  test('calorie target lose', () => {
    expect(calculateCalorieTarget(2200, 'lose')).toBe(1700);
  });

  test('calorie target gain', () => {
    expect(calculateCalorieTarget(2200, 'gain')).toBe(2500);
  });

  test('calorie target muscle', () => {
    expect(calculateCalorieTarget(2200, 'muscle')).toBe(2400);
  });

  test('calorie target maintain', () => {
    expect(calculateCalorieTarget(2200, 'maintain')).toBe(2200);
  });

  test('macro targets lose', () => {
    const m = calculateMacroTargets(2000, 'lose');
    expect(m.protein).toBe(175);
    expect(m.carbs).toBe(175);
    expect(m.fat).toBe(67);
  });

  test('calories burned', () => {
    expect(calculateCaloriesBurned(5.0, 80, 30)).toBe(210);
  });

  test('1RM calculation', () => {
    const r = calculate1RM(100, 5);
    expect(r.epley).toBeCloseTo(116.67, 1);
    expect(r.brzycki).toBeCloseTo(112.51, 1);
  });

  test('water needs sedentary', () => {
    expect(calculateWaterNeeds(70, 'sedentary')).toBe(2450);
  });

  test('water needs active', () => {
    expect(calculateWaterNeeds(70, 'active')).toBe(2950);
  });

  test('BMI calculation', () => {
    expect(calculateBMI(80, 180)).toBeCloseTo(24.69, 1);
  });

  test('waist hip ratio', () => {
    expect(calculateWaistHipRatio(85, 100)).toBeCloseTo(0.85, 2);
  });

  test('waist hip ratio zero', () => {
    expect(calculateWaistHipRatio(85, 0)).toBe(0);
  });

  test('protein needs muscle', () => {
    const [min, max] = calculateProteinNeeds(80, 'muscle');
    expect(min).toBeCloseTo(128, 0);
    expect(max).toBeCloseTo(176, 0);
  });
});
