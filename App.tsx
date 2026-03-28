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
import { lightTheme, darkTheme } from './src/theme/theme';
import { initDatabase, seedDatabase } from './src/services/database/database';
import { getDeviceToken } from './src/services/api/apiClient';

// Splash screen'i uygulama hazır olana kadar görünür tut
SplashScreen.preventAutoHideAsync();

export default function App() {
  const isDark = useThemeStore((s) => s.isDarkMode);
  const theme = isDark ? darkTheme : lightTheme;
  const loadOnboardingState = useUserStore((s) => s.loadOnboardingState);
  const isLoading = useUserStore((s) => s.isLoading);
  const loadPremiumState = usePremiumStore((s) => s.loadPremiumState);

  useEffect(() => {
    const init = async () => {
      await loadOnboardingState();
      await loadPremiumState();
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
      await SplashScreen.hideAsync();
    };
    init();
  }, []);

  if (isLoading) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <LanguageProvider>
              <StatusBar style={isDark ? 'light' : 'dark'} translucent={false} />
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
