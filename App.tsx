import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { AppNavigation } from './src/navigation/AppNavigation';
import { LanguageProvider } from './src/i18n';
import { useThemeStore } from './src/store/themeStore';
import { useUserStore } from './src/store/userStore';
import { lightTheme, darkTheme } from './src/theme/theme';
import { initDatabase, seedDatabase } from './src/services/database/database';
import { initializeGemini } from './src/services/ai';

// Splash screen'i uygulama hazır olana kadar görünür tut
SplashScreen.preventAutoHideAsync();

export default function App() {
  const isDark = useThemeStore((s) => s.isDarkMode);
  const theme = isDark ? darkTheme : lightTheme;
  const loadOnboardingState = useUserStore((s) => s.loadOnboardingState);
  const isLoading = useUserStore((s) => s.isLoading);

  useEffect(() => {
    const init = async () => {
      await loadOnboardingState();
      if (Platform.OS === 'web') {
        console.log('FitTrack: SQLite not available on web, skipping DB init.');
        await SplashScreen.hideAsync();
        return;
      }
      try {
        await initDatabase();
        await seedDatabase();
      } catch (e) {
        console.warn('FitTrack: Database init failed:', e);
      }
      try {
        const savedKey = await AsyncStorage.getItem('gemini_api_key_plain');
        if (savedKey) initializeGemini(savedKey);
      } catch (e) {
        console.warn('FitTrack: Could not load API key:', e);
      }
      await SplashScreen.hideAsync();
    };
    init();
  }, []);

  if (isLoading) return null;

  return (
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
