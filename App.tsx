import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform, StyleSheet } from 'react-native';
import { AppNavigation } from './src/navigation/AppNavigation';
import { useThemeStore } from './src/store/themeStore';
import { lightTheme, darkTheme } from './src/theme/theme';
import { initDatabase, seedDatabase } from './src/services/database/database';

export default function App() {
  const isDark = useThemeStore((s) => s.isDarkMode);
  const theme = isDark ? darkTheme : lightTheme;

  useEffect(() => {
    const init = async () => {
      if (Platform.OS === 'web') {
        console.log('FitTrack: SQLite not available on web, skipping DB init.');
        return;
      }
      try {
        await initDatabase();
        await seedDatabase();
      } catch (e) {
        console.warn('FitTrack: Database init failed:', e);
      }
    };
    init();
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <AppNavigation />
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
