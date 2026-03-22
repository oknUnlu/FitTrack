export type Language = 'tr' | 'en' | 'es' | 'pt' | 'hi' | 'id' | 'ja' | 'ko';

export interface LanguageInfo {
  code: Language;
  name: string;
  nativeName: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
];

export interface Translations {
  // Common
  common: {
    cancel: string;
    save: string;
    delete: string;
    add: string;
    edit: string;
    close: string;
    yes: string;
    no: string;
    ok: string;
    error: string;
    success: string;
    loading: string;
    search: string;
    noResults: string;
    back: string;
    next: string;
    done: string;
    kcal: string;
    kg: string;
    cm: string;
    ml: string;
    min: string;
    days: string;
    day: string;
    glasses: string;
    reps: string;
    sets: string;
  };

  // Tab Navigation
  tabs: {
    home: string;
    calories: string;
    workout: string;
    progress: string;
    profile: string;
  };

  // Dashboard
  dashboard: {
    greeting: string;
    dailyCalories: string;
    remainingKcal: string;
    consumed: string;
    burned: string;
    goal: string;
    macronutrients: string;
    protein: string;
    carbs: string;
    fat: string;
    waterTracking: string;
    todayWorkout: string;
    workoutDay: string;
    burnedLabel: string;
    dayStreak: string;
    keepGoing: string;
    aiCoach: string;
    askAiCoach: string;
    addMeal: string;
    addWater: string;
  };

  // Calorie Screen
  calorie: {
    total: string;
    addFood: string;
    searchFood: string;
    searchPlaceholder: string;
    noResults: string;
    breakfast: string;
    lunch: string;
    dinner: string;
    snack: string;
  };

  // Workout Screen
  workout: {
    title: string;
    startEmpty: string;
    builtInPrograms: string;
    recentWorkouts: string;
    noRecords: string;
    finishWorkout: string;
    finishConfirm: string;
    continueWorkout: string;
    saveAndExit: string;
    cancelWorkout: string;
    cancelConfirm: string;
    yesExit: string;
    duration: string;
    set: string;
    unweighted: string;
    addExerciseHint: string;
    addExercise: string;
    finish: string;
    emptyWorkout: string;
    saveError: string;
    searchExercise: string;
    weight: string;
    reps: string;
    add: string;
  };

  // Progress Screen
  progress: {
    title: string;
    days7: string;
    days30: string;
    days90: string;
    all: string;
    totalWorkouts: string;
    burnedCalories: string;
    longestStreak: string;
    weightChange: string;
    weightTrend: string;
    weightHint: string;
    dailyCalories: string;
    calorieHint: string;
    report: string;
    avgCalories: string;
    activeDays: string;
  };

  // Profile Screen
  profile: {
    title: string;
    user: string;
    age: string;
    dailyGoals: string;
    water: string;
    appearance: string;
    darkTheme: string;
    language: string;
    selectLanguage: string;
    notifications: string;
    mealReminder: string;
    on: string;
    off: string;
    waterReminder: string;
    workoutReminder: string;
    aiCoachSection: string;
    geminiApiKey: string;
    configured: string;
    notConfigured: string;
    apiKeyInstruction: string;
    apiKeySaved: string;
    apiKeySaveError: string;
    deleteApiKey: string;
    deleteApiKeyConfirm: string;
    version: string;
    loseWeight: string;
    gainWeight: string;
    buildMuscle: string;
    maintainWeight: string;
    sedentary: string;
    lightlyActive: string;
    moderatelyActive: string;
    active: string;
    veryActive: string;
  };

  // AI Coach
  aiCoach: {
    title: string;
    quickQuestions: string;
    requestsUsed: string;
    typing: string;
    placeholder: string;
    errorMessage: string;
    prompt1: string;
    prompt2: string;
    prompt3: string;
    prompt4: string;
    prompt5: string;
    system: string;
  };

  // Tools
  tools: {
    title: string;
    tdee: string;
    oneRm: string;
    bmi: string;
    water: string;
    tdeeCalc: string;
    oneRmCalc: string;
    bmiCalc: string;
    waterNeeds: string;
    idealWeight: string;
    weight: string;
    height: string;
    age: string;
    male: string;
    female: string;
    sedentary: string;
    light: string;
    moderate: string;
    activeLevel: string;
    repCount: string;
    average: string;
    underweight: string;
    normal: string;
    overweight: string;
    obese: string;
    glassesPerDay: string;
  };

  // Body Metrics
  bodyMetrics: {
    title: string;
    latest: string;
    waist: string;
    hip: string;
    chest: string;
    bicep: string;
    thigh: string;
    photoCompare: string;
    history: string;
    noData: string;
    addMeasurement: string;
    takePhoto: string;
    pickPhoto: string;
    trackProgress: string;
  };

  // Achievements
  achievements: {
    title: string;
    locked: string;
    unlocked: string;
    progress: string;
    firstMeal: string;
    firstMealDesc: string;
    firstWorkout: string;
    firstWorkoutDesc: string;
    streak7: string;
    streak7Desc: string;
    streak30: string;
    streak30Desc: string;
    meals10: string;
    meals10Desc: string;
    meals50: string;
    meals50Desc: string;
    meals100: string;
    meals100Desc: string;
    workouts10: string;
    workouts10Desc: string;
    workouts50: string;
    workouts50Desc: string;
    water7: string;
    water7Desc: string;
    calorieGoal: string;
    calorieGoalDesc: string;
    proteinGoal: string;
    proteinGoalDesc: string;
  };

  // Barcode Scanner
  barcode: {
    scanTitle: string;
    cameraPermission: string;
    grantPermission: string;
    hint: string;
    scanAgain: string;
    searching: string;
    notFound: string;
    found: string;
    scanBarcode: string;
  };

  // Onboarding
  onboarding: {
    welcome: string;
    welcomeSubtitle: string;
    letsStart: string;
    stepPersonal: string;
    stepBody: string;
    stepActivity: string;
    stepGoal: string;
    stepResult: string;
    yourName: string;
    namePlaceholder: string;
    yourAge: string;
    agePlaceholder: string;
    gender: string;
    male: string;
    female: string;
    yourHeight: string;
    heightPlaceholder: string;
    yourWeight: string;
    weightPlaceholder: string;
    activityLevel: string;
    sedentary: string;
    sedentaryDesc: string;
    light: string;
    lightDesc: string;
    moderate: string;
    moderateDesc: string;
    active: string;
    activeDesc: string;
    veryActive: string;
    veryActiveDesc: string;
    yourGoal: string;
    lose: string;
    loseDesc: string;
    maintain: string;
    maintainDesc: string;
    gain: string;
    gainDesc: string;
    muscle: string;
    muscleDesc: string;
    yourPlan: string;
    yourPlanSubtitle: string;
    dailyCalories: string;
    protein: string;
    carbs: string;
    fat: string;
    water: string;
    startApp: string;
    fillAllFields: string;
    back: string;
    next: string;
  };

  // Days of week (abbreviated)
  daysShort: {
    mon: string;
    tue: string;
    wed: string;
    thu: string;
    fri: string;
    sat: string;
    sun: string;
  };
}
