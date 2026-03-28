import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '../../config/api';
import { usePremiumStore } from '../../store/premiumStore';

const DEVICE_TOKEN_KEY = 'device_token';

let SecureStore: typeof import('expo-secure-store') | null = null;

async function getSecureStore() {
  if (Platform.OS === 'web') return null;
  if (!SecureStore) {
    try {
      SecureStore = require('expo-secure-store');
    } catch {
      return null;
    }
  }
  return SecureStore;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create a persistent device token for authentication.
 */
export async function getDeviceToken(): Promise<string> {
  const store = await getSecureStore();

  // Try to read existing token
  if (store) {
    const token = await store.getItemAsync(DEVICE_TOKEN_KEY);
    if (token) return token;
  } else {
    const token = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
    if (token) return token;
  }

  // Generate new token
  const newToken = generateUUID();
  if (store) {
    await store.setItemAsync(DEVICE_TOKEN_KEY, newToken);
  } else {
    await AsyncStorage.setItem(DEVICE_TOKEN_KEY, newToken);
  }
  return newToken;
}

/**
 * Build authorization headers for API requests.
 */
async function getHeaders(): Promise<Record<string, string>> {
  const token = await getDeviceToken();
  const isPremium = usePremiumStore.getState().isPremium;

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Premium': isPremium ? 'true' : 'false',
  };
}

/**
 * Make an authenticated POST request to the API.
 */
export async function apiPost<T = any>(
  endpoint: string,
  body: Record<string, any>
): Promise<T> {
  const headers = await getHeaders();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    throw new Error('RATE_LIMIT_EXCEEDED');
  }

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Check if the API backend is reachable.
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(API_ENDPOINTS.health, { method: 'GET' });
    const data = await response.json();
    return data.status === 'ok' && data.hasApiKey;
  } catch {
    return false;
  }
}
