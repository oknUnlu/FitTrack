export interface MacroTargets {
  protein: number;
  carbs: number;
  fat: number;
}

export interface OneRepMax {
  epley: number;
  brzycki: number;
  average: number;
}

export function calculateBMR(weight: number, height: number, age: number, gender: string): number {
  return gender === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;
}

export function calculateTDEE(bmr: number, activityLevel: string): number {
  const multipliers: Record<string, number> = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryActive: 1.9,
  };
  return Math.round(bmr * (multipliers[activityLevel] ?? 1.2));
}

export function calculateCalorieTarget(tdee: number, goal: string): number {
  const offsets: Record<string, number> = { lose: -500, gain: 300, muscle: 200 };
  return tdee + (offsets[goal] ?? 0);
}

export function calculateMacroTargets(calorieTarget: number, goal: string): MacroTargets {
  const ratios: Record<string, [number, number, number]> = {
    lose: [0.35, 0.35, 0.30],
    gain: [0.30, 0.45, 0.25],
    muscle: [0.35, 0.45, 0.20],
    maintain: [0.30, 0.40, 0.30],
  };
  const [p, c, f] = ratios[goal] ?? ratios.maintain;
  return {
    protein: Math.round((calorieTarget * p) / 4),
    carbs: Math.round((calorieTarget * c) / 4),
    fat: Math.round((calorieTarget * f) / 9),
  };
}

export function calculateCaloriesBurned(metValue: number, weightKg: number, durationMin: number): number {
  return Math.round((metValue * 3.5 * weightKg / 200) * durationMin);
}

export function calculate1RM(weightKg: number, reps: number): OneRepMax {
  const epley = weightKg * (1 + reps / 30);
  const brzycki = weightKg / (1.0278 - 0.0278 * reps);
  return { epley, brzycki, average: (epley + brzycki) / 2 };
}

export function calculateWaterNeeds(weightKg: number, activityLevel: string): number {
  const base = Math.round(weightKg * 35);
  const extra = ['active', 'veryActive'].includes(activityLevel) ? 500 : 0;
  return base + extra;
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function calculateWaistHipRatio(waistCm: number, hipCm: number): number {
  return hipCm <= 0 ? 0 : waistCm / hipCm;
}

export function calculateIdealWeightHamwi(heightCm: number, gender: string): number {
  const over60 = Math.max((heightCm / 2.54) - 60, 0);
  return gender === 'male' ? 48 + 2.7 * over60 : 45.5 + 2.2 * over60;
}

export function calculateIdealWeightDevine(heightCm: number, gender: string): number {
  const over60 = Math.max((heightCm / 2.54) - 60, 0);
  return gender === 'male' ? 50 + 2.3 * over60 : 45.5 + 2.3 * over60;
}

export function calculateProteinNeeds(weightKg: number, goal: string): [number, number] {
  const ranges: Record<string, [number, number]> = {
    lose: [1.6, 2.2], muscle: [1.6, 2.2], gain: [1.4, 2.0], maintain: [0.8, 1.2],
  };
  const [minR, maxR] = ranges[goal] ?? ranges.maintain;
  return [weightKg * minR, weightKg * maxR];
}
