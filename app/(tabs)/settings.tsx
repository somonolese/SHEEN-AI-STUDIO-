import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  View,
  useColorScheme,
  ScrollView,
  ToastAndroid,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { DesignStyle, InstallerMode, ThemeMode, useShizukuAvailable, useSettings, SeasonalEffectPreview, FontFamily } from '@/hooks/useSettings';
import { useTranslation } from '@/lib/i18n';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useCatalog } from '@/contexts/CatalogContext';
import { WELL_KNOWN_GITHUB_REPOS, addWellKnownGitHubRepo } from '@/lib/repositories/RepositoryRegistry';
import { clearMetadataCache, loadUpdateSettings, saveUpdateSettings, UpdateSettings } from '@/lib/services/CacheService';
import { FONT_LABELS, FONT_OPTIONS, useTypography } from '@/hooks/useTypography';
import { useEffectiveColorScheme } from '@/hooks/useColors';
import { PremiumPullToRefresh } from '@/components/PremiumPullToRefresh';
import {
  ActionRow,
  AnimatedPressable,
  InfoRow,
  SettingsCard,
  SelectRow,
  SwitchRow,
} from '@/components/settings/SettingsPrimitives';
import { SelectSheet, SelectOption } from '@/components/settings/SelectSheet';
import { AccentColorSheet } from '@/components/settings/AccentColorSheet';
import { CollapsibleSection } from '@/components/settings/CollapsibleSection';
import { ThemedText } from '@/components/ThemedText';
import { SheenIcon } from '@/components/SheenIcon';
import TabAnimationWrapper from '@/components/TabAnimationWrapper';

// ─── Static option lists ────────────────────────────────────────────────────

const THEME_OPTIONS: SelectOption<ThemeMode>[] = [
  { key: 'system', label: 'System', description: 'Match your device setting', icon: 'theme-light-dark' },
  { key: 'light', label: 'Light', icon: 'weather-sunny' },
  { key: 'dark', label: 'Dark', icon: 'weather-night' },
];




const LANGUAGE_OPTIONS: SelectOption<string>[] = [
  { key: 'en', label: 'English' },
  { key: 'zh', label: '中文 (Chinese)' },
  { key: 'es', label: 'Español (Spanish)' },
  { key: 'fr', label: 'Français (French)' },
  { key: 'pt', label: 'Português (Portuguese)' },
  { key: 'ru', label: 'Русский (Russian)' },
  { key: 'ur', label: 'اردو (Urdu)' },
  { key: 'hi', label: 'हिन्दी (Hindi)' },
  { key: 'de', label: 'Deutsch' },
];

const DOWNLOAD_LOCATION_OPTIONS: SelectOption<string>[] = [
  { key: 'internal', label: 'App storage', description: "SHEEN's private storage", icon: 'cellphone' },
  { key: 'downloads', label: 'Downloads folder', description: 'Shared /Download directory', icon: 'folder-download-outline' },
  { key: 'custom', label: 'Custom folder', description: 'Choose a folder each time', icon: 'folder-star-outline' },
];

const THEME_LABELS: Record<ThemeMode, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};
const LANGUAGE_LABELS: Record<string, string> = LANGUAGE_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.key]: o.label }),
  {} as Record<string, string>,
);
const DOWNLOAD_LOCATION_LABELS: Record<string, string> = DOWNLOAD_LOCATION_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.key]: o.label }),
  {} as Record<string, string>,
);
const INSTALLER_LABELS: Record<InstallerMode, string> = {
  legacy: 'Legacy',
  session: 'Session',
  shizuku: 'Shizuku',
  root: 'Root',
};

const SEASONAL_PREVIEW_OPTIONS: SelectOption<SeasonalEffectPreview>[] = [
  { key: 'none', label: 'Disable all effects', icon: 'cancel' },
  { key: 'snow', label: 'Snow', icon: 'snowflake' },
  { key: 'rain', label: 'Rain', icon: 'weather-pouring' },
  { key: 'leaves', label: 'Falling leaves', icon: 'leaf-maple' },
  { key: 'sakura', label: 'Sakura petals', icon: 'flower' },
  { key: 'fireflies', label: 'Fireflies', icon: 'flare' },
  { key: 'stars', label: 'Stars', icon: 'star-four-points' },
  { key: 'confetti', label: 'Confetti', icon: 'party-popper' },
];

