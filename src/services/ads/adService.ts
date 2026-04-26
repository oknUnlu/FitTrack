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

// ── Timing Constants ──
const AD_LOAD_TIMEOUT_MS = 10_000;
const AD_RELOAD_DELAY_MS = 3_000;

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
 * Run Google's User Messaging Platform (UMP) consent flow before any ads
 * load. UMP is the official IAB TCF v2.2-compliant consent dialog that
 * AdMob expects for EU/UK/Switzerland users — and increasingly for any
 * region where regulators apply ePrivacy-style rules (Türkiye trends this
 * way under KVKK).
 *
 * The flow is:
 *   1. `requestInfoUpdate` — asks Google whether the user needs to be
 *      shown a consent form (geo-aware: returns "not required" for users
 *      outside regulated regions, so non-EU users see nothing).
 *   2. `loadAndShowConsentFormIfRequired` — renders the form if needed.
 *      This is a no-op for non-regulated users.
 *
 * After this completes, the AdMob SDK reads the persisted TCF string from
 * device storage and tags every ad request with the correct
 * personalization signal. We don't need to manually pass `npa=1`.
 *
 * Failures are non-fatal — better to load contextual (non-personalised)
 * ads than to block the app on a flaky consent server.
 */
export async function setupAdConsent(): Promise<void> {
  if (Platform.OS === 'web' || !isNativeModuleAvailable) return;
  try {
    const { AdsConsent } = require('react-native-google-mobile-ads');
    await AdsConsent.requestInfoUpdate();
    await AdsConsent.loadAndShowConsentFormIfRequired();
  } catch (e) {
    if (__DEV__) console.warn('UMP: setup failed (non-fatal):', e);
  }
}

/**
 * Lets the user re-open the UMP consent form from Profile → "Reklam
 * tercihlerimi düzenle". Internally this resets the persisted TCF string
 * and immediately re-runs the consent flow so the form actually appears
 * (otherwise UMP would just say "no update required" for the same user).
 *
 * Returns true if the form was shown (or attempted), false on Expo Go /
 * web / unavailable native module.
 */
export async function resetAdConsent(): Promise<boolean> {
  if (Platform.OS === 'web' || !isNativeModuleAvailable) return false;
  try {
    const { AdsConsent } = require('react-native-google-mobile-ads');
    AdsConsent.reset();
    await AdsConsent.requestInfoUpdate();
    await AdsConsent.loadAndShowConsentFormIfRequired();
    return true;
  } catch (e) {
    if (__DEV__) console.warn('UMP: reset failed:', e);
    return false;
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

      setTimeout(() => { resolve(); }, AD_LOAD_TIMEOUT_MS);
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
    setTimeout(() => loadInterstitial(), AD_RELOAD_DELAY_MS);
    return true;
  } catch (e) {
    if (__DEV__) console.warn('AdMob: Failed to show interstitial', e);
    return false;
  }
}
