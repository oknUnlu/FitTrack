import Constants from 'expo-constants';

// Firebase project ID — sabit, değişmez
const FIREBASE_PROJECT_ID = 'fittrack-a958c';

// Production: Firebase Hosting URL (fittrack-a958c.web.app)
// Development: Firebase Emulator
const FIREBASE_EMULATOR_HOST = 'http://localhost:5001';

function getBaseUrl(): string {
  // app.json extra.apiBaseUrl varsa öncelikli kullan
  const configUrl = Constants.expoConfig?.extra?.apiBaseUrl;
  if (configUrl) return configUrl;

  if (__DEV__) {
    // Firebase Emulator (firebase emulators:start --only functions,hosting)
    return FIREBASE_EMULATOR_HOST;
  }

  // Production: Firebase Hosting üzerinden (rewrites → Cloud Functions)
  return `https://${FIREBASE_PROJECT_ID}.web.app`;
}

export const API_BASE_URL = getBaseUrl();

export const API_ENDPOINTS = {
  health: `${API_BASE_URL}/api/health`,
  chat: `${API_BASE_URL}/api/chat`,
  plan: `${API_BASE_URL}/api/plan`,
  foodRecognition: `${API_BASE_URL}/api/food-recognition`,
  foodEstimate: `${API_BASE_URL}/api/food-estimate`,
  promo: `${API_BASE_URL}/api/promo`,
  verifyPurchase: `${API_BASE_URL}/api/verify-purchase`,
  deleteAccount: `${API_BASE_URL}/api/delete-account`,
  registerPush: `${API_BASE_URL}/api/register-push`,
  event: `${API_BASE_URL}/api/event`,
} as const;
