import { create } from 'zustand';
import { MealLog } from '../services/database/mealDao';

interface MealState {
  meals: MealLog[];
  addMeal: (meal: MealLog) => void;
  removeMeal: (id: string) => void;
  setMeals: (meals: MealLog[]) => void;
}

export const useMealStore = create<MealState>((set) => ({
  meals: [],
  addMeal: (meal) => set((state) => ({ meals: [...state.meals, meal] })),
  removeMeal: (id) => set((state) => ({ meals: state.meals.filter((m) => m.id !== id) })),
  setMeals: (meals) => set({ meals }),
}));
