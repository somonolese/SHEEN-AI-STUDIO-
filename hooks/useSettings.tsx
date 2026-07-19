import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThemeMode = 'system' | 'light' | 'dark';
export type InstallerMode = 'legacy' | 'session' | 'shizuku' | 'root';
export type DesignStyle = 'materialYou' | 'liquidGlass';
export type FontFamily = 'inter' | 'spaceGrotesk' | 'playfairDisplay' | 'comicNeue' | 'jetbrainsMono';

export type SeasonalEffectPreview = 'none' | 'snow' | 'rain' | 'leaves' | 'sakura' | 'fireflies' | 'stars' | 'confetti';
export type SpecialDay = 'newyear' | 'eid' | 'anniversary' | 'none';

export function getSpecialDay(): SpecialDay {
  const d = new Date();
  const m = d.getMonth();
  const date = d.getDate();
  const y = d.getFullYear();
  
  if (m === 0 && date === 1) return 'newyear';
  if (m === 6 && date === 15) return 'anniversary'; // July 15

  // Rough Eid approximations for 2024-2027 (months are 0-indexed)
  const eids: Record<number, number[][]> = {
    2024: [[3, 10], [5, 16]],
    2025: [[2, 30], [5, 6]],
    2026: [[2, 20], [4, 27]], 
    2027: [[2, 9], [4, 16]],
  };

  const currentEids = eids[y];
  if (currentEids) {
    for (const [em, ed] of currentEids) {
      if (em === m && (date === ed || date === ed + 1)) return 'eid';
    }
  }

  return 'none';
}

export interface SheenSettings {
  // User Profile
  userName?: string;
  userHandle?: string;
  profilePicture?: string;
  coverPhoto?: string;
  userEmail?: string;
  // Appearance
  themeMode: ThemeMode;
  designStyle: DesignStyle;
  materialYou: boolean;
  amoledBlack: boolean;
  fontFamily: FontFamily;
  accentColor: string;

  // Seasonal Effects
  seasonalEffectsEnabled: boolean;
  seasonalEffectsAutoDetect: boolean;
  seasonalEffectsPreview: SeasonalEffectPreview;
  seasonalEffectsIntensity: 'normal' | 'reduced';

  // Language
  followSystemLanguage: boolean;
  language: string;

  // Downloads
  downloadLocation: string;
  wifiOnlyDownloads: boolean;
  autoInstallAfterDownload: boolean;
  keepApkAfterInstall: boolean;
  downloadNotifications: boolean;

  // Installation
  defaultInstaller: InstallerMode;

  // Notifications
  notifAppUpdates: boolean;
  notifDownloadProgress: boolean;
  notifInstallCompleted: boolean;
  notifRepoSync: boolean;

  // Recommendations
  recommendationsAfterInstall: boolean;

  // Performance
  reduceAnimations: boolean;
  predictiveBack: boolean;
  hapticFeedback: boolean;
  batterySaver: boolean;
  // Developer
  developerUnlocked: boolean;
}

export const DEFAULT_SETTINGS: SheenSettings = {
  themeMode: 'system',
  designStyle: 'materialYou',
  materialYou: true,
  amoledBlack: false,
  fontFamily: 'inter',
  accentColor: '#3b82f6',
  seasonalEffectsEnabled: true,
  seasonalEffectsAutoDetect: true,
  seasonalEffectsPreview: 'none',
  seasonalEffectsIntensity: 'normal',
  followSystemLanguage: true,
  language: 'en',
  downloadLocation: 'internal',
  wifiOnlyDownloads: false,
  autoInstallAfterDownload: true,
  keepApkAfterInstall: false,
  downloadNotifications: true,
  defaultInstaller: 'legacy',
  notifAppUpdates: true,
  notifDownloadProgress: true,
  notifInstallCompleted: true,
  notifRepoSync: false,
  recommendationsAfterInstall: true,
  reduceAnimations: false,
  predictiveBack: true,
  hapticFeedback: true,
  batterySaver: false,
  developerUnlocked: false,
};

const STORAGE_KEY = 'sheen.settings.v1';

interface SettingsContextValue {
  settings: SheenSettings;
  update: <K extends keyof SheenSettings>(key: K, value: SheenSettings[K]) => void;
  resetAll: () => void;
  loaded: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Whether the Shizuku installer option should be offered at all.
 * Shizuku is an Android-only privileged-shell service, so it can never be
 * available on iOS or web — the row is hidden entirely there. Actual
 * runtime detection is left to the future installer implementation.
 */
export function useShizukuAvailable(): boolean {
  return Platform.OS === 'android';
}

/**
 * Loads and persists SHEEN's local settings via AsyncStorage. Settings are
 * stored as a single JSON blob under one key and merged over defaults so
 * new fields introduced later don't break existing installs.
 *
 * This provider must wrap the app once. useSettings() reads from the shared
 * context so every consumer re-renders together when a setting changes.
 */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SheenSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const hydrating = useRef(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);

          // Migrate old installer values to the new enum.
          if (parsed.defaultInstaller === 'default') {
            parsed.defaultInstaller = 'legacy';
          }

          // Remove settings that no longer exist in the UI.
          delete parsed.notifSecurityAlerts;

          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        }
      } catch (e) {
        // Corrupt or unavailable storage — fall back to defaults silently.
        console.warn('[useSettings] Failed to load settings:', e);
      } finally {
        hydrating.current = false;
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (hydrating.current) return; // Don't persist the initial default render.
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch((e) => {
      console.warn('[useSettings] Failed to persist settings:', e);
    });
  }, [settings]);

  const update = useCallback(<K extends keyof SheenSettings>(key: K, value: SheenSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetAll = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, update, resetAll, loaded }}>
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * Read the shared SHEEN settings. Must be called inside a SettingsProvider.
 * Every component using this hook re-renders when any setting changes, so
 * keep usage limited to settings-driven UI.
 */
export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
}
