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

/**
 * Medically conservative floor values. Prolonged intake below these numbers
 * is considered unsafe without clinical supervision (NHS / EFSA / NIH). The
 * calorie target is clamped to these regardless of the selected goal to avoid
 * giving users a plan that could cause harm. These floors also protect the
 * app from being characterised as promoting eating disorders.
 *
 * Sources:
 *   - NHS (UK): 1200 kcal/day minimum for women without supervision.
 *   - NIH / AHA: 1500 kcal/day minimum for men without supervision.
 */
export const CALORIE_FLOOR_FEMALE = 1200;
export const CALORIE_FLOOR_MALE = 1500;
export const CALORIE_FLOOR_GENERIC = 1200;

export function calorieFloorFor(gender?: string): number {
  if (gender === 'female') return CALORIE_FLOOR_FEMALE;
  if (gender === 'male') return CALORIE_FLOOR_MALE;
  return CALORIE_FLOOR_GENERIC;
}

export function calculateCalorieTarget(tdee: number, goal: string, gender?: string): number {
  const offsets: Record<string, number> = { lose: -500, gain: 300, muscle: 200 };
  const target = tdee + (offsets[goal] ?? 0);
  // Safety clamp to medically accepted minimums.
  const floor = calorieFloorFor(gender);
  return Math.max(floor, target);
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

/**
 * Eligibility checks used across Fasting / Calorie / Supplement screens to
 * protect vulnerable users (underweight, minors, pregnant, chronic conditions).
 * Screens should call these before allowing the user to start a session.
 */
export interface SafetyEligibility {
  allowed: boolean;
  reason?:
    | 'UNDERWEIGHT'
    | 'MINOR'
    | 'MISSING_DATA'
    | 'EXTREME_DURATION';
  message?: string;
}

export function fastingEligibility(params: {
  weightKg?: number;
  heightCm?: number;
  age?: number;
  durationHours?: number;
}): SafetyEligibility {
  const { weightKg, heightCm, age, durationHours } = params;
  if (!weightKg || !heightCm || !age) {
    return { allowed: false, reason: 'MISSING_DATA' };
  }
  if (age < 18) {
    return {
      allowed: false,
      reason: 'MINOR',
      message:
        'Intermittent fasting is not recommended for users under 18. Medical supervision is required for individuals who are still growing and developing.',
    };
  }
  const bmi = calculateBMI(weightKg, heightCm);
  if (bmi < 18.5) {
    return {
      allowed: false,
      reason: 'UNDERWEIGHT',
      message:
        'Your body mass index (BMI) is below 18.5. Intermittent fasting may not be suitable for you. Please consult a healthcare professional.',
    };
  }
  if (typeof durationHours === 'number' && durationHours > 24) {
    return {
      allowed: false,
      reason: 'EXTREME_DURATION',
      message:
        'Fasts longer than 24 hours are not recommended without medical supervision.',
    };
  }
  return { allowed: true };
}

export function supplementEligibility(age?: number): SafetyEligibility {
  if (!age) return { allowed: false, reason: 'MISSING_DATA' };
  if (age < 18) {
    return {
      allowed: false,
      reason: 'MINOR',
      message:
        'Supplement recommendations are not shown to users under 18. Please consult a doctor before using any supplement.',
    };
  }
  return { allowed: true };
}
