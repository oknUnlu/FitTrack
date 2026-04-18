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
    retry: string;
    errorOccurred: string;
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
    waterGlass: string;
    waterCup: string;
    waterBottle: string;
    waterLargeBottle: string;
    waterCustom: string;
    waterRemaining: string;
    waterCompleted: string;
    waterUndoLast: string;
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
    aiRecognition: string;
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
    totalSets: string;
    totalVolume: string;
    restTimer: string;
    restTimerDone: string;
    skipRest: string;
    addSet: string;
    personalRecord: string;
    thisWeek: string;
    weekWorkouts: string;
    weekTime: string;
    weekCalories: string;
    startTemplate: string;
    sessionDetail: string;
    workoutComplete: string;
    exercisesCount: string;
    setsCount: string;
    prsAchieved: string;
    allPrograms: string;
    equipmentPrograms: string;
    bodyweightPrograms: string;
    cardioPrograms: string;
    beginner: string;
    intermediate: string;
    advanced: string;
    programDays: string;
    exercises: string;
    startProgram: string;
    selectDay: string;
    popularPrograms: string;
    quickStart: string;
    freeWorkout: string;
    freeWorkoutDesc: string;
    chest: string;
    back: string;
    legs: string;
    shoulders: string;
    biceps: string;
    triceps: string;
    core: string;
    glutes: string;
    hamstrings: string;
    quadriceps: string;
    calves: string;
    cardio: string;
    traps: string;
    forearms: string;
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
    resetAccount: string;
    resetAccountDesc: string;
    resetAccountConfirm: string;
    // KVKK / GDPR rights (optional — EN/TR provided, fallback otherwise)
    privacySection?: string;
    exportData?: string;
    exportDataDesc?: string;
    exportDataSuccess?: string;
    exportDataError?: string;
    deleteAccount?: string;
    deleteAccountDesc?: string;
    deleteAccountConfirmTitle?: string;
    deleteAccountConfirmBody?: string;
    deleteAccountConfirmYes?: string;
    deleteAccountSuccess?: string;
    deleteAccountError?: string;
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
    workoutPlan: string;
    nutritionPlan: string;
    weeklyPlan: string;
    // Medical disclaimer shown above chat (optional)
    disclaimer?: string;
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
    filterAll: string;
    filterWorkout: string;
    filterMeal: string;
    filterStreak: string;
    filterWater: string;
    filterNutrition: string;
    firstMeal: string;
    firstMealDesc: string;
    firstWorkout: string;
    firstWorkoutDesc: string;
    streak3: string;
    streak3Desc: string;
    streak7: string;
    streak7Desc: string;
    streak14: string;
    streak14Desc: string;
    streak30: string;
    streak30Desc: string;
    streak60: string;
    streak60Desc: string;
    meals10: string;
    meals10Desc: string;
    meals25: string;
    meals25Desc: string;
    meals50: string;
    meals50Desc: string;
    meals100: string;
    meals100Desc: string;
    meals200: string;
    meals200Desc: string;
    workouts10: string;
    workouts10Desc: string;
    workouts25: string;
    workouts25Desc: string;
    workouts50: string;
    workouts50Desc: string;
    workouts100: string;
    workouts100Desc: string;
    calorieBurn1000: string;
    calorieBurn1000Desc: string;
    calorieBurn5000: string;
    calorieBurn5000Desc: string;
    water7: string;
    water7Desc: string;
    water14: string;
    water14Desc: string;
    water30: string;
    water30Desc: string;
    calorieGoal: string;
    calorieGoalDesc: string;
    calorieGoal7: string;
    calorieGoal7Desc: string;
    proteinGoal: string;
    proteinGoalDesc: string;
    proteinGoal7: string;
    proteinGoal7Desc: string;
    perfectDay: string;
    perfectDayDesc: string;
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
    manualEntryTitle: string;
    productName: string;
    caloriesPer100g: string;
    proteinPer100g: string;
    carbsPer100g: string;
    fatPer100g: string;
    submit: string;
    productAdded: string;
    communityVerified: string;
    fillAllFields: string;
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
    // Age / body validation (optional)
    ageInvalidTitle?: string;
    ageInvalidBody?: string;
    ageRestrictionTitle?: string;
    ageRestrictionBody?: string;
    bodyInvalidTitle?: string;
    bodyInvalidBody?: string;
  };

  // Wellness
  wellness: {
    title: string;
    update: string;
    save: string;
    todayStatus: string;
    sleep: string;
    mood: string;
    energy: string;
    stress: string;
    noRecordYet: string;
    addDailyRecord: string;
    meditationTimer: string;
    start: string;
    stop: string;
    todayTotal: string;
    weeklySummary: string;
    avgSleep: string;
    avgStress: string;
    avgEnergy: string;
    avgMeditation: string;
    dailyRecord: string;
    sleepDuration: string;
    sleepQuality: string;
    energyLevel: string;
    stressLevel: string;
    notes: string;
    notesPlaceholder: string;
    moodGreat: string;
    moodGood: string;
    moodNeutral: string;
    moodBad: string;
    moodTerrible: string;
    sleepVeryBad: string;
    sleepBad: string;
    sleepNormal: string;
    sleepGood: string;
    sleepExcellent: string;
    pause: string;
    resume: string;
    presets: string;
    freeTimer: string;
    meditationComplete: string;
    meditationCompleteMsg: string;
    recentSessions: string;
    noSessions: string;
  };

  // Health Hub
  healthHub: {
    title: string;
    export: string;
    exportSuccess: string;
    exportFailed: string;
    shareTitle: string;
    deviceConnection: string;
    manualInput: string;
    active: string;
    todayData: string;
    weeklyAverages: string;
    steps: string;
    stepsUnit: string;
    heartRate: string;
    sleepLabel: string;
    sleepUnit: string;
    activeCalories: string;
    info: string;
    infoText: string;
    infoTextConnected: string;
    infoTextAvailable: string;
    addValue: string;
    valueLabel: string;
    connect: string;
    connected: string;
    disconnect: string;
    disconnectConfirm: string;
    lastSync: string;
    tapToConnect: string;
    manual: string;
    permissionDenied: string;
    connectionFailed: string;
    syncNow: string;
    syncing: string;
  };

  // Supplements
  supplements: {
    title: string;
    today: string;
    noSupplements: string;
    addSupplement: string;
    supplementName: string;
    dosage: string;
    intakeTime: string;
    morning: string;
    afternoon: string;
    evening: string;
    preWorkout: string;
    postWorkout: string;
    // Medical / age guardrails (optional)
    disclaimer?: string;
    blockedMinorTitle?: string;
    blockedMinorBody?: string;
  };

  // Social / Challenges
  social: {
    title: string;
    new: string;
    activeLabel: string;
    completed: string;
    total: string;
    noActive: string;
    noCompleted: string;
    startChallenge: string;
    deleteTitle: string;
    deleteConfirm: string;
    selectChallenge: string;
    updateProgress: string;
    currentValue: string;
    share: string;
    update: string;
  };

  // Dashboard extras
  dashboardExtras: {
    supplements: string;
    supplementsDesc: string;
    wellness: string;
    wellnessDesc: string;
    healthHub: string;
    healthHubDesc: string;
    challenges: string;
    challengesDesc: string;
    suggestion: string;
  };

  // Screen titles (navigation)
  screenTitles: {
    bodyMetrics: string;
    supplements: string;
    wellness: string;
    healthHub: string;
    challenges: string;
  };

  // Fasting Tracker
  fasting: {
    title: string;
    subtitle: string;
    enableDesc: string;
    completed: string;
    remaining: string;
    complete: string;
    notStarted: string;
    start: string;
    dayStreak: string;
    keepGoing: string;
    settings: string;
    sahur: string;
    iftar: string;
    // Medical / age guardrails (optional)
    disclaimer?: string;
    blockedTitle?: string;
    blockedBody?: string;
    blockedUnderweight?: string;
    blockedMinor?: string;
    blockedDuration?: string;
  };

  // Referral
  referral: {
    title: string;
    desc: string;
    invited: string;
    share: string;
  };

  // Premium
  premium: {
    title: string;
    subtitle: string;
    featureLockedMsg: string;
    popular: string;
    yearly: string;
    quarterly: string;
    monthly: string;
    lifetime: string;
    year: string;
    threeMonths: string;
    month: string;
    savePercent: string;
    savePercentQuarterly: string;
    restore: string;
    restoreSuccess: string;
    restoreNotFound: string;
    restoreFailed: string;
    purchaseFailed: string;
    processing: string;
    aiCoachUnlimited: string;
    foodRecognitionUnlimited: string;
    barcodeUnlimited: string;
    progressFull: string;
    dataExport: string;
    advancedPrograms: string;
    wellnessDetail: string;
    healthHubFull: string;
    adFree: string;
    limitReached: string;
    dailyLimitMsg: string;
    dailyLimitFoodMsg: string;
    upgradeNow: string;
    freeLimit: string;
    premiumBadge: string;
    currentPlan: string;
    expiresAt: string;
    managePlan: string;
    promoCode: string;
    enterPromoCode: string;
    promoPlaceholder: string;
    promoActivated: string;
    promoInvalid: string;
    promoExpired: string;
    promoError: string;
    activate: string;
    // Consumer compliance (TKHK 6502 / MSY) — optional, EN/TR supplied
    preContractualTitle?: string;
    preContractualBody?: string;
    withdrawalTitle?: string;
    withdrawalBody?: string;
    consumerRightAck?: string;
    consumerRightAckRequired?: string;
    consumerRightTitle?: string;
    viewTerms?: string;
    viewPrivacy?: string;
    manageSubscription?: string;
  };

  // Privacy Policy
  terms: {
    title: string;
    lastUpdated: string;
    introTitle: string;
    introDesc: string;
    partiesTitle: string;
    partiesDesc: string;
    serviceTitle: string;
    serviceDesc: string;
    userObligationsTitle: string;
    userObligationsDesc: string;
    premiumTitle: string;
    premiumDesc: string;
    cancellationTitle: string;
    cancellationDesc: string;
    ipTitle: string;
    ipDesc: string;
    liabilityTitle: string;
    liabilityDesc: string;
    healthDisclaimerTitle: string;
    healthDisclaimerDesc: string;
    changesTitle: string;
    changesDesc: string;
    governingLawTitle: string;
    governingLawDesc: string;
    contactTitle: string;
    contactDesc: string;
  };

  kvkk: {
    title: string;
    lastUpdated: string;
    introTitle: string;
    introDesc: string;
    controllerTitle: string;
    controllerDesc: string;
    dataTypesTitle: string;
    dataTypesDesc: string;
    purposesTitle: string;
    purposesDesc: string;
    legalBasisTitle: string;
    legalBasisDesc: string;
    transferTitle: string;
    transferDesc: string;
    retentionTitle: string;
    retentionDesc: string;
    rightsTitle: string;
    rightsDesc: string;
    contactTitle: string;
    contactDesc: string;
  };

  privacy: {
    title: string;
    lastUpdated: string;
    dataCollection: string;
    dataCollectionDesc: string;
    personalData: string;
    personalDataDesc: string;
    healthData: string;
    healthDataDesc: string;
    nutritionData: string;
    nutritionDataDesc: string;
    fitnessData: string;
    fitnessDataDesc: string;
    photoData: string;
    photoDataDesc: string;
    aiDataTitle: string;
    aiDataDesc: string;
    aiTrainingWarning: string;
    thirdPartyTitle: string;
    geminiDesc: string;
    openFoodFactsDesc: string;
    healthKitDesc: string;
    localStorage: string;
    localStorageDesc: string;
    dataSecurity: string;
    dataSecurityDesc: string;
    userRights: string;
    userRightsDesc: string;
    dataRetention: string;
    dataRetentionDesc: string;
    contact: string;
    contactDesc: string;
    consentTitle: string;
    consentDesc: string;
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

  // Consent / medical disclaimer / KVKK-GDPR surfaces (optional)
  legal?: {
    consent?: {
      title?: string;
      intro?: string;
      ageQuestion?: string;
      ageUnit?: string;
      ageUnderMin?: string;
      requiredSection?: string;
      optionalSection?: string;
      privacyPolicy?: string;
      privacyPolicyDesc?: string;
      termsOfService?: string;
      termsOfServiceDesc?: string;
      kvkk?: string;
      kvkkDesc?: string;
      medicalDisclaimer?: string;
      medicalDisclaimerDesc?: string;
      aiDataSharing?: string;
      aiDataSharingDesc?: string;
      healthData?: string;
      healthDataDesc?: string;
      analytics?: string;
      analyticsDesc?: string;
      crashReports?: string;
      crashReportsDesc?: string;
      marketing?: string;
      marketingDesc?: string;
      personalizedAds?: string;
      personalizedAdsDesc?: string;
      accept?: string;
      decline?: string;
      mustAcceptRequired?: string;
      viewDocument?: string;
    };
    medicalDisclaimer?: {
      title?: string;
      body?: string;
      emergency?: string;
      call112?: string;
    };
    ageRestriction?: {
      title?: string;
      body?: string;
    };
  };
}
