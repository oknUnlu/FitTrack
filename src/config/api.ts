import Constants from 'expo-constants';
import { Platform } from 'react-native';

function getBaseUrl(): string {
  // Check app.json extra config first
  const configUrl = Constants.expoConfig?.extra?.apiBaseUrl;
  if (configUrl) return configUrl;

  // Development: use local Vercel dev server
  if (__DEV__) {
    if (Platform.OS === 'web') {
      // Web dev: same origin (proxy through metro or direct)
      return '';
    }
    // Native dev: localhost
    return 'http://localhost:3000';
  }

  // Production: Vercel deployment URL
  return 'https://fittrack-api-liard.vercel.app';
}

export const API_BASE_URL = getBaseUrl();

export const API_ENDPOINTS = {
  health: `${API_BASE_URL}/api/health`,
  chat: `${API_BASE_URL}/api/chat`,
  plan: `${API_BASE_URL}/api/plan`,
  foodRecognition: `${API_BASE_URL}/api/food-recognition`,
  promo: `${API_BASE_URL}/api/promo`,
} as const;
