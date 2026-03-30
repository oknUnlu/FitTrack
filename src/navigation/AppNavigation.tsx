import React, { useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingScreen } from '../screens/Onboarding/OnboardingScreen';
import { useUserStore } from '../store/userStore';
import { DashboardScreen } from '../screens/Dashboard/DashboardScreen';
import { CalorieScreen } from '../screens/Calorie/CalorieScreen';
import { WorkoutScreen } from '../screens/Workout/WorkoutScreen';
import { ProgressScreen } from '../screens/Progress/ProgressScreen';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { AICoachScreen } from '../screens/AICoach/AICoachScreen';
import { ToolsScreen } from '../screens/Tools/ToolsScreen';
import { ActiveWorkoutScreen } from '../screens/Workout/ActiveWorkoutScreen';
import { SessionDetailScreen } from '../screens/Workout/SessionDetailScreen';
import { AchievementsScreen } from '../screens/Achievements/AchievementsScreen';
import { BodyMetricsScreen } from '../screens/BodyMetrics/BodyMetricsScreen';
import { SupplementsScreen } from '../screens/Supplements/SupplementsScreen';
import { WellnessScreen } from '../screens/Wellness/WellnessScreen';
import { HealthHubScreen } from '../screens/HealthHub/HealthHubScreen';
import { SocialScreen } from '../screens/Social/SocialScreen';
import { FastingScreen } from '../screens/Fasting/FastingScreen';
import { useLanguage } from '../i18n';

export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: undefined;
  AICoach: undefined;
  Tools: undefined;
  Achievements: undefined;
  BodyMetrics: undefined;
  Supplements: undefined;
  Wellness: undefined;
  HealthHub: undefined;
  Social: undefined;
  Fasting: undefined;
  ActiveWorkout: { templateId?: string; templateName?: string; preloadedExerciseIds?: string[] } | undefined;
  SessionDetail: { sessionId: string; sessionName: string; date: string; durationMinutes: number; caloriesBurned: number };
};

export type TabParamList = {
  Dashboard: undefined;
  Calories: undefined;
  Workout: undefined;
  Progress: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

type TabIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function MainTabs() {
  const theme = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const tabConfig: {
    name: keyof TabParamList;
    label: string;
    icon: TabIconName;
    iconFocused: TabIconName;
    component: React.ComponentType<any>;
  }[] = [
    { name: 'Dashboard', label: t.tabs.home, icon: 'home-outline', iconFocused: 'home', component: DashboardScreen },
    { name: 'Calories', label: t.tabs.calories, icon: 'silverware-fork-knife', iconFocused: 'silverware-fork-knife', component: CalorieScreen },
    { name: 'Workout', label: t.tabs.workout, icon: 'dumbbell', iconFocused: 'dumbbell', component: WorkoutScreen },
    { name: 'Progress', label: t.tabs.progress, icon: 'trending-up', iconFocused: 'trending-up', component: ProgressScreen },
    { name: 'Profile', label: t.tabs.profile, icon: 'account-outline', iconFocused: 'account', component: ProfileScreen },
  ];

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.surfaceVariant,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      {tabConfig.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            tabBarLabel: tab.label,
            tabBarIcon: ({ focused, color, size }) => (
              <MaterialCommunityIcons
                name={focused ? tab.iconFocused : tab.icon}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

function AppStack() {
  const { t } = useLanguage();
  const isOnboarded = useUserStore((s) => s.isOnboarded);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isOnboarded ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animationTypeForReplace: 'push' }} />
      ) : null}
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="AICoach"
        component={AICoachScreen}
        options={{ headerShown: true, title: t.aiCoach.title, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Tools"
        component={ToolsScreen}
        options={{ headerShown: true, title: t.tools.title, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Achievements"
        component={AchievementsScreen}
        options={{ headerShown: true, title: t.achievements.title, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="BodyMetrics"
        component={BodyMetricsScreen}
        options={{ headerShown: true, title: t.screenTitles.bodyMetrics, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Supplements"
        component={SupplementsScreen}
        options={{ headerShown: true, title: t.screenTitles.supplements, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Wellness"
        component={WellnessScreen}
        options={{ headerShown: true, title: t.screenTitles.wellness, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="HealthHub"
        component={HealthHubScreen}
        options={{ headerShown: true, title: t.screenTitles.healthHub, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Social"
        component={SocialScreen}
        options={{ headerShown: true, title: t.screenTitles.challenges, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Fasting"
        component={FastingScreen}
        options={{ headerShown: true, title: (t as any).fasting?.title || 'Fasting Tracker', animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ActiveWorkout"
        component={ActiveWorkoutScreen}
        options={{ headerShown: false, animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="SessionDetail"
        component={SessionDetailScreen}
        options={{ headerShown: true, title: t.workout.sessionDetail, animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}

const linking: any = {
  prefixes: ['fittrack://', 'https://fittrack.app'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Dashboard: 'home',
          Calories: 'calories',
          Workout: 'workout',
          Progress: 'progress',
          Profile: 'profile',
        },
      },
      AICoach: 'coach',
      Achievements: 'achievements',
      Social: 'challenges',
      Supplements: 'supplements',
      Wellness: 'wellness',
      HealthHub: 'health',
      Fasting: 'fasting',
    },
  },
};

export function AppNavigation() {
  const isOnboarded = useUserStore((s) => s.isOnboarded);
  return (
    <NavigationContainer key={isOnboarded ? 'onboarded' : 'onboarding'} linking={linking}>
      <AppStack />
    </NavigationContainer>
  );
}
