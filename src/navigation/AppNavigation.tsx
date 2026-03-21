import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DashboardScreen } from '../screens/Dashboard/DashboardScreen';
import { CalorieScreen } from '../screens/Calorie/CalorieScreen';
import { WorkoutScreen } from '../screens/Workout/WorkoutScreen';
import { ProgressScreen } from '../screens/Progress/ProgressScreen';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { AICoachScreen } from '../screens/AICoach/AICoachScreen';
import { ToolsScreen } from '../screens/Tools/ToolsScreen';
import { ActiveWorkoutScreen } from '../screens/Workout/ActiveWorkoutScreen';
import { useLanguage } from '../i18n';

export type RootStackParamList = {
  MainTabs: undefined;
  AICoach: undefined;
  Tools: undefined;
  ActiveWorkout: undefined;
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

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
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
        name="ActiveWorkout"
        component={ActiveWorkoutScreen}
        options={{ headerShown: false, animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}

export function AppNavigation() {
  return (
    <NavigationContainer>
      <AppStack />
    </NavigationContainer>
  );
}
