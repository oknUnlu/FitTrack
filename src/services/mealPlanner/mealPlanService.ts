export interface MealSuggestion {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

const MEAL_DATABASE: MealSuggestion[] = [
  // Breakfast
  { name: 'Yulaf ezmesi + muz + bal', calories: 350, protein: 12, carbs: 55, fat: 8, mealType: 'breakfast' },
  { name: 'Yumurta (2 adet) + tam buğday ekmek', calories: 320, protein: 22, carbs: 28, fat: 14, mealType: 'breakfast' },
  { name: 'Protein smoothie (süt + muz + PB)', calories: 400, protein: 30, carbs: 45, fat: 12, mealType: 'breakfast' },
  { name: 'Peynirli omlet + salata', calories: 280, protein: 24, carbs: 8, fat: 18, mealType: 'breakfast' },
  { name: 'Granola + yoğurt + meyve', calories: 380, protein: 15, carbs: 50, fat: 14, mealType: 'breakfast' },
  { name: 'Avokadolu tost + yumurta', calories: 420, protein: 18, carbs: 35, fat: 24, mealType: 'breakfast' },

  // Lunch
  { name: 'Izgara tavuk göğsü + pilav + salata', calories: 550, protein: 42, carbs: 55, fat: 12, mealType: 'lunch' },
  { name: 'Mercimek çorbası + ekmek', calories: 380, protein: 18, carbs: 52, fat: 8, mealType: 'lunch' },
  { name: 'Ton balıklı salata', calories: 350, protein: 35, carbs: 15, fat: 16, mealType: 'lunch' },
  { name: 'Tavuklu wrap + ayran', calories: 480, protein: 32, carbs: 45, fat: 18, mealType: 'lunch' },
  { name: 'Fırında sebze + bulgur pilavı', calories: 420, protein: 14, carbs: 60, fat: 12, mealType: 'lunch' },
  { name: 'Köfte + salata + tam buğday ekmek', calories: 520, protein: 38, carbs: 35, fat: 22, mealType: 'lunch' },

  // Dinner
  { name: 'Somon ızgara + sebze', calories: 450, protein: 38, carbs: 20, fat: 24, mealType: 'dinner' },
  { name: 'Tavuk sote + bulgur', calories: 480, protein: 35, carbs: 45, fat: 14, mealType: 'dinner' },
  { name: 'Sebzeli makarna (tam buğday)', calories: 420, protein: 16, carbs: 58, fat: 12, mealType: 'dinner' },
  { name: 'Etli kuru fasulye + pilav', calories: 550, protein: 30, carbs: 60, fat: 18, mealType: 'dinner' },
  { name: 'Fırında tavuk + taze fasulye', calories: 380, protein: 40, carbs: 18, fat: 14, mealType: 'dinner' },
  { name: 'Balık buğulama + salata', calories: 350, protein: 35, carbs: 12, fat: 16, mealType: 'dinner' },

  // Snack
  { name: 'Protein bar', calories: 200, protein: 20, carbs: 22, fat: 8, mealType: 'snack' },
  { name: 'Badem (30g) + meyve', calories: 250, protein: 8, carbs: 20, fat: 15, mealType: 'snack' },
  { name: 'Yoğurt + granola', calories: 220, protein: 12, carbs: 28, fat: 8, mealType: 'snack' },
  { name: 'Peynir + ceviz', calories: 200, protein: 12, carbs: 4, fat: 16, mealType: 'snack' },
  { name: 'Muzlu protein shake', calories: 280, protein: 25, carbs: 30, fat: 6, mealType: 'snack' },
  { name: 'Havuç + humus', calories: 160, protein: 6, carbs: 18, fat: 8, mealType: 'snack' },
];

export function generateDailyMealPlan(
  targetCalories: number,
  targetProtein: number,
  targetCarbs: number,
  targetFat: number,
  goal: string
): MealSuggestion[] {
  const plan: MealSuggestion[] = [];

  // Distribution: breakfast 25%, lunch 35%, dinner 30%, snack 10%
  const distribution = {
    breakfast: 0.25,
    lunch: 0.35,
    dinner: 0.30,
    snack: 0.10,
  };

  for (const [mealType, ratio] of Object.entries(distribution)) {
    const targetCal = targetCalories * ratio;
    const typeMeals = MEAL_DATABASE.filter((m) => m.mealType === mealType);

    // Find closest match by calories
    const sorted = typeMeals.sort((a, b) => {
      const diffA = Math.abs(a.calories - targetCal);
      const diffB = Math.abs(b.calories - targetCal);
      return diffA - diffB;
    });

    // Pick from top 3 randomly for variety
    const topN = sorted.slice(0, 3);
    const selected = topN[Math.floor(Math.random() * topN.length)];
    if (selected) plan.push(selected);
  }

  return plan;
}

export function getRemainingMacroSuggestion(
  remainingCalories: number,
  remainingProtein: number,
  mealType: string
): MealSuggestion[] {
  const typeMeals = MEAL_DATABASE.filter((m) => m.mealType === mealType);

  return typeMeals
    .filter((m) => m.calories <= remainingCalories + 100) // Allow small overflow
    .sort((a, b) => {
      // Prioritize protein-rich options if protein remaining is high
      if (remainingProtein > 20) {
        return b.protein - a.protein;
      }
      return Math.abs(a.calories - remainingCalories) - Math.abs(b.calories - remainingCalories);
    })
    .slice(0, 3);
}
