import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SplashScreenView } from '@/components/SplashScreenView';
import { SettingsProvider, useSettings } from '@/hooks/useSettings';
import { FontProvider, useFontContext } from '@/contexts/FontContext';
import { CatalogProvider } from '@/contexts/CatalogContext';
import { Stack } from 'expo-router';
import { LogBox, LayoutAnimation, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { requestNotificationPermission } from '@/lib/services/NotificationService';
import { registerBackgroundUpdateTask } from '@/lib/services/BackgroundUpdater';

// Ignore specific ScrollView gesture rejection warnings
LogBox.ignoreLogs([
  "ScrollView doesn't take rejection well",
  "Warning: ScrollView doesn't take rejection well - scrolls anyway"
]);

// Prevent the native splash screen from auto-hiding before our custom splash
// is ready to take over. This is only relevant on native; on web it's a no-op.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

import { TopAppBar } from '@/components/TopAppBar';
import { NetworkProvider } from '@/contexts/NetworkContext';
import { NoInternetBanner } from '@/components/NoInternetBanner';

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        header: (props) => <TopAppBar {...props} />,
        animation: 'slide_from_right',
        animationDuration: 300,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
      <Stack.Screen
        name="app-details/[id]"
        options={{
          title: 'App Details',
        }}
      />
      <Stack.Screen
        name="sheen-plus"
        options={{
          title: 'SHEEN+',
        }}
      />
      <Stack.Screen
        name="category/[id]"
        options={{
          title: 'Category',
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          title: 'Notifications',
        }}
      />
      <Stack.Screen
        name="changelog"
        options={{
          title: 'Changelog',
        }}
      />
      <Stack.Screen
        name="contributors"
        options={{
          title: 'Contributors',
        }}
      />
      <Stack.Screen
        name="updates"
        options={{
          title: 'Updates',
        }}
      />
      <Stack.Screen
        name="gallery/[id]"
        options={{
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'fade',
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <FontProvider>
        <NetworkProvider>
          <CatalogProvider>
            <AppThemeProvider>
              <RootLayoutInner />
            </AppThemeProvider>
          </CatalogProvider>
        </NetworkProvider>
      </FontProvider>
    </SettingsProvider>
  );
}

import { ThemeProvider } from '@react-navigation/native';
import { useColors, useEffectiveColorScheme, AppThemeProvider } from '@/hooks/useColors';

function RootLayoutInner() {
  const { ready: fontsReady } = useFontContext();
  const { settings } = useSettings();
  const colors = useColors();
  const scheme = useEffectiveColorScheme();
  
  // Animate layout changes when scheme or theme mode changes
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [scheme, settings.themeMode]);

  const navigationTheme = {
    dark: scheme === 'dark',
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.surfaceContainer,
      text: colors.foreground,
      border: colors.border,
      notification: colors.primary,
    },
  };


  // The app is considered ready once the font load has been attempted. Settings
  // are loaded independently; we don't wait for them because font failures are
  // handled gracefully and the UI can render with default settings immediately.
  const ready = fontsReady;

  // Controls whether our custom animated splash is still on screen.
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      registerBackgroundUpdateTask();
      requestNotificationPermission().catch((e) => {
        console.warn('[RootLayout] Failed to request notification permission:', e);
      });
    }
  }, []);

  useEffect(() => {
    if (fontsReady) {
      // Hide the native splash as soon as we've attempted font loading; our
      // custom animated splash takes over from there.
      SplashScreen.hideAsync().catch((e) => {
        // Native splash may already be hidden; ignore failures.
        console.warn('[RootLayout] Failed to hide native splash:', e);
      });
    }
  }, [fontsReady]);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={navigationTheme as any}>
            <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
                {/* Home screen renders underneath while splash is still visible */}
                <RootLayoutNav />
                <NoInternetBanner />

                {/* Custom animated splash — rendered on top, removed after animation */}
                {splashVisible && (
                  <SplashScreenView
                    ready={ready}
                    onFinish={() => setSplashVisible(false)}
                  />
                )}
            </KeyboardProvider>
          </GestureHandlerRootView>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
