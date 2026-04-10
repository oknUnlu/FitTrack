import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useUserStore } from '../../store/userStore';
import { insertUser } from '../../services/database/userDao';
import {
  calculateBMR,
  calculateTDEE,
  calculateCalorieTarget,
  calculateMacroTargets,
  calculateWaterNeeds,
} from '../../utils/calculations';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';
import { Logo } from '../../components/Logo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Gender = 'male' | 'female';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
type Goal = 'lose' | 'maintain' | 'gain' | 'muscle';

const TOTAL_STEPS = 5; // 0: welcome, 1: personal, 2: body, 3: activity, 4: goal -> then result

export function OnboardingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const setOnboarded = useUserStore((s) => s.setOnboarded);
  const userId = useUserStore((s) => s.userId);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const calculated = useMemo(() => {
    const w = parseFloat(weight) || 0;
    const h = parseFloat(height) || 0;
    const a = parseInt(age) || 0;
    const g = gender;
    const al = activityLevel;
    const go = goal;

    if (w <= 0 || h <= 0 || a <= 0 || !g || !al || !go) return null;

    try {
      const bmr = calculateBMR(w, h, a, g);
      const tdee = calculateTDEE(bmr, al);
      const calorieTarget = calculateCalorieTarget(tdee, go);
      const macros = calculateMacroTargets(calorieTarget, go);
      const waterMl = calculateWaterNeeds(w, al);

      return { tdee, calorieTarget, ...macros, waterMl };
    } catch (e) {
      if (__DEV__) console.warn('Calculation error:', e);
      return null;
    }
  }, [weight, height, age, gender, activityLevel, goal]);

  const animateTransition = (nextStep: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
  };

  const goNext = () => {
    if (step === 1 && (!name.trim() || !age.trim() || !gender)) {
      Alert.alert('', t.onboarding.fillAllFields);
      return;
    }
    if (step === 2 && (!height.trim() || !weight.trim())) {
      Alert.alert('', t.onboarding.fillAllFields);
      return;
    }
    if (step === 3 && !activityLevel) {
      Alert.alert('', t.onboarding.fillAllFields);
      return;
    }
    if (step === 4) {
      if (!goal) {
        Alert.alert('', t.onboarding.fillAllFields);
        return;
      }
      // Comprehensive validation before showing results
      const w = parseFloat(weight);
      const h = parseFloat(height);
      const a = parseInt(age);
      if (!w || !h || !a || !gender || !activityLevel || !goal) {
        Alert.alert('', t.onboarding.fillAllFields);
        return;
      }
    }
    animateTransition(step + 1);
  };

  const goBack = () => {
    if (step > 0) animateTransition(step - 1);
  };

  const handleFinish = async () => {
    if (!calculated) return;
    try {
      if (Platform.OS !== 'web') {
        await insertUser({
          id: userId,
          name: name.trim(),
          email: '',
          height: parseFloat(height),
          weight: parseFloat(weight),
          age: parseInt(age),
          gender: gender!,
          activityLevel: activityLevel!,
          goal: goal!,
          tdee: calculated.calorieTarget,
          proteinTargetG: calculated.protein,
          carbsTargetG: calculated.carbs,
          fatTargetG: calculated.fat,
          waterTargetMl: calculated.waterMl,
          createdAt: Date.now(),
        });
      }
      setOnboarded(true);
    } catch (e) {
      if (__DEV__) console.warn('Onboarding save failed:', e);
      Alert.alert(t.common.error, t.common.errorOccurred);
    }
  };

  const stepLabels = [
    '', // welcome has no label in stepper
    t.onboarding.stepPersonal,
    t.onboarding.stepBody,
    t.onboarding.stepActivity,
    t.onboarding.stepGoal,
    t.onboarding.stepResult,
  ];

  const renderStepIndicator = () => {
    if (step === 0) return null;
    const activeSteps = stepLabels.slice(1);
    const activeIndex = step - 1;

    return (
      <View style={styles.stepperContainer}>
        {activeSteps.map((label, i) => (
          <View key={i} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                i <= activeIndex
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: '#E0E0E0' },
              ]}
            >
              {i < activeIndex ? (
                <MaterialCommunityIcons name="check" size={14} color="#fff" />
              ) : (
                <Text style={{ color: i <= activeIndex ? '#fff' : '#999', fontSize: 11, fontWeight: 'bold' }}>
                  {i + 1}
                </Text>
              )}
            </View>
            <Text style={[styles.stepLabel, i <= activeIndex && { color: colors.primary }]}>
              {label}
            </Text>
            {i < activeSteps.length - 1 && (
              <View
                style={[
                  styles.stepLine,
                  i < activeIndex ? { backgroundColor: colors.primary } : { backgroundColor: '#E0E0E0' },
                ]}
              />
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderWelcome = () => (
    <View style={styles.welcomeContainer}>
      <View style={styles.welcomeIconContainer}>
        <Logo size={80} />
      </View>
      <Text style={styles.welcomeTitle}>{t.onboarding.welcome}</Text>
      <Text style={styles.welcomeSubtitle}>{t.onboarding.welcomeSubtitle}</Text>

      <View style={styles.welcomeFeatures}>
        <FeatureItem icon="fire" text={t.onboarding.dailyCalories} />
        <FeatureItem icon="food-apple" text={t.onboarding.protein + ' / ' + t.onboarding.carbs + ' / ' + t.onboarding.fat} />
        <FeatureItem icon="water" text={t.onboarding.water} />
        <FeatureItem icon="dumbbell" text={t.onboarding.stepGoal} />
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={() => animateTransition(1)} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>{t.onboarding.letsStart}</Text>
        <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderPersonalInfo = () => (
    <View style={styles.formContainer}>
      <Text style={styles.sectionTitle}>{t.onboarding.stepPersonal}</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{t.onboarding.yourName}</Text>
        <TextInput
          mode="outlined"
          value={name}
          onChangeText={setName}
          placeholder={t.onboarding.namePlaceholder}
          style={[styles.textInput, { backgroundColor: theme.colors.surface }]}
          outlineColor="#E0E0E0"
          activeOutlineColor={colors.primary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{t.onboarding.yourAge}</Text>
        <TextInput
          mode="outlined"
          value={age}
          onChangeText={setAge}
          placeholder={t.onboarding.agePlaceholder}
          keyboardType="number-pad"
          style={[styles.textInput, { backgroundColor: theme.colors.surface }]}
          outlineColor="#E0E0E0"
          activeOutlineColor={colors.primary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{t.onboarding.gender}</Text>
        <View style={styles.genderRow}>
          <GenderOption
            icon="gender-male"
            label={t.onboarding.male}
            selected={gender === 'male'}
            onPress={() => setGender('male')}
            color="#42A5F5"
          />
          <GenderOption
            icon="gender-female"
            label={t.onboarding.female}
            selected={gender === 'female'}
            onPress={() => setGender('female')}
            color="#EC407A"
          />
        </View>
      </View>
    </View>
  );

  const renderBodyInfo = () => (
    <View style={styles.formContainer}>
      <Text style={styles.sectionTitle}>{t.onboarding.stepBody}</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{t.onboarding.yourHeight}</Text>
        <View style={styles.unitInputRow}>
          <TextInput
            mode="outlined"
            value={height}
            onChangeText={setHeight}
            placeholder={t.onboarding.heightPlaceholder}
            keyboardType="decimal-pad"
            style={[styles.textInput, { flex: 1, backgroundColor: theme.colors.surface }]}
            outlineColor="#E0E0E0"
            activeOutlineColor={colors.primary}
          />
          <View style={styles.unitBadge}>
            <Text style={styles.unitText}>cm</Text>
          </View>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{t.onboarding.yourWeight}</Text>
        <View style={styles.unitInputRow}>
          <TextInput
            mode="outlined"
            value={weight}
            onChangeText={setWeight}
            placeholder={t.onboarding.weightPlaceholder}
            keyboardType="decimal-pad"
            style={[styles.textInput, { flex: 1, backgroundColor: theme.colors.surface }]}
            outlineColor="#E0E0E0"
            activeOutlineColor={colors.primary}
          />
          <View style={styles.unitBadge}>
            <Text style={styles.unitText}>kg</Text>
          </View>
        </View>
      </View>

      {height && weight ? (
        <View style={styles.previewCard}>
          <MaterialCommunityIcons name="human" size={32} color={colors.primary} />
          <View style={{ marginLeft: 12 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{height} cm / {weight} kg</Text>
            <Text style={{ color: '#999', fontSize: 12 }}>
              BMI: {(parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2)).toFixed(1)}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderActivityLevel = () => {
    const levels: { key: ActivityLevel; icon: string; label: string; desc: string }[] = [
      { key: 'sedentary', icon: 'seat-recline-normal', label: t.onboarding.sedentary, desc: t.onboarding.sedentaryDesc },
      { key: 'light', icon: 'walk', label: t.onboarding.light, desc: t.onboarding.lightDesc },
      { key: 'moderate', icon: 'run', label: t.onboarding.moderate, desc: t.onboarding.moderateDesc },
      { key: 'active', icon: 'run-fast', label: t.onboarding.active, desc: t.onboarding.activeDesc },
      { key: 'veryActive', icon: 'weight-lifter', label: t.onboarding.veryActive, desc: t.onboarding.veryActiveDesc },
    ];

    return (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>{t.onboarding.activityLevel}</Text>
        {levels.map((level) => (
          <TouchableOpacity
            key={level.key}
            style={[
              styles.optionCard,
              activityLevel === level.key && styles.optionCardSelected,
            ]}
            onPress={() => setActivityLevel(level.key)}
            activeOpacity={0.7}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: theme.colors.surfaceVariant }, activityLevel === level.key && { backgroundColor: `${colors.primary}20` }]}>
              <MaterialCommunityIcons
                name={level.icon as any}
                size={28}
                color={activityLevel === level.key ? colors.primary : '#999'}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.optionTitle, activityLevel === level.key && { color: colors.primary }]}>
                {level.label}
              </Text>
              <Text style={styles.optionDesc}>{level.desc}</Text>
            </View>
            {activityLevel === level.key && (
              <MaterialCommunityIcons name="check-circle" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderGoal = () => {
    const goals: { key: Goal; icon: string; label: string; desc: string; color: string }[] = [
      { key: 'lose', icon: 'trending-down', label: t.onboarding.lose, desc: t.onboarding.loseDesc, color: '#EF5350' },
      { key: 'maintain', icon: 'trending-neutral', label: t.onboarding.maintain, desc: t.onboarding.maintainDesc, color: '#42A5F5' },
      { key: 'gain', icon: 'trending-up', label: t.onboarding.gain, desc: t.onboarding.gainDesc, color: '#FFA726' },
      { key: 'muscle', icon: 'arm-flex', label: t.onboarding.muscle, desc: t.onboarding.muscleDesc, color: '#66BB6A' },
    ];

    return (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>{t.onboarding.yourGoal}</Text>
        {goals.map((g) => (
          <TouchableOpacity
            key={g.key}
            style={[
              styles.optionCard,
              goal === g.key && { ...styles.optionCardSelected, borderColor: g.color },
            ]}
            onPress={() => setGoal(g.key)}
            activeOpacity={0.7}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: theme.colors.surfaceVariant }, goal === g.key && { backgroundColor: `${g.color}20` }]}>
              <MaterialCommunityIcons
                name={g.icon as any}
                size={28}
                color={goal === g.key ? g.color : '#999'}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.optionTitle, goal === g.key && { color: g.color }]}>
                {g.label}
              </Text>
              <Text style={styles.optionDesc}>{g.desc}</Text>
            </View>
            {goal === g.key && (
              <MaterialCommunityIcons name="check-circle" size={24} color={g.color} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderResult = () => {
    if (!calculated) {
      return (
        <View style={styles.formContainer}>
          <View style={styles.resultHeader}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#FF9800" />
            <Text style={styles.resultTitle}>{t.onboarding.fillAllFields}</Text>
            <Text style={styles.resultSubtitle}>{'Lütfen geri dönüp tüm bilgileri doldurun.'}</Text>
          </View>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#FF9800' }]} onPress={goBack} activeOpacity={0.8}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>{t.common.back || 'Geri'}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const items = [
      { label: t.onboarding.dailyCalories, value: `${calculated.calorieTarget}`, unit: 'kcal', icon: 'fire', color: '#FF7043' },
      { label: t.onboarding.protein, value: `${calculated.protein}`, unit: 'g', icon: 'food-steak', color: colors.protein },
      { label: t.onboarding.carbs, value: `${calculated.carbs}`, unit: 'g', icon: 'barley', color: colors.carbs },
      { label: t.onboarding.fat, value: `${calculated.fat}`, unit: 'g', icon: 'oil', color: colors.fat },
      { label: t.onboarding.water, value: `${(calculated.waterMl / 1000).toFixed(1)}`, unit: 'L', icon: 'water', color: colors.water },
    ];

    return (
      <View style={styles.formContainer}>
        <View style={styles.resultHeader}>
          <MaterialCommunityIcons name="check-decagram" size={48} color={colors.primary} />
          <Text style={styles.resultTitle}>{t.onboarding.yourPlan}</Text>
          <Text style={styles.resultSubtitle}>{t.onboarding.yourPlanSubtitle}</Text>
        </View>

        {/* Calorie hero */}
        <View style={styles.calorieHero}>
          <MaterialCommunityIcons name="fire" size={36} color="#FF7043" />
          <Text style={styles.calorieHeroValue}>{calculated.calorieTarget}</Text>
          <Text style={styles.calorieHeroUnit}>kcal / {t.common.day}</Text>
        </View>

        {/* Macro cards */}
        <View style={styles.macroGrid}>
          {items.slice(1).map((item) => (
            <View key={item.label} style={[styles.macroCard, { backgroundColor: theme.colors.surface, borderLeftColor: item.color }]}>
              <MaterialCommunityIcons name={item.icon as any} size={22} color={item.color} />
              <Text style={styles.macroValue}>{item.value}<Text style={styles.macroUnit}> {item.unit}</Text></Text>
              <Text style={styles.macroLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* User summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{name}</Text>
          <Text style={styles.summaryDetail}>
            {age} {t.profile.age} • {height} cm • {weight} kg
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleFinish} activeOpacity={0.8}>
          <MaterialCommunityIcons name="rocket-launch" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>{t.onboarding.startApp}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderContent = () => {
    switch (step) {
      case 0: return renderWelcome();
      case 1: return renderPersonalInfo();
      case 2: return renderBodyInfo();
      case 3: return renderActivityLevel();
      case 4: return renderGoal();
      case 5: return renderResult();
      default: return null;
    }
  };

  const showNavButtons = step >= 1 && step <= 4;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.innerContainer, { paddingTop: insets.top + spacing.sm }]}>
        {renderStepIndicator()}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            {renderContent()}
          </Animated.View>
        </ScrollView>

        {/* Bottom nav buttons */}
        {showNavButtons && (
          <View style={[styles.bottomNav, { paddingBottom: insets.bottom + spacing.sm, backgroundColor: theme.colors.surface }]}>
            <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7}>
              <MaterialCommunityIcons name="arrow-left" size={20} color="#666" />
              <Text style={styles.backButtonText}>{t.onboarding.back}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.nextButton} onPress={goNext} activeOpacity={0.8}>
              <Text style={styles.nextButtonText}>{t.onboarding.next}</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Small Components ──────────────────────────────
function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIconWrap}>
        <MaterialCommunityIcons name={icon as any} size={20} color={colors.primary} />
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

function GenderOption({
  icon,
  label,
  selected,
  onPress,
  color,
}: {
  icon: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  color: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.genderCard, selected && { borderColor: color, backgroundColor: `${color}10` }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons name={icon as any} size={36} color={selected ? color : '#CCC'} />
      <Text style={[styles.genderLabel, selected && { color, fontWeight: 'bold' }]}>{label}</Text>
      {selected && <MaterialCommunityIcons name="check-circle" size={20} color={color} style={{ position: 'absolute', top: 8, right: 8 }} />}
    </TouchableOpacity>
  );
}

// ─── Styles ─────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  innerContainer: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 60 },

  // Step indicator
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepLabel: {
    fontSize: 10,
    color: '#999',
    marginLeft: 3,
    marginRight: 3,
  },
  stepLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
  },

  // Welcome
  welcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  welcomeIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  welcomeFeatures: {
    width: '100%',
    marginBottom: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    fontSize: 15,
    color: '#555',
  },

  // Form
  formContainer: {
    paddingVertical: spacing.sm,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  textInput: {
  },
  unitInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitBadge: {
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: borderRadius.sm,
  },
  unitText: {
    color: colors.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },

  // Gender
  genderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  genderCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: '#E8E8E8',
    backgroundColor: '#FAFAFA',
  },
  genderLabel: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },

  // Option cards (activity & goal)
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: '#F0F0F0',
    backgroundColor: '#FAFAFA',
    marginBottom: 10,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}08`,
  },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  optionDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },

  // Preview
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.primary}08`,
    marginTop: spacing.sm,
  },

  // Result
  resultHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: spacing.sm,
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  calorieHero: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: '#FFF3E0',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  calorieHeroValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FF7043',
  },
  calorieHeroUnit: {
    fontSize: 14,
    color: '#BF360C',
    marginTop: 2,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.md,
  },
  macroCard: {
    width: (SCREEN_WIDTH - spacing.md * 2 - 10) / 2,
    padding: 14,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  macroValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 6,
  },
  macroUnit: {
    fontSize: 14,
    fontWeight: 'normal',
    color: '#999',
  },
  macroLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  summaryCard: {
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: '#F5F5F5',
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryDetail: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },

  // Buttons
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.xl,
    gap: 8,
    elevation: 3,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 4,
  },
  backButtonText: {
    color: '#666',
    fontSize: 15,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: borderRadius.xl,
    gap: 4,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
