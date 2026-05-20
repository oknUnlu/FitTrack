import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AppNavigation } from './src/navigation/AppNavigation';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { LanguageProvider } from './src/i18n';
import { useThemeStore } from './src/store/themeStore';
import { useUserStore } from './src/store/userStore';
import { usePremiumStore } from './src/store/premiumStore';
import { useConsentStore } from './src/store/consentStore';
import { lightTheme, darkTheme } from './src/theme/theme';
import { initDatabase, seedDatabase } from './src/services/database/database';
import { getDeviceToken } from './src/services/api/apiClient';
import { initializeBilling, checkSubscriptionStatus, setupPurchaseListener, endBillingConnection } from './src/services/premium/googleBilling';
import { initializeAds, loadInterstitial, setupAdConsent } from './src/services/ads/adService';
import {
  getNotificationPreferences,
  scheduleMealReminders,
  scheduleWaterReminders,
  scheduleWorkoutReminder,
} from './src/services/notifications/notificationService';

// Splash screen'i uygulama hazır olana kadar görünür tut
SplashScreen.preventAutoHideAsync();

export default function App() {
  const isDark = useThemeStore((s) => s.isDarkMode);
  const theme = isDark ? darkTheme : lightTheme;
  const loadOnboardingState = useUserStore((s) => s.loadOnboardingState);
  const isLoading = useUserStore((s) => s.isLoading);
  const loadPremiumState = usePremiumStore((s) => s.loadPremiumState);
  const loadConsents = useConsentStore((s) => s.loadConsents);
  // Theme persistence — without this hydrate call the app boots in light
  // mode every time, even when the user has previously toggled dark.
  const loadDarkMode = useThemeStore((s) => s.loadDarkMode);

  useEffect(() => {
    let cleanupListener: (() => void) | undefined;

    const init = async () => {
      // Theme runs first so the splash → first-paint transition matches the
      // user's saved preference and avoids a one-frame light flash.
      await loadDarkMode();
      await loadOnboardingState();
      await loadPremiumState();
      await loadConsents();
      if (Platform.OS === 'web') {
        if (__DEV__) console.log('FitTrack: SQLite not available on web, skipping DB init.');
        await SplashScreen.hideAsync();
        return;
      }
      try {
        await initDatabase();
        await seedDatabase();
      } catch (e) {
        if (__DEV__) console.warn('FitTrack: Database init failed:', e);
      }
      // Initialize device token for API authentication
      try {
        await getDeviceToken();
      } catch (e) {
        if (__DEV__) console.warn('FitTrack: Could not init device token:', e);
      }
      // Initialize Google Play Billing and check subscription status
      try {
        await initializeBilling();
        await checkSubscriptionStatus();
        cleanupListener = setupPurchaseListener();
      } catch (e) {
        if (__DEV__) console.warn('FitTrack: Google Billing init failed:', e);
      }
      // Initialize AdMob — UMP consent flow runs FIRST so AdMob picks up the
      // correct TCF v2.2 consent string before requesting any ad. For users
      // outside regulated regions UMP is a fast no-op; for EU/UK/CH/TR users
      // (depending on Google's geo flags) it shows the standardized form.
      try {
        await setupAdConsent();
        await initializeAds();
        await loadInterstitial();
      } catch (e) {
        if (__DEV__) console.warn('FitTrack: AdMob init failed:', e);
      }
      // Reconcile notification preferences with OS-scheduled state.
      // This guarantees that if the user previously disabled a reminder
      // category but the OS still has stale scheduled entries (e.g. from
      // a pre-fix build), those will be cleared on next launch.
      try {
        const prefs = await getNotificationPreferences();
        await scheduleMealReminders(prefs.meal);
        await scheduleWaterReminders(prefs.water);
        await scheduleWorkoutReminder(prefs.workout);
      } catch (e) {
        if (__DEV__) console.warn('FitTrack: Notification reconcile failed:', e);
      }
      await SplashScreen.hideAsync();
    };
    init();

    return () => {
      cleanupListener?.();
      endBillingConnection();
    };
  }, []);

  if (isLoading) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <LanguageProvider>
              <StatusBar style={isDark ? 'light' : 'dark'} translucent={true} />
              <AppNavigation />
            </LanguageProvider>
          </PaperProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
