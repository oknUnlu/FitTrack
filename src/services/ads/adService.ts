import { Platform } from 'react-native';
import { usePremiumStore } from '../../store/premiumStore';

// ── Ad Unit IDs ──
// Test IDs (geliştirme için) — Production'da gerçek ID'ler kullanılır
const TEST_BANNER_ANDROID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_BANNER_IOS = 'ca-app-pub-3940256099942544/2934735716';
const TEST_INTERSTITIAL_ANDROID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_INTERSTITIAL_IOS = 'ca-app-pub-3940256099942544/4411468910';

// Gerçek Ad Unit ID'leri — AdMob Console'dan alındı
const PROD_BANNER_IDS = {
  dashboard_android: 'ca-app-pub-3850996093825148/3353732352',
  dashboard_ios: '',
  progress_android: 'ca-app-pub-3850996093825148/6708757077',
  progress_ios: '',
  nutrition_android: 'ca-app-pub-3850996093825148/4475242330',
  nutrition_ios: '',
};

const PROD_INTERSTITIAL_IDS = {
  workout_complete_android: 'ca-app-pub-3850996093825148/4662944596',
  workout_complete_ios: '',
};

// __DEV__ modunda her zaman test ID'lerini kullan (production'da gerçek ID'ler kullanılır)
const isTestMode = __DEV__;

export type BannerScreen = 'dashboard' | 'progress' | 'nutrition';

// Native modül mevcut mu kontrol et (Expo Go'da mevcut değildir)
let isNativeModuleAvailable = false;
try {
  const mod = require('react-native-google-mobile-ads');
  if (mod?.default) {
    isNativeModuleAvailable = true;
  }
} catch {
  isNativeModuleAvailable = false;
}

/**
 * Banner reklam ID'sini döndürür
 */
export function getBannerAdUnitId(screen: BannerScreen): string {
  if (isTestMode) {
    return Platform.OS === 'ios' ? TEST_BANNER_IOS : TEST_BANNER_ANDROID;
  }
  const key = `${screen}_${Platform.OS === 'ios' ? 'ios' : 'android'}` as keyof typeof PROD_BANNER_IDS;
  return PROD_BANNER_IDS[key] || (Platform.OS === 'ios' ? TEST_BANNER_IOS : TEST_BANNER_ANDROID);
}

/**
 * Interstitial reklam ID'sini döndürür
 */
export function getInterstitialAdUnitId(): string {
  if (isTestMode) {
    return Platform.OS === 'ios' ? TEST_INTERSTITIAL_IOS : TEST_INTERSTITIAL_ANDROID;
  }
  return Platform.OS === 'ios'
    ? PROD_INTERSTITIAL_IDS.workout_complete_ios || TEST_INTERSTITIAL_IOS
    : PROD_INTERSTITIAL_IDS.workout_complete_android || TEST_INTERSTITIAL_ANDROID;
}

/**
 * Kullanıcının reklam görmesi gerekip gerekmediğini kontrol eder
 */
export function shouldShowAds(): boolean {
  return !usePremiumStore.getState().isPremium;
}

/**
 * Google Mobile Ads SDK'yı başlatır.
 * Native modül mevcut değilse (Expo Go) sessizce atlar.
 */
let adsInitialized = false;

export async function initializeAds(): Promise<void> {
  if (adsInitialized || Platform.OS === 'web' || !isNativeModuleAvailable) return;

  try {
    const mobileAds = require('react-native-google-mobile-ads').default;
    await mobileAds().initialize();
    adsInitialized = true;
    if (__DEV__) console.log('AdMob: Initialized successfully');
  } catch (e) {
    if (__DEV__) console.warn('AdMob: Native module not available, skipping. This is normal in Expo Go.');
  }
}

/**
 * Interstitial reklam yükle (antrenman bitişi için)
 */
let interstitialLoaded = false;
let interstitialAd: any = null;

export async function loadInterstitial(): Promise<void> {
  if (Platform.OS === 'web' || !adsInitialized || !isNativeModuleAvailable) return;
  if (!shouldShowAds()) return;

  try {
    const { InterstitialAd, AdEventType } = require('react-native-google-mobile-ads');
    const adUnitId = getInterstitialAdUnitId();

    interstitialAd = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    return new Promise<void>((resolve) => {
      const loadedUnsub = interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
        interstitialLoaded = true;
        loadedUnsub();
        resolve();
      });
      const errorUnsub = interstitialAd.addAdEventListener(AdEventType.ERROR, () => {
        interstitialLoaded = false;
        errorUnsub();
        resolve();
      });
      interstitialAd.load();

      // 10 saniye timeout
      setTimeout(() => { resolve(); }, 10000);
    });
  } catch (e) {
    if (__DEV__) console.warn('AdMob: Failed to load interstitial', e);
  }
}

/**
 * Interstitial reklam göster
 */
export async function showInterstitial(): Promise<boolean> {
  if (!shouldShowAds() || !interstitialLoaded || !interstitialAd || !isNativeModuleAvailable) return false;

  try {
    await interstitialAd.show();
    interstitialLoaded = false;
    // Yeni reklam yükle (sonraki gösterim için)
    setTimeout(() => loadInterstitial(), 3000);
    return true;
  } catch (e) {
    if (__DEV__) console.warn('AdMob: Failed to show interstitial', e);
    return false;
  }
}
