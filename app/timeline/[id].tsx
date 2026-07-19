import React, { useMemo, useState, useEffect } from 'react';
import {
  Platform,
  StatusBar,
  StyleSheet,
  View,
  Dimensions,
  ScrollView,
  Pressable,
  TextInput,
  Share,
  Alert,
  FlatList,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  LinearTransition,
  withSpring,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { App, VersionInfo } from '@/lib/types';
import { useCatalog } from '@/contexts/CatalogContext';
import { formatBytes, useDownloads, useAppDownload } from '@/hooks/useDownloads';
import { useColors, useEffectiveColorScheme } from '@/hooks/useColors';
import { ThemedText } from '@/components/ThemedText';
import { AppDetailsSkeleton } from '@/components/Skeleton';
import { AnimatedPressable } from '@/components/settings/SettingsPrimitives';
import { SourceBadge } from '@/components/SourceBadge';
import { ChangelogRenderer } from '@/components/updates/ChangelogRenderer';
import { getInstalledApps } from '@/lib/services/UpdateManager';
import { emitNotification } from '@/lib/services/NotificationService';

const { width: windowWidth } = Dimensions.get('window');

// Helper to resolve friendly Android OS version names from SDK integer
function getFriendlyAndroidVersion(sdkInt?: number): string {
  if (!sdkInt) return 'Android 5.0+';
  const versions: Record<number, string> = {
    19: 'Android 4.4',
    21: 'Android 5.0',
    22: 'Android 5.1',
    23: 'Android 6.0',
    24: 'Android 7.0',
    25: 'Android 7.1',
    26: 'Android 8.0',
    27: 'Android 8.1',
    28: 'Android 9.0',
    29: 'Android 10',
    30: 'Android 11',
    31: 'Android 12',
    32: 'Android 12L',
    33: 'Android 13',
    34: 'Android 14',
    35: 'Android 15',
  };
  return versions[sdkInt] || `API ${sdkInt}`;
}

// Heuristics to identify the release type of a version
function getReleaseType(versionName: string): 'Stable' | 'Beta' | 'Alpha' | 'Nightly' {
  const name = versionName.toLowerCase();
  if (name.includes('beta') || name.includes('-b') || name.includes('rc') || name.includes('-pre')) {
    return 'Beta';
  }
  if (name.includes('alpha') || name.includes('-a') || name.includes('dev') || name.includes('canary')) {
    return 'Alpha';
  }
  if (name.includes('nightly') || name.includes('debug') || name.includes('test')) {
    return 'Nightly';
  }
  return 'Stable';
}

interface HighlightBadge {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  type: string;
}

// Compare two versions to find difference highlights (current vs previous older version)
function getChangeHighlights(current: VersionInfo, previous?: VersionInfo): HighlightBadge[] {
  const highlights: HighlightBadge[] = [];
  if (!previous) return highlights;

  // 1. Major version upgrade detection
  const curParts = current.versionName.split(/[.-]/);
  const prevParts = previous.versionName.split(/[.-]/);
  if (curParts[0] && prevParts[0] && curParts[0] !== prevParts[0]) {
    highlights.push({
      label: `Major Upgrade (${prevParts[0]} → ${curParts[0]})`,
      icon: 'arrow-up-bold-circle',
      color: '#6200EE',
      type: 'major',
    });
  }

  // 2. Significant APK size change detection (>= 10% change and >= 500KB difference)
  if (current.sizeBytes && previous.sizeBytes) {
    const diff = current.sizeBytes - previous.sizeBytes;
    const pct = (diff / previous.sizeBytes) * 100;
    if (Math.abs(pct) >= 10 && Math.abs(diff) > 500 * 1024) {
      if (diff > 0) {
        highlights.push({
          label: `Size increased +${formatBytes(diff)} (+${pct.toFixed(0)}%)`,
          icon: 'arrow-up-bold',
          color: '#B3261E',
          type: 'size_inc',
        });
      } else {
        highlights.push({
          label: `Size decreased -${formatBytes(Math.abs(diff))} (-${Math.abs(pct).toFixed(0)}%)`,
          icon: 'arrow-down-bold',
          color: '#1B5E20',
          type: 'size_dec',
        });
      }
    }
  }

  // 3. Android requirement changes
  if (current.minSdk && previous.minSdk && current.minSdk !== previous.minSdk) {
    highlights.push({
      label: `Min OS: Android ${getFriendlyAndroidVersion(previous.minSdk)} → ${getFriendlyAndroidVersion(current.minSdk)}`,
      icon: 'android',
      color: '#FF9100',
      type: 'min_sdk',
    });
  }
  if (current.targetSdk && previous.targetSdk && current.targetSdk !== previous.targetSdk) {
    highlights.push({
      label: `Target OS: Android ${getFriendlyAndroidVersion(previous.targetSdk)} → ${getFriendlyAndroidVersion(current.targetSdk)}`,
      icon: 'android-studio',
      color: '#00B0FF',
      type: 'target_sdk',
    });
  }

  // 4. Permission changes
  const curPerms = current.permissions || [];
  const prevPerms = previous.permissions || [];
  const addedPerms = curPerms.filter((p) => !prevPerms.includes(p));
  const removedPerms = prevPerms.filter((p) => !curPerms.includes(p));

  if (addedPerms.length > 0) {
    highlights.push({
      label: `New Permissions: +${addedPerms.length}`,
      icon: 'shield-alert-outline',
      color: '#D81B60',
      type: 'perms_added',
    });
  }
  if (removedPerms.length > 0) {
    highlights.push({
      label: `Permissions Removed: -${removedPerms.length}`,
      icon: 'shield-check-outline',
      color: '#43A047',
      type: 'perms_removed',
    });
  }

  return highlights;
}

export default function AppTimelineScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getAppById, apps, isLoading: catalogLoading } = useCatalog();
  const { startDownload } = useDownloads();

  const app = useMemo(() => getAppById(Array.isArray(id) ? id[0] : id), [getAppById, id]);
  const accent = app?.color ?? colors.primary;

  const [installedVersion, setInstalledVersion] = useState<{
    packageName: string;
    versionName: string;
    versionCode: number;
    installedAt: number;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'stable' | 'beta' | 'alpha' | 'major' | 'minor'>('all');
  const [visibleCount, setVisibleCount] = useState(8);
  const [expandedChangelogs, setExpandedChangelogs] = useState<Record<number, boolean>>({});
  const [timelineCacheState, setTimelineCacheState] = useState<'loading' | 'loaded'>('loading');

  // Load installed app state
  useEffect(() => {
    async function checkInstalled() {
      if (!app) return;
      try {
        const installed = await getInstalledApps();
        const found = installed.find((a) => a.packageName === app.packageName);
        setInstalledVersion(found || null);
      } catch (err) {
        console.error('[Timeline] Error getting installed apps:', err);
      }
    }
    checkInstalled();
  }, [app]);

  // Read search filter from local cache after first load
  useEffect(() => {
    async function loadCache() {
      if (!app) return;
      try {
        const cachedFilter = await AsyncStorage.getItem(`@sheen:timeline:filter:${app.id}`);
        if (cachedFilter) {
          setSelectedFilter(cachedFilter as any);
        }
      } catch (e) {
        console.warn('Error reading timeline cache:', e);
      } finally {
        setTimelineCacheState('loaded');
      }
    }
    loadCache();
  }, [app]);

  // Persist filter configuration locally to cache timeline state
  const handleFilterChange = async (filter: typeof selectedFilter) => {
    setSelectedFilter(filter);
    if (app) {
      try {
        await AsyncStorage.setItem(`@sheen:timeline:filter:${app.id}`, filter);
      } catch (e) {
        console.warn('Error writing timeline cache:', e);
      }
    }
  };

  // Sort and process versions chronologically (newest first, comparing with previous older versions)
  const processedVersions = useMemo(() => {
    if (!app || !app.versions) return [];

    // Ensure we sort with highest versionCode first (newest)
    const sorted = [...app.versions].sort((a, b) => b.versionCode - a.versionCode);

    return sorted.map((v, index) => {
      // The previous chronologically older version is the next item in the sorted array (index + 1)
      const previous = sorted[index + 1];
      const highlights = getChangeHighlights(v, previous);
      const releaseType = getReleaseType(v.versionName);
      const isMajorRelease = previous ? v.versionName.split('.')[0] !== previous.versionName.split('.')[0] : true;

      return {
        ...v,
        releaseType,
        highlights,
        isMajorRelease,
        releaseDateFormatted: new Date(v.added).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      };
    });
  }, [app]);

  // Filter and search versions
  const filteredVersions = useMemo(() => {
    let result = processedVersions;

    // Search query match
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (v) =>
          v.versionName.toLowerCase().includes(query) ||
          v.versionCode.toString().includes(query) ||
          (v.changelog && v.changelog.toLowerCase().includes(query))
      );
    }

    // Filter type match
    if (selectedFilter === 'stable') {
      result = result.filter((v) => v.releaseType === 'Stable');
    } else if (selectedFilter === 'beta') {
      result = result.filter((v) => v.releaseType === 'Beta');
    } else if (selectedFilter === 'alpha') {
      result = result.filter((v) => v.releaseType === 'Alpha' || v.releaseType === 'Nightly');
    } else if (selectedFilter === 'major') {
      result = result.filter((v) => v.isMajorRelease);
    } else if (selectedFilter === 'minor') {
      result = result.filter((v) => !v.isMajorRelease);
    }

    return result;
  }, [processedVersions, searchQuery, selectedFilter]);

  if (catalogLoading && !app) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <AppDetailsSkeleton />
      </View>
    );
  }

  if (!app) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <MaterialCommunityIcons name="timeline-alert-outline" size={64} color={colors.mutedForeground} />
        <ThemedText style={[styles.errorTitle, { color: colors.foreground }]}>Application not found</ThemedText>
        <AnimatedPressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.primaryContainer }]}>
          <ThemedText style={{ color: colors.onPrimaryContainer, fontWeight: '700' }}>Go Back</ThemedText>
        </AnimatedPressable>
      </View>
    );
  }

  // Handle version copying
  const handleCopyVersion = async (versionName: string) => {
    await Clipboard.setStringAsync(versionName);
    Alert.alert('Copied', `Version ${versionName} copied to clipboard.`);
  };

  // Handle sharing of a release
  const handleShareRelease = async (version: typeof processedVersions[number]) => {
    try {
      let msg = `📦 ${app.name} Release\n`;
      msg += `Version: v${version.versionName} (${version.versionCode})\n`;
      msg += `Released: ${version.releaseDateFormatted}\n`;
      msg += `Type: ${version.releaseType}\n`;
      if (version.sizeBytes) msg += `Size: ${formatBytes(version.sizeBytes)}\n`;
      if (version.changelog) msg += `\nChangelog:\n${version.changelog}\n`;
      msg += `\nDiscover more on SHEEN Store.`;

      await Share.share({
        message: msg,
        title: `${app.name} v${version.versionName}`,
      });
    } catch (e) {
      console.warn('Share release error:', e);
    }
  };

  // Rollback or download install action
  const handleDownloadRelease = (version: typeof processedVersions[number]) => {
    if (!version.apkUrl) return;

    const isCurrent = installedVersion?.versionCode === version.versionCode;
    const isRollback = installedVersion && installedVersion.versionCode > version.versionCode;

    const proceedWithDownload = () => {
      startDownload({
        appId: app.id,
        name: app.name,
        developer: app.developer,
        letter: app.letter ?? app.name[0],
        color: accent,
        version: version.versionName,
        sizeBytes: version.sizeBytes,
        apkUrl: version.apkUrl,
        repositoryId: app.repositoryId,
        iconUrl: app.iconUrl,
      });

      emitNotification(
        'download_started',
        'Download Started',
        `Downloading ${app.name} v${version.versionName}`,
        { appId: app.id, packageName: app.packageName }
      ).catch(() => {});
    };

    if (isRollback) {
      Alert.alert(
        'Downgrade Application?',
        `This will roll ${app.name} back to an older version. Older versions may be incompatible with your current data and settings, and might lack security updates.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Install Anyway', style: 'destructive', onPress: proceedWithDownload },
        ]
      );
    } else {
      proceedWithDownload();
    }
  };

  // Toggle changelog visibility
  const toggleChangelog = (versionCode: number) => {
    setExpandedChangelogs((prev) => ({
      ...prev,
      [versionCode]: !prev[versionCode],
    }));
  };

  // Lazy loading handler
  const handleLoadMore = () => {
    if (visibleCount < filteredVersions.length) {
      setVisibleCount((prev) => prev + 8);
    }
  };

  // Header Component
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.appBar}>
        <AnimatedPressable onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.surfaceContainer }]}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.foreground} />
        </AnimatedPressable>
        <View style={styles.headerTextWrap}>
          <ThemedText style={[styles.title, { color: colors.foreground }]}>Smart Timeline</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {app.name} · {app.developer}
          </ThemedText>
        </View>
        <View style={[styles.cachedBadge, { backgroundColor: colors.surfaceContainerHighest }]}>
          <MaterialCommunityIcons name="database-check" size={14} color={colors.primary} />
          <ThemedText style={[styles.cachedBadgeText, { color: colors.primary }]}>Local</ThemedText>
        </View>
      </View>

      {/* App Quick Summary Card */}
      <View style={[styles.summaryCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <View style={[styles.appLetterIcon, { backgroundColor: accent }]}>
            <ThemedText style={styles.appLetterText}>{app.letter ?? app.name[0]}</ThemedText>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <ThemedText style={[styles.summaryAppName, { color: colors.foreground }]}>{app.name}</ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <SourceBadge source={app.source} />
              <ThemedText style={{ color: colors.mutedForeground, fontSize: 12 }}>
                {processedVersions.length} Available Releases
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      {/* Search Input */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.mutedForeground} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search versions or release notes..."
          placeholderTextColor={colors.mutedForeground}
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            setVisibleCount(8); // Reset pagination on search
          }}
          accessibilityLabel="Search specific version"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
            <MaterialCommunityIcons name="close-circle" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {/* Filter Chips Scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={{ paddingRight: 24 }}>
        {[
          { id: 'all', label: 'All Releases', icon: 'all-inclusive' },
          { id: 'stable', label: 'Stable Only', icon: 'check-decagram' },
          { id: 'beta', label: 'Beta / RC', icon: 'flask-outline' },
          { id: 'alpha', label: 'Alpha / Dev', icon: 'bug-outline' },
          { id: 'major', label: 'Major Milestones', icon: 'trophy-outline' },
          { id: 'minor', label: 'Minor Updates', icon: 'chevron-triple-up' },
        ].map((f) => {
          const isSelected = selectedFilter === f.id;
          return (
            <Pressable
              key={f.id}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isSelected ? accent : colors.surfaceContainer,
                  borderColor: isSelected ? accent : colors.border,
                },
              ]}
              onPress={() => handleFilterChange(f.id as any)}
            >
              <MaterialCommunityIcons name={f.icon as any} size={15} color={isSelected ? '#ffffff' : colors.mutedForeground} />
              <ThemedText style={[styles.filterChipText, { color: isSelected ? '#ffffff' : colors.foreground }]}>
                {f.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  // Timeline Item Card Renderer
  const renderTimelineItem = ({ item, index }: { item: typeof processedVersions[number]; index: number }) => {
    const isLatest = index === 0;
    const isInstalled = installedVersion?.versionCode === item.versionCode;
    const isChangelogExpanded = !!expandedChangelogs[item.versionCode];

    // Release Type Config
    const releaseTypeColors: Record<string, { bg: string; text: string }> = {
      Stable: { bg: '#E4F5E7', text: '#1B5E20' },
      Beta: { bg: '#FFF3D6', text: '#8A5A00' },
      Alpha: { bg: '#FDE2E1', text: '#B3261E' },
      Nightly: { bg: '#EDE7F6', text: '#5E35B1' },
    };

    const typeStyle = releaseTypeColors[item.releaseType] || { bg: colors.surfaceContainer, text: colors.foreground };

    return (
      <Animated.View
        entering={FadeInUp.delay(index < 4 ? index * 80 : 0)
          .duration(500)
          .springify()
          .damping(22)}
        layout={LinearTransition.springify()}
        style={styles.timelineRow}
      >
        {/* Left column: Timeline line and node */}
        <View style={styles.timelineColumn}>
          <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
          <View
            style={[
              styles.timelineNode,
              {
                borderColor: isInstalled ? '#2E7D32' : isLatest ? accent : colors.border,
                backgroundColor: isInstalled ? '#E8F5E9' : isLatest ? `${accent}15` : colors.background,
              },
            ]}
          >
            <View
              style={[
                styles.timelineDotInner,
                {
                  backgroundColor: isInstalled ? '#2E7D32' : isLatest ? accent : colors.mutedForeground,
                },
              ]}
            />
          </View>
        </View>

        {/* Right column: Card details */}
        <View style={{ flex: 1, paddingBottom: 24 }}>
          <View
            style={[
              styles.releaseCard,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: isInstalled ? '#2E7D32' : isLatest ? accent : colors.border,
                borderWidth: isInstalled || isLatest ? 1.5 : 1,
              },
            ]}
          >
            {/* Highlights Header Line */}
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <ThemedText style={[styles.versionTitleText, { color: colors.foreground }]}>
                    v{item.versionName}
                  </ThemedText>

                  {/* Release Type Badge */}
                  <View style={[styles.badge, { backgroundColor: typeStyle.bg }]}>
                    <ThemedText style={[styles.badgeText, { color: typeStyle.text }]}>
                      {item.releaseType}
                    </ThemedText>
                  </View>

                  {/* Highlighting badging */}
                  {isLatest && (
                    <View style={[styles.badge, { backgroundColor: `${accent}18` }]}>
                      <ThemedText style={[styles.badgeText, { color: accent, fontWeight: '800' }]}>
                        LATEST
                      </ThemedText>
                    </View>
                  )}

                  {isInstalled && (
                    <View style={[styles.badge, { backgroundColor: '#E8F5E9' }]}>
                      <ThemedText style={[styles.badgeText, { color: '#2E7D32', fontWeight: '800' }]}>
                        INSTALLED
                      </ThemedText>
                    </View>
                  )}
                </View>

                <ThemedText style={[styles.releaseDateText, { color: colors.mutedForeground }]}>
                  Released {item.releaseDateFormatted}
                </ThemedText>
              </View>

              <ThemedText style={[styles.versionCodeText, { color: colors.mutedForeground }]}>
                #{item.versionCode}
              </ThemedText>
            </View>

            {/* Quick Specs Grid */}
            <View style={[styles.specsGrid, { borderColor: colors.border }]}>
              <View style={styles.gridCell}>
                <MaterialCommunityIcons name="content-save-outline" size={14} color={colors.mutedForeground} />
                <ThemedText style={[styles.gridText, { color: colors.foreground }]}>
                  {item.sizeBytes ? formatBytes(item.sizeBytes) : '—'}
                </ThemedText>
              </View>
              <View style={styles.gridCell}>
                <MaterialCommunityIcons name="android" size={14} color={colors.mutedForeground} />
                <ThemedText style={[styles.gridText, { color: colors.foreground }]}>
                  Min OS {item.minSdk ? getFriendlyAndroidVersion(item.minSdk) : '5.0+'}
                </ThemedText>
              </View>
              <View style={styles.gridCell}>
                <MaterialCommunityIcons name="android-studio" size={14} color={colors.mutedForeground} />
                <ThemedText style={[styles.gridText, { color: colors.foreground }]}>
                  Target {item.targetSdk ? getFriendlyAndroidVersion(item.targetSdk) : '14'}
                </ThemedText>
              </View>
            </View>

            {/* Automatic Change Highlight Badges */}
            {item.highlights && item.highlights.length > 0 && (
              <View style={styles.highlightsContainer}>
                <ThemedText style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  NOTABLE EVOLUTIONS
                </ThemedText>
                <View style={styles.badgeWrap}>
                  {item.highlights.map((hl, index) => (
                    <View
                      key={index}
                      style={[styles.highlightBadge, { backgroundColor: `${hl.color}10`, borderColor: `${hl.color}40` }]}
                    >
                      <MaterialCommunityIcons name={hl.icon} size={14} color={hl.color} style={{ marginRight: 4 }} />
                      <ThemedText style={[styles.highlightBadgeText, { color: hl.color }]}>
                        {hl.label}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Expanded Changelog Area */}
            {isChangelogExpanded && (
              <Animated.View entering={FadeIn.duration(200)} style={styles.changelogExpandedContainer}>
                <ThemedText style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 6 }]}>
                  CHANGELOG / NOTES
                </ThemedText>
                <ChangelogRenderer changelog={item.changelog} colors={colors} />
              </Animated.View>
            )}

            {/* Bottom Actions Row */}
            <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
              {item.changelog ? (
                <Pressable
                  onPress={() => toggleChangelog(item.versionCode)}
                  style={styles.actionBtn}
                  accessibilityLabel="Toggle release notes visibility"
                >
                  <MaterialCommunityIcons
                    name={isChangelogExpanded ? 'chevron-up' : 'text-box-outline'}
                    size={16}
                    color={accent}
                  />
                  <ThemedText style={[styles.actionBtnText, { color: accent }]}>
                    {isChangelogExpanded ? 'Hide Notes' : 'Changelog'}
                  </ThemedText>
                </Pressable>
              ) : (
                <View style={styles.actionBtnDisabled}>
                  <MaterialCommunityIcons name="text-box-remove-outline" size={16} color={colors.mutedForeground} />
                  <ThemedText style={[styles.actionBtnTextDisabled, { color: colors.mutedForeground }]}>
                    No Notes
                  </ThemedText>
                </View>
              )}

              <Pressable
                onPress={() => handleCopyVersion(item.versionName)}
                style={styles.actionBtn}
                accessibilityLabel="Copy version code to clipboard"
              >
                <MaterialCommunityIcons name="content-copy" size={16} color={colors.foreground} />
                <ThemedText style={[styles.actionBtnText, { color: colors.foreground }]}>Copy</ThemedText>
              </Pressable>

              <Pressable
                onPress={() => handleShareRelease(item)}
                style={styles.actionBtn}
                accessibilityLabel="Share details of this release"
              >
                <MaterialCommunityIcons name="share-variant-outline" size={16} color={colors.foreground} />
                <ThemedText style={[styles.actionBtnText, { color: colors.foreground }]}>Share</ThemedText>
              </Pressable>

              {/* Install or roll back */}
              {item.apkUrl ? (
                <Pressable
                  onPress={() => handleDownloadRelease(item)}
                  style={[
                    styles.actionBtnDownload,
                    {
                      backgroundColor: isInstalled ? colors.surfaceContainerHighest : accent,
                    },
                  ]}
                  accessibilityLabel="Download or rollback to this version"
                >
                  <MaterialCommunityIcons
                    name={isInstalled ? 'check' : 'download-outline'}
                    size={15}
                    color={isInstalled ? colors.foreground : '#ffffff'}
                  />
                  <ThemedText
                    style={[
                      styles.actionBtnDownloadText,
                      { color: isInstalled ? colors.foreground : '#ffffff' },
                    ]}
                  >
                    {isInstalled ? 'Current' : 'Install'}
                  </ThemedText>
                </Pressable>
              ) : (
                <View style={styles.actionBtnDisabled}>
                  <MaterialCommunityIcons name="download-off-outline" size={15} color={colors.mutedForeground} />
                  <ThemedText style={[styles.actionBtnTextDisabled, { color: colors.mutedForeground }]}>
                    Unavailable
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  // Render Footer for Infinite list / end state
  const renderFooter = () => {
    if (filteredVersions.length === 0) {
      return (
        <Animated.View entering={FadeIn.duration(400)} style={styles.emptyStateContainer}>
          <MaterialCommunityIcons name="history-empty" size={60} color={colors.mutedForeground} />
          <ThemedText style={[styles.emptyStateTitle, { color: colors.foreground }]}>No Releases Found</ThemedText>
          <ThemedText style={[styles.emptyStateSub, { color: colors.mutedForeground }]}>
            No version matched your current filters or search query.
          </ThemedText>
        </Animated.View>
      );
    }

    const hasMore = visibleCount < filteredVersions.length;

    return (
      <View style={styles.footerContainer}>
        {hasMore ? (
          <AnimatedPressable
            onPress={handleLoadMore}
            style={[styles.loadMoreButton, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}
          >
            <ThemedText style={{ color: accent, fontWeight: '700' }}>Load Older Releases</ThemedText>
            <MaterialCommunityIcons name="chevron-down" size={20} color={accent} style={{ marginLeft: 4 }} />
          </AnimatedPressable>
        ) : (
          <View style={styles.endOfTimeline}>
            <View style={[styles.lineSpacer, { backgroundColor: colors.border }]} />
            <ThemedText style={[styles.endOfTimelineText, { color: colors.mutedForeground }]}>
              Beginning of App History Reached
            </ThemedText>
            <View style={[styles.lineSpacer, { backgroundColor: colors.border }]} />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      <FlatList
        data={filteredVersions.slice(0, visibleCount)}
        keyExtractor={(item) => item.versionCode.toString()}
        renderItem={renderTimelineItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top, paddingBottom: insets.bottom + 40 }]}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  headerContainer: { paddingBottom: 16 },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTextWrap: { flex: 1, marginLeft: 16, gap: 2 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontWeight: '600' },
  cachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  cachedBadgeText: { fontSize: 11, fontWeight: '800' },

  summaryCard: {
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 12,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  appLetterIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appLetterText: { color: '#ffffff', fontSize: 22, fontWeight: '900' },
  summaryAppName: { fontSize: 16, fontWeight: '800' },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 16,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },

  filtersScroll: { marginTop: 14, flexDirection: 'row' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    gap: 6,
  },
  filterChipText: { fontSize: 13, fontWeight: '700' },

  // Timeline Layout Styles
  timelineRow: { flexDirection: 'row' },
  timelineColumn: { width: 40, alignItems: 'center', position: 'relative' },
  timelineLine: { width: 2, position: 'absolute', top: 0, bottom: 0, left: 19 },
  timelineNode: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    zIndex: 10,
  },
  timelineDotInner: { width: 8, height: 8, borderRadius: 4 },

  releaseCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginLeft: 8,
    gap: 12,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  versionTitleText: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  releaseDateText: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  versionCodeText: { fontSize: 12, fontWeight: '700', opacity: 0.7 },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 9.5, fontWeight: '800' },

  specsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
  },
  gridCell: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  gridText: { fontSize: 11, fontWeight: '700' },

  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginBottom: 2 },
  highlightsContainer: { gap: 6 },
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  highlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  highlightBadgeText: { fontSize: 11, fontWeight: '700' },

  changelogExpandedContainer: { marginTop: 4, gap: 4 },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  actionBtnDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    opacity: 0.5,
  },
  actionBtnTextDisabled: { fontSize: 12, fontWeight: '600' },
  actionBtnDownload: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1.5,
  },
  actionBtnDownloadText: { fontSize: 12, fontWeight: '800' },

  // Footer / Empty States Styles
  footerContainer: { paddingVertical: 24, alignItems: 'center' },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  endOfTimeline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  lineSpacer: { height: 1, flex: 1, opacity: 0.3 },
  endOfTimelineText: { fontSize: 12, fontWeight: '700' },

  emptyStateContainer: { paddingVertical: 48, alignItems: 'center', gap: 12 },
  emptyStateTitle: { fontSize: 18, fontWeight: '800' },
  emptyStateSub: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },

  errorTitle: { fontSize: 18, fontWeight: '800', marginTop: 12, marginBottom: 16 },
  backButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 },
});