const SEASONAL_PREVIEW_LABELS: Record<SeasonalEffectPreview, string> = {
  none: 'Disabled',
  snow: 'Snow',
  rain: 'Rain',
  leaves: 'Falling leaves',
  sakura: 'Sakura petals',
  fireflies: 'Fireflies',
  stars: 'Stars',
  confetti: 'Confetti',
};

type SheetKind = 'theme' | 'language' | 'downloadLocation' | 'installer' | 'font' | 'githubRepo' | 'accentColor' | 'seasonalPreview' | 'autoCheck' | null;

// ─── External links ──────────────────────────────────────────────────────────

const LINKS = {
  github: 'https://github.com',
  reportBug: 'https://github.com/issues/new',
  requestFeature: 'https://github.com/issues/new',
  privacyPolicy: 'https://github.com',
};

function openExternal(url: string) {
  Linking.openURL(url).catch(() => {
    Alert.alert('Unable to open link', 'Please check your connection and try again.');
  });
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { settings, update } = useSettings();
  const catalog = useCatalog();
  const shizukuAvailable = useShizukuAvailable();
  const typography = useTypography();
  const fontLabel = FONT_LABELS[settings.fontFamily as FontFamily] ?? 'Default';
  const repositoryTypeLabels: Record<string, string> = {
    fdroid: 'F-Droid',
    izzy: 'IzzyOnDroid',
    github: 'GitHub',
    manual: 'Manual',
  };

  const [updateSettings, setUpdateSettings] = useState<UpdateSettings>({
    autoCheckMode: 'notify',
    wifiOnly: true,
    chargingOnly: false,
    ignoredPackages: [],
    ignoredVersions: {},
    lastCheck: 0
  });
  useEffect(() => {
    loadUpdateSettings().then(setUpdateSettings);
  }, []);
  const updateUpdateSettings = async (updates: Partial<UpdateSettings>) => {
    const newSettings = { ...updateSettings, ...updates };
    setUpdateSettings(newSettings);
    await saveUpdateSettings(newSettings);
  };

  const AUTO_CHECK_OPTIONS: SelectOption<string>[] = [
    { key: 'auto', label: 'Always update automatically' },
    { key: 'wifiOnly', label: 'Download only over Wi-Fi' },
    { key: 'notify', label: 'Notify only' },
    { key: 'manual', label: 'Manual only' },
  ];

  const getAutoCheckLabel = () => {
    if (updateSettings?.autoCheckMode === 'auto' && !updateSettings.wifiOnly) return 'Always update automatically';
    if (updateSettings?.autoCheckMode === 'auto' && updateSettings.wifiOnly) return 'Download only over Wi-Fi';
    if (updateSettings?.autoCheckMode === 'notify') return 'Notify only';
    return 'Manual only';
  };

  const githubRepoEntries = useMemo(
    () => Object.entries(WELL_KNOWN_GITHUB_REPOS).map(([key, config]) => ({ key, config })),
    [],
  );

  // All 4 installer options — always shown; unsupported ones are disabled
  const installerOptions = useMemo((): SelectOption<InstallerMode>[] => [
    {
      key: 'legacy',
      label: 'Legacy Installer',
      description: 'Uses the Android package installer. Works on all Android versions.',
      icon: 'package-variant-closed',
    },
    {
      key: 'session',
      label: 'Session Installer',
      description: 'Uses PackageInstaller sessions. Requires Android 12+.',
      icon: 'package-variant',
      disabled: Platform.OS !== 'android',
      badge: Platform.OS !== 'android' ? 'Android 12+' : undefined,
    },
    {
      key: 'shizuku',
      label: 'Shizuku Installer',
      description: 'Requires Shizuku running. Enables privileged installs without root.',
      icon: 'shield-half-full',
      disabled: Platform.OS !== 'android' || !shizukuAvailable,
      badge: Platform.OS !== 'android' ? 'Android only' : !shizukuAvailable ? 'Not detected' : undefined,
    },
    {
      key: 'root',
      label: 'Root Installer',
      description: 'Requires root access. Enables silent installs and system-level control.',
      icon: 'crown-outline',
      disabled: Platform.OS !== 'android',
      badge: Platform.OS !== 'android' ? 'Android only' : undefined,
    },
  ], [shizukuAvailable]);

  // If Shizuku becomes unavailable while selected, fall back to legacy.
  React.useEffect(() => {
    if (!shizukuAvailable && settings.defaultInstaller === 'shizuku') {
      update('defaultInstaller', 'legacy');
    }
  }, [shizukuAvailable, settings.defaultInstaller, update]);

  const { width: windowWidth } = useWindowDimensions();
  const isRailMode = windowWidth >= 600;
  const topPad = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPad = isRailMode 
    ? (insets.bottom + 16 + 24) 
    : (Platform.OS === 'web' ? 34 + 88 + 24 : insets.bottom + 76 + 24);

  const [activeSheet, setActiveSheet] = useState<SheetKind>(null);
  const [clearingCache, setClearingCache] = useState(false);
  const [syncingRepos, setSyncingRepos] = useState(false);
  const [updatingRepoIds, setUpdatingRepoIds] = useState<Record<string, boolean>>({});
  const [addingRepoKey, setAddingRepoKey] = useState<string | null>(null);

  const haptic = useCallback(() => {
    if (!settings.hapticFeedback || Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [settings.hapticFeedback]);

  // Experimental Settings Unlock
  const [logoTaps, setLogoTaps] = useState(0);

  const handleLogoTap = useCallback(() => {
    if (settings.developerUnlocked) {
      if (Platform.OS === 'android') {
        ToastAndroid.show('Experimental settings are already enabled.', ToastAndroid.SHORT);
      } else {
        Alert.alert('Developer Mode', 'Experimental settings are already enabled.');
      }
      return;
    }
    
    const nextTaps = logoTaps + 1;
    setLogoTaps(nextTaps);
    
    if (nextTaps === 5) {
      update('developerUnlocked', true);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Experimental settings enabled.', ToastAndroid.SHORT);
      } else {
        Alert.alert('Developer Mode', 'Experimental settings enabled. Scroll down to see Experimental settings.');
      }
    } else if (nextTaps >= 1 && nextTaps < 5) {
      const remaining = 5 - nextTaps;
      if (Platform.OS === 'android') {
        ToastAndroid.show(`You are ${remaining} tap${remaining === 1 ? '' : 's'} away from unlocking experimental settings.`, ToastAndroid.SHORT);
      } else {
        Alert.alert('Developer Mode', `You are ${remaining} tap${remaining === 1 ? '' : 's'} away from unlocking experimental settings.`);
      }
    }
  }, [logoTaps, settings.developerUnlocked, update]);

  
  const handleExportSettings = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('sheen.settings.v1');
      if (!data) {
        Alert.alert('Export Failed', 'No settings found to export.');
        return;
      }
      const fileUri = `${FileSystem.documentDirectory}sheen_settings.json`;
      await FileSystem.writeAsStringAsync(fileUri, data, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Export', `Settings saved to ${fileUri}`);
      }
    } catch (e) {
      Alert.alert('Export Failed', String(e));
    }
  }, []);

  const handleImportSettings = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileUri = result.assets[0].uri;
        const data = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });
        // basic validation
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') {
          await AsyncStorage.setItem('sheen.settings.v1', data);
          Alert.alert('Import Successful', 'Settings imported. Please restart the app or toggle a setting to refresh UI.', [
            { text: 'OK', onPress: () => {
               // To trigger re-render if needed, we can call update on a dummy or resetAll then update, but simpler to just reload
               
            }}
          ]);
        }
      }
    } catch (e) {
      Alert.alert('Import Failed', String(e));
    }
  }, []);

  const handleClearCache = useCallback(() => {
    haptic();
    Alert.alert(
      'Clear cache?',
      'This removes cached images and metadata. Downloaded apps are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setClearingCache(true);
            try {
              await clearMetadataCache();
              Alert.alert('Cache cleared', 'SHEEN metadata cache has been cleared.');
            } catch {
              Alert.alert('Unable to clear cache', 'Please try again.');
            } finally {
              setClearingCache(false);
            }
          },
        },
      ],
    );
  }, [haptic]);

  const handleSyncRepositories = useCallback(async () => {
    haptic();
    setSyncingRepos(true);
    try {
      await catalog.syncRepositories();
    } finally {
      setSyncingRepos(false);
    }
  }, [catalog, haptic]);

  const handleToggleRepository = useCallback(async (repoId: string, enabled: boolean) => {
    haptic();
    setUpdatingRepoIds((prev) => ({ ...prev, [repoId]: true }));
    try {
      await catalog.setRepositoryEnabled(repoId, enabled);
    } finally {
      setUpdatingRepoIds((prev) => {
        const next = { ...prev };
        delete next[repoId];
        return next;
      });
    }
  }, [catalog, haptic]);

  const handleAddGitHubRepo = useCallback(async (key: string) => {
    haptic();
    const repo = addWellKnownGitHubRepo(key);
    if (!repo) {
      Alert.alert('Unable to add repository', 'This GitHub repository is not available.');
      return;
    }
    setAddingRepoKey(key);
    try {
      await catalog.addRepository(repo, repo.metadata?.github as any);
      setActiveSheet(null);
    } finally {
      setAddingRepoKey(null);
    }
  }, [catalog, haptic]);


  const version = Constants.expoConfig?.version ?? '1.0.0';
  const installerLabel = installerOptions.find((o) => o.key === settings.defaultInstaller)?.label
    ?? INSTALLER_LABELS[settings.defaultInstaller];

  return (
    <TabAnimationWrapper>
      <Animated.View key={settings.theme + settings.accentColor + settings.fontFamily} entering={FadeIn.duration(400)} style={[styles.root, { backgroundColor: "transparent" }]}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
        />

        <PremiumPullToRefresh refreshing={syncingRepos} onRefresh={handleSyncRepositories}>
          {(scrollProps) => (
            <ScrollView
              {...scrollProps}
              style={{ paddingTop: topPad }}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
              showsVerticalScrollIndicator={false}
            >
              {/* ── Settings Header ── */}
              <View style={styles.headerArea}>
                <View style={styles.titleRow}>
                  <Pressable onPress={() => { haptic(); handleLogoTap(); }}>
                    <SheenIcon size={36} style={styles.titleIcon} />
                  </Pressable>
                  <ThemedText style={[styles.screenTitle, { color: colors.foreground }]}>
                    {t('tabs.settings')}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.screenSub, { color: colors.mutedForeground }]}>
                  Customize your app catalog and preferences
                </ThemedText>
              </View>

              {/* ── SHEEN+ Hero Card ── */}
              <Animated.View
                entering={FadeIn.delay(60).duration(520).easing(Easing.out(Easing.cubic))}
                style={styles.heroSection}
              >
                <AnimatedPressable
                  onPress={() => { haptic(); router.push('/sheen-plus'); }}
                  style={[styles.heroCard, { backgroundColor: colors.primary }]}
                >
                  <View style={styles.heroCardHeader}>
                    <View style={[styles.heroCardIcon, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                      <MaterialCommunityIcons name="star-four-points-outline" size={24} color={colors.onPrimary} />
                    </View>
                    <View style={styles.heroCardText}>
                      <ThemedText style={[styles.heroCardTitle, { color: colors.onPrimary }]}>SHEEN+</ThemedText>
                    </View>
                  </View>
                </AnimatedPressable>
              </Animated.View>

          {/* ── 🎨 Appearance ── */}
          <CollapsibleSection emoji="🎨" title={t("settings.appearance")} index={0}>
            <SettingsCard index={0}>
              <SelectRow
                icon="palette-outline"
                title={t("settings.theme")}
                subtitle="Choose the app's color scheme"
                value={THEME_LABELS[settings.themeMode] || 'System'}
                onPress={() => { haptic(); setActiveSheet('theme'); }}
              />
              <SwitchRow
                icon="palette-swatch-outline"
                title={t("settings.materialYou")}
                subtitle="Use dynamic colors from your wallpaper"
                value={settings.materialYou}
                onValueChange={(v) => { haptic(); update('materialYou', v); }}
              />
              {!settings.materialYou && (
                <ActionRow
                  icon="format-color-fill"
                  title="Accent Color"
                  subtitle="Override dynamic theme with a custom accent"
                  onPress={() => { haptic(); setActiveSheet('accentColor'); }}
                />
              )}
              <SelectRow
                icon="format-font"
                title={t("settings.typography")}
                subtitle="Choose the app's font style"
                value={fontLabel}
                onPress={() => { haptic(); setActiveSheet('font'); }}
              />
              <SwitchRow
                icon="circle-half-full"
                title={t("settings.amoled")}
                subtitle="Pure black backgrounds in dark theme"
                value={settings.amoledBlack}
                disabled={settings.themeMode === 'light'}
                onValueChange={(v) => { haptic(); update('amoledBlack', v); }}
              />
</SettingsCard>
          </CollapsibleSection>

          
          {/* ── 🔄 Updates ── */}
          <CollapsibleSection emoji="🔄" title="Updates" index={1}>
            <SettingsCard index={1}>
              <SelectRow
                icon="update"
                title="Auto Check"
                value={getAutoCheckLabel()}
                onPress={() => { haptic(); setActiveSheet('autoCheck'); }}
              />
              <SwitchRow
                icon="wifi"
                title="Wi-Fi only updates"
                value={updateSettings?.wifiOnly ?? true}
                onValueChange={(v) => { haptic(); updateUpdateSettings({ wifiOnly: v }); }}
              />
              <SwitchRow
                icon="power-plug-outline"
                title="Update while charging"
                value={updateSettings?.chargingOnly ?? false}
                onValueChange={(v) => { haptic(); updateUpdateSettings({ chargingOnly: v }); }}
              />
            </SettingsCard>
          </CollapsibleSection>

          {/* ── 🌍 Language ── */}
          <CollapsibleSection emoji="🌍" title={t("settings.language")} index={1}>
            <SettingsCard index={1}>
              <SwitchRow
                icon="cellphone-cog"
                title={t("settings.followSystem")}
                subtitle="Use your device's language automatically"
                value={settings.followSystemLanguage}
                onValueChange={(v) => { haptic(); update('followSystemLanguage', v); }}
              />
              <SelectRow
                icon="translate"
                title={t("settings.appLanguage")}
                subtitle="Choose SHEEN's display language"
                value={LANGUAGE_LABELS[settings.language] ?? settings.language}
                disabled={settings.followSystemLanguage}
                onPress={() => { haptic(); setActiveSheet('language'); }}
              />
            </SettingsCard>
          </CollapsibleSection>

                    {/* ── 📥 Downloads ── */}
          <CollapsibleSection emoji="📥" title={t("settings.downloads")} index={2}>
            <SettingsCard index={2}>
              <ActionRow
                icon="download-multiple-outline"
                title="Open Download Manager"
                subtitle="Monitor, control, and review app downloads"
                onPress={() => { haptic(); router.push('/downloads'); }}
              />
              <SelectRow
                icon="folder-outline"
                title="Download location"
                subtitle="Where downloaded APKs are saved"
                value={DOWNLOAD_LOCATION_LABELS[settings.downloadLocation] ?? settings.downloadLocation}
                onPress={() => { haptic(); setActiveSheet('downloadLocation'); }}
              />
              <SwitchRow
                icon="wifi"
                title="Wi-Fi only downloads"
                subtitle="Avoid using mobile data for downloads"
                value={settings.wifiOnlyDownloads}
                onValueChange={(v) => { haptic(); update('wifiOnlyDownloads', v); }}
              />
              <SwitchRow
                icon="auto-download"
                title="Auto-install after download"
                subtitle="Automatically start installation when download finishes"
                value={settings.autoInstallAfterDownload}
                onValueChange={(v) => { haptic(); update('autoInstallAfterDownload', v); }}
              />
              <SwitchRow
                icon="package-variant-closed"
                title="Keep APK after installation"
                subtitle="Do not delete the downloaded file after installing"
                value={settings.keepApkAfterInstall}
                onValueChange={(v) => { haptic(); update('keepApkAfterInstall', v); }}
              />
              <SwitchRow
                icon="bell-outline"
                title="Download notifications"
                subtitle="Show progress in system notifications"
                value={settings.downloadNotifications}
                onValueChange={(v) => { haptic(); update('downloadNotifications', v); }}
              />
            </SettingsCard>
          </CollapsibleSection>

          {/* ── ⚙️ Installer ── */}
          <CollapsibleSection emoji="⚙️" title={t("settings.installer")} index={3}>
            <SettingsCard index={3}>
              <SelectRow
                icon="package-down"
                title="Default installer"
                subtitle="How SHEEN installs apps"
                value={installerLabel}
                onPress={() => { haptic(); setActiveSheet('installer'); }}
              />
            </SettingsCard>
          </CollapsibleSection>

          {/* ── 🔔 Notifications ── */}
          <CollapsibleSection emoji="🔔" title={t("settings.notifications")} index={4}>
            <SettingsCard index={4}>
              <SwitchRow
                icon="bell-ring-outline"
                title="App updates"
                subtitle="Notify when updates are available"
                value={settings.notifAppUpdates}
                onValueChange={(v) => { haptic(); update('notifAppUpdates', v); }}
              />
              <SwitchRow
                icon="download-outline"
                title="Download progress"
                subtitle="Show progress notifications"
                value={settings.notifDownloadProgress}
                onValueChange={(v) => { haptic(); update('notifDownloadProgress', v); }}
              />
              <SwitchRow
                icon="check-circle-outline"
                title="Installation completed"
                subtitle="Notify when an app finishes installing"
                value={settings.notifInstallCompleted}
                onValueChange={(v) => { haptic(); update('notifInstallCompleted', v); }}
              />
              <SwitchRow
                icon="database-sync-outline"
                title="Repository sync"
                subtitle="Notify when repositories are updated"
                value={settings.notifRepoSync}
                onValueChange={(v) => { haptic(); update('notifRepoSync', v); }}
              />
            </SettingsCard>
          </CollapsibleSection>

          {/* ── ⚡ Performance ── */}
          <CollapsibleSection emoji="⚡" title="Performance" index={5}>
            <SettingsCard index={5}>
              <SwitchRow
                icon="battery-outline"
                title="Battery Saver"
                subtitle="Reduces animations and background tasks"
                value={settings.batterySaver}
                onValueChange={(v) => { haptic(); update('batterySaver', v); update('reduceAnimations', v); }}
              />
              <SwitchRow
                icon="motion-pause-outline"
                title="Reduce Animations"
                subtitle="Minimize motion effects"
                value={settings.reduceAnimations}
                onValueChange={(v) => { haptic(); update('reduceAnimations', v); }}
                disabled={settings.batterySaver}
              />
            </SettingsCard>
          </CollapsibleSection>

          {/* ── 📦 Repositories ── */}
          <CollapsibleSection emoji="📦" title={t("settings.repositories")} index={6}>
            <SettingsCard index={6}>
              <ActionRow
                icon="database-sync-outline"
                title={syncingRepos ? 'Syncing repositories…' : 'Sync now'}
                subtitle="Refresh all enabled repositories"
                onPress={handleSyncRepositories}
              />
              <ActionRow
                icon="database-plus-outline"
                title="Add GitHub repo"
                subtitle="Choose a well-known GitHub repository"
                onPress={() => { haptic(); setActiveSheet('githubRepo'); }}
              />
              {catalog.repositories.map((repo) => {
                const status = repo.lastSyncError
                  ? `Error: ${repo.lastSyncError}`
                  : repo.lastSyncAt
                  ? `Last sync ${new Date(repo.lastSyncAt).toLocaleString()}`
                  : 'Never synced';
                return (
                  <View key={repo.id} style={[styles.repositoryRow, { backgroundColor: colors.card }]}>
                    <View style={styles.repositoryRowMain}>
                      <View style={[styles.repositoryBadge, { backgroundColor: colors.surfaceContainer }]}>
                        <MaterialCommunityIcons
                          name={repo.type === 'github' ? 'github' : 'database-outline'}
                          size={16}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.repositoryRowText}>
                        <ThemedText style={[styles.repositoryName, { color: colors.foreground }]} numberOfLines={1}>
                          {repo.name}
                        </ThemedText>
                        <ThemedText style={[styles.repositoryMeta, { color: colors.mutedForeground }]} numberOfLines={2}>
                          {repositoryTypeLabels[repo.type] ?? repo.type} · {status}
                        </ThemedText>
                      </View>
                    </View>
                    <SwitchRow
                      icon="toggle-switch"
                      title=""
                      value={repo.enabled}
                      onValueChange={(v) => handleToggleRepository(repo.id, v)}
                      disabled={!!updatingRepoIds[repo.id]}
                    />
                  </View>
                );
              })}
            </SettingsCard>
          </CollapsibleSection>

          {/* ── 📊 Data ── */}
          <CollapsibleSection emoji="📊" title={t("settings.data")} index={10}>
            <SettingsCard index={10}>
              <ActionRow
                icon="delete-empty-outline"
                title="Clear cache"
                subtitle="Free up space by removing cached images and data"
                onPress={handleClearCache}
              />
              <ActionRow
                icon="export"
                title="Export settings"
                subtitle="Save your preferences to a file"
                onPress={handleExportSettings}
              />
              <ActionRow
                icon="import"
                title="Import settings"
                subtitle="Restore preferences from a file"
                onPress={handleImportSettings}
              />
            </SettingsCard>
          </CollapsibleSection>

          {/* ── ℹ️ About ── */}
          <CollapsibleSection emoji="ℹ️" title={t("settings.about")} index={11}>
            <SettingsCard index={11}>
              <InfoRow icon="information-outline" title="Version" value={version} onPress={handleLogoTap} />
              <ActionRow
                icon="account-group-outline"
                title="Contributors & Special Thanks"
                onPress={() => router.push('/contributors')}
              />
              <ActionRow
                icon="script-text-outline"
                title="Licenses"
                subtitle="Open-source libraries used by SHEEN"
                onPress={() => router.push('/licenses')}
              />
              <ActionRow
                icon="shield-lock-outline"
                title="Privacy Policy"
                onPress={() => openExternal(LINKS.privacyPolicy)}
                external
              />
              <ActionRow
                icon="text-box-outline"
                title="Changelog"
                subtitle="What's new in SHEEN"
                onPress={() => router.push('/changelog')}
              />
            </SettingsCard>
          </CollapsibleSection>

          {/* ── 🧪 Experimental settings (Beta) ── */}
          {settings.developerUnlocked && (
            <CollapsibleSection emoji="🧪" title="Experimental settings (Beta)" index={12}>
              <View style={{ paddingHorizontal: 16, paddingVertical: 8, marginBottom: 8 }}>
                <ThemedText style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 18 }}>
                  Experimental features for testing. The app may behave abnormally after enabling any setting.
                </ThemedText>
              </View>

              <ThemedText style={{ fontSize: 13, fontWeight: '600', marginLeft: 16, marginBottom: 8, color: colors.primary, textTransform: 'uppercase' }}>Seasonal Effects</ThemedText>
              <SettingsCard index={12}>
                <SelectRow
                  icon="eye-outline"
                  title="Active Effect"
                  subtitle="Choose a seasonal effect to display"
                  value={SEASONAL_PREVIEW_LABELS[settings.seasonalEffectsPreview]}
                  onPress={() => { haptic(); setActiveSheet('seasonalPreview'); }}
                />
              </SettingsCard>
              
              <View style={{ height: 16 }} />
              
              <ThemedText style={{ fontSize: 13, fontWeight: '600', marginLeft: 16, marginBottom: 8, color: colors.primary, textTransform: 'uppercase' }}>Language</ThemedText>
              <SettingsCard index={13}>
                <ActionRow
                  icon="translate"
                  title="Kashmiri"
                  subtitle="Experimental translation. Sets the app language to Kashmiri."
                  badge="Experimental"
                  onPress={() => {
                     haptic();
                     update('language', 'ks');
                     update('followSystemLanguage', false);
                     if (Platform.OS === 'android') {
                        ToastAndroid.show('Language set to Kashmiri', ToastAndroid.SHORT);
                     }
                  }}
                />
              </SettingsCard>
              <View style={{ height: 16 }} />
              
              <ThemedText style={{ fontSize: 13, fontWeight: '600', marginLeft: 16, marginBottom: 8, color: colors.primary, textTransform: 'uppercase' }}>Danger Zone</ThemedText>
              <SettingsCard index={14}>
                <ActionRow
                  icon="lock-outline"
                  title="Hide Experimental settings"
                  subtitle="This will lock and hide the experimental settings menu."
                  onPress={() => {
                     haptic();
                     update('developerUnlocked', false);
                     setLogoTaps(0);
                     if (Platform.OS === 'android') {
                        ToastAndroid.show('Experimental settings hidden.', ToastAndroid.SHORT);
                     }
                  }}
                />
              </SettingsCard>
              <View style={{ height: 16 }} />
            </CollapsibleSection>
          )}

        </ScrollView>
        )}
      </PremiumPullToRefresh>

        {/* ── Select sheets ── */}
        {activeSheet === 'autoCheck' && (
          <SelectSheet
            title="Auto Check"
            options={AUTO_CHECK_OPTIONS}
            current={updateSettings?.autoCheckMode === 'auto' ? (updateSettings.wifiOnly ? 'wifiOnly' : 'auto') : updateSettings?.autoCheckMode}
            onSelect={(v) => {
              if (v === 'auto') updateUpdateSettings({ autoCheckMode: 'auto', wifiOnly: false });
              else if (v === 'wifiOnly') updateUpdateSettings({ autoCheckMode: 'auto', wifiOnly: true });
              else updateUpdateSettings({ autoCheckMode: v as any });
              setActiveSheet(null);
            }}
            onClose={() => setActiveSheet(null)}
            bottomInset={insets.bottom}
          />
        )}
        {activeSheet === 'theme' && (
          <SelectSheet
            title={t("settings.theme")}
            options={THEME_OPTIONS}
            current={settings.themeMode}
            onSelect={(v) => update('themeMode', v)}
            onClose={() => setActiveSheet(null)}
            bottomInset={insets.bottom}
          />
        )}
        {activeSheet === 'language' && (
          <SelectSheet
            title={t("settings.appLanguage")}
            options={LANGUAGE_OPTIONS}
            current={settings.language}
            onSelect={(v) => update('language', v)}
            onClose={() => setActiveSheet(null)}
            bottomInset={insets.bottom}
          />
        )}
        {activeSheet === 'downloadLocation' && (
          <SelectSheet
            title="Download location"
            options={DOWNLOAD_LOCATION_OPTIONS}
            current={settings.downloadLocation}
            onSelect={(v) => update('downloadLocation', v)}
            onClose={() => setActiveSheet(null)}
            bottomInset={insets.bottom}
          />
        )}
        {activeSheet === 'installer' && (
          <SelectSheet
            title="Default installer"
            options={installerOptions}
            current={settings.defaultInstaller}
            onSelect={(v) => update('defaultInstaller', v)}
            onClose={() => setActiveSheet(null)}
            bottomInset={insets.bottom}
            radioMode
          />
        )}
        {activeSheet === 'font' && (
          <SelectSheet
            title={t("settings.typography")}
            options={FONT_OPTIONS}
            current={settings.fontFamily}
            onSelect={(v) => update('fontFamily', v)}
            onClose={() => setActiveSheet(null)}
            bottomInset={insets.bottom}
          />
        )}
        {activeSheet === 'githubRepo' && (
          <SelectSheet
            title="Add GitHub repo"
            options={githubRepoEntries.map(({ key, config }) => ({
              key,
              label: config.repo,
              description: `${config.owner}/${config.repo}${config.packageName ? ` · ${config.packageName}` : ''}`,
              icon: 'github',
              badge: addingRepoKey === key ? 'Adding…' : undefined,
            }))}
            current={null as any}
            onSelect={(v) => { handleAddGitHubRepo(v); }}
            onClose={() => setActiveSheet(null)}
            bottomInset={insets.bottom}
          />
        )}
        {activeSheet === 'accentColor' && (
          <AccentColorSheet
            current={settings.accentColor || '#2196F3'}
            onSelect={(v) => update('accentColor', v)}
            onClose={() => setActiveSheet(null)}
            bottomInset={insets.bottom}
          />
        )}
        {activeSheet === 'seasonalPreview' && (
          <SelectSheet
            title="Seasonal Effect"
            options={SEASONAL_PREVIEW_OPTIONS}
            current={settings.seasonalEffectsPreview}
            onSelect={(v) => update('seasonalEffectsPreview', v as SeasonalEffectPreview)}
            onClose={() => setActiveSheet(null)}
            bottomInset={insets.bottom}
          />
        )}

      </Animated.View>
    </TabAnimationWrapper>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4 },

  headerArea: { marginBottom: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  titleIcon: { borderRadius: 7, overflow: 'hidden' },
  screenTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4, lineHeight: 34 },
  screenSub: { fontSize: 14, marginTop: 4, lineHeight: 19 },

  heroSection: { marginBottom: 22 },
  heroCard: { borderRadius: 28, padding: 20, gap: 18 },
  heroCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroCardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heroCardText: { flex: 1, gap: 2 },
  heroCardTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2, lineHeight: 24 },
  heroCardSub: { fontSize: 13, lineHeight: 18, opacity: 0.92 },
  heroCardActions: { flexDirection: 'row', gap: 10 },
  heroCardButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 18,
  },
  heroCardButtonText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },
  repositoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  repositoryRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  repositoryBadge: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  repositoryRowText: { flex: 1, gap: 2, minWidth: 0 },
  repositoryName: { fontSize: 15, fontWeight: '600' },
  repositoryMeta: { fontSize: 12.5, lineHeight: 16 },
});
