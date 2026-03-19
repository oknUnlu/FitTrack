import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';

import { DashboardScreen } from '../screens/Dashboard/DashboardScreen';
import { CalorieScreen } from '../screens/Calorie/CalorieScreen';
import { WorkoutScreen } from '../screens/Workout/WorkoutScreen';
import { ProgressScreen } from '../screens/Progress/ProgressScreen';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { AICoachScreen } from '../screens/AICoach/AICoachScreen';
import { ToolsScreen } from '../screens/Tools/ToolsScreen';

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

const tabConfig: {
  name: keyof TabParamList;
  label: string;
  icon: TabIconName;
  iconFocused: TabIconName;
  component: React.ComponentType<any>;
}[] = [
  { name: 'Dashboard', label: 'Ana Sayfa', icon: 'home-outline', iconFocused: 'home', component: DashboardScreen },
  { name: 'Calories', label: 'Kalori', icon: 'silverware-fork-knife', iconFocused: 'silverware-fork-knife', component: CalorieScreen },
  { name: 'Workout', label: 'Antrenman', icon: 'dumbbell', iconFocused: 'dumbbell', component: WorkoutScreen },
  { name: 'Progress', label: 'İlerleme', icon: 'trending-up', iconFocused: 'trending-up', component: ProgressScreen },
  { name: 'Profile', label: 'Profil', icon: 'account-outline', iconFocused: 'account', component: ProfileScreen },
];

function MainTabs() {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.surfaceVariant,
          height: 60,
          paddingBottom: 8,
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

export function AppNavigation() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen
          name="AICoach"
          component={AICoachScreen}
          options={{ headerShown: true, title: 'AI Fitness Koçu', animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Tools"
          component={ToolsScreen}
          options={{ headerShown: true, title: 'Araçlar', animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
