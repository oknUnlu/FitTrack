import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

export const colors = {
  primary: '#4CAF50',
  primaryDark: '#388E3C',
  secondary: '#2196F3',
  orange: '#FF9800',
  red: '#F44336',
  yellow: '#FFEB3B',
  purple: '#9C27B0',

  // Semantic
  calorieGreen: '#66BB6A',
  calorieYellow: '#FFCA28',
  calorieRed: '#EF5350',
  protein: '#42A5F5',
  carbs: '#FFA726',
  fat: '#EF5350',
  water: '#29B6F6',

  // Text
  textPrimary: '#333',
  textSecondary: '#666',
  textTertiary: '#999',
  textDisabled: '#ccc',
  textOnPrimary: '#fff',

  // Border & Divider
  border: '#E0E0E0',
  divider: '#F0F0F0',

  // Background tints
  successBg: '#E8F5E9',
  warningBg: '#FFF3E0',
  errorBg: '#FFEBEE',
  infoBg: '#E3F2FD',

  // Surface
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceVariant: '#F5F5F5',
  backgroundDark: '#121212',
  surfaceDark: '#1E1E1E',
};

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    secondary: colors.secondary,
    tertiary: colors.orange,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.surfaceVariant,
    error: colors.red,
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.primary,
    secondary: colors.secondary,
    tertiary: colors.orange,
    background: colors.backgroundDark,
    surface: colors.surfaceDark,
    error: colors.red,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;
