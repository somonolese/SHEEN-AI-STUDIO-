import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { materialCardEnter } from "../../components/animations";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useColors } from '@/hooks/useColors';
import { useTypography } from '@/hooks/useTypography';
import { useDownloads, formatBytes, formatSpeed, formatEta } from '@/hooks/useDownloads';
import { AppIconWithRing } from '@/components/downloads/AppIconWithRing';
import { ThemedText } from '@/components/ThemedText';
import { shareApp } from '@/lib/share';
import { DownloadTask } from '@/lib/types';
import { ProgressIndicator } from '@/components/ProgressIndicator';
import { ShimmerLoading } from '@/components/ShimmerLoading';
import { SkeletonIcon } from '@/components/Skeleton';
import * as Haptics from 'expo-haptics';

type TabType = 'active' | 'queued' | 'installing' | 'completed' | 'failed';

function InstallingProgressBar({ item, colors, fonts }: { item: DownloadTask; colors: any; fonts: any }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 5000; // LegacyInstaller duration is exactly 5000ms
    const startTime = Date.now();
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(elapsed / duration, 1.0);
      setProgress(pct);
      if (pct >= 1.0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [item.id]);

  return (
    <View style={styles.progressContainer}>
      <View style={styles.statsRow}>
        <ThemedText style={[styles.statsText, { color: colors.onSurfaceVariant, fontFamily: fonts.medium }]}>
          Installing package on your system...
        </ThemedText>
        <ThemedText style={[styles.statsText, { color: colors.primary, fontFamily: fonts.semibold }]}>
          {Math.round(progress * 100)}%
        </ThemedText>
      </View>
      <ProgressIndicator
        progress={progress}
        color={colors.primary}
        height={4}
      />
    </View>
  );
}

export default function DownloadManagerScreen() {
  const colors = useColors();
  const fonts = useTypography();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  const isRailMode = windowWidth >= 600;
  const topPad = Platform.OS === 'web' ? 16 : insets.top;
  const bottomPad = isRailMode ? insets.bottom + 16 : insets.bottom + 24;

  const {
    tasks,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    retryDownload,
    clearCompleted,
    installTask,
    pauseAll,
    resumeAll,
    cancelAllQueued,
    retryAllFailed,
    reorderQueued,
  } = useDownloads();

  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'size'>('newest');

  // Compute counts for each category
  const counts = useMemo(() => {
    const active = tasks.filter(t => t.status === 'downloading' || t.status === 'paused' || t.status === 'verifying').length;
    const queued = tasks.filter(t => t.status === 'queued').length;
    const installing = tasks.filter(t => t.status === 'installing').length;
    const completed = tasks.filter(t => t.status === 'completed' || t.status === 'installed').length;
    const failed = tasks.filter(t => t.status === 'failed' || t.status === 'install_failed' || t.status === 'signature_mismatch').length;

    return { active, queued, installing, completed, failed };
  }, [tasks]);

  // Handle auto-switching tab if active tab becomes empty but other tab has items
  useEffect(() => {
    if (counts.active > 0) {
      // keep on active or do nothing
    } else if (activeTab === 'active' && counts.queued > 0) {
      setActiveTab('queued');
    } else if (activeTab === 'queued' && counts.queued === 0 && counts.installing > 0) {
      setActiveTab('installing');
    }
  }, [counts, activeTab]);

  // Track completed/installed tasks to trigger haptic feedback on completion
  const [knownCompletedIds, setKnownCompletedIds] = useState<string[]>([]);

  useEffect(() => {
    const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'installed');
    const currentCompletedIds = completedTasks.map(t => t.id);

    // Find if there are any brand new completed tasks
    const newlyCompleted = completedTasks.filter(t => !knownCompletedIds.includes(t.id));

    if (newlyCompleted.length > 0) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      setKnownCompletedIds(currentCompletedIds);
    } else if (currentCompletedIds.length !== knownCompletedIds.length) {
      setKnownCompletedIds(currentCompletedIds);
    }
  }, [tasks, knownCompletedIds]);

  // Search & Filter & Sort tasks
  const processedTasks = useMemo(() => {
    let list = tasks;

    // Filter by tab status
    if (activeTab === 'active') {
      list = list.filter(t => t.status === 'downloading' || t.status === 'paused' || t.status === 'verifying');
    } else if (activeTab === 'queued') {
      list = list.filter(t => t.status === 'queued');
    } else if (activeTab === 'installing') {
      list = list.filter(t => t.status === 'installing');
    } else if (activeTab === 'completed') {
      list = list.filter(t => t.status === 'completed' || t.status === 'installed');
    } else if (activeTab === 'failed') {
      list = list.filter(t => t.status === 'failed' || t.status === 'install_failed' || t.status === 'signature_mismatch');
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        t => t.name.toLowerCase().includes(q) || t.packageName.toLowerCase().includes(q)
      );
    }

    // Sort: For queued, we respect original queue order unless sorting by something else
    if (activeTab === 'queued' && sortBy === 'newest') {
      // Maintain natural queue order (the order in which they will be popped)
      return list;
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'size') {
        return (b.totalBytes || 0) - (a.totalBytes || 0);
      }
      if (sortBy === 'oldest') {
        return a.queuedAt - b.queuedAt;
      }
      // default: newest
      return b.queuedAt - a.queuedAt;
    });
  }, [tasks, activeTab, searchQuery, sortBy]);

  // Moving queued downloads
  const handleMoveQueued = useCallback((currentIndex: number, direction: 'up' | 'down') => {
    const queuedList = tasks.filter(t => t.status === 'queued');
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === queuedList.length - 1) return;

    const queuedIds = queuedList.map(t => t.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    // Swap IDs
    const temp = queuedIds[currentIndex];
    queuedIds[currentIndex] = queuedIds[targetIndex];
    queuedIds[targetIndex] = temp;

    reorderQueued(queuedIds);
  }, [tasks, reorderQueued]);

  // Contextual bulk action bar
  const renderBulkActions = () => {
    const totalInTab = processedTasks.length;
    if (totalInTab === 0) return null;

    switch (activeTab) {
      case 'active':
        const isAnyDownloading = processedTasks.some(t => t.status === 'downloading');
        return (
          <View style={[styles.bulkContainer, { backgroundColor: colors.surfaceContainer }]}>
            <ThemedText style={[styles.bulkText, { color: colors.onSurfaceVariant, fontFamily: fonts.medium }]}>
              {counts.active} active download{counts.active === 1 ? '' : 's'}
            </ThemedText>
            <View style={styles.bulkButtons}>
              {isAnyDownloading ? (
                <Pressable
                  onPress={pauseAll}
                  style={({ pressed }) => [
                    styles.bulkButton,
                    { backgroundColor: colors.secondaryContainer },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <MaterialCommunityIcons name="pause" size={16} color={colors.onSecondaryContainer} />
                  <ThemedText style={[styles.bulkButtonText, { color: colors.onSecondaryContainer, fontFamily: fonts.semibold }]}>
                    Pause All
                  </ThemedText>
                </Pressable>
              ) : (
                <Pressable
                  onPress={resumeAll}
                  style={({ pressed }) => [
                    styles.bulkButton,
                    { backgroundColor: colors.primary },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <MaterialCommunityIcons name="play" size={16} color={colors.onPrimary} />
                  <ThemedText style={[styles.bulkButtonText, { color: colors.onPrimary, fontFamily: fonts.semibold }]}>
                    Resume All
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </View>
        );

      case 'queued':
        return (
          <View style={[styles.bulkContainer, { backgroundColor: colors.surfaceContainer }]}>
            <ThemedText style={[styles.bulkText, { color: colors.onSurfaceVariant, fontFamily: fonts.medium }]}>
              {counts.queued} in queue
            </ThemedText>
            <Pressable
              onPress={cancelAllQueued}
              style={({ pressed }) => [
                styles.bulkButton,
                { backgroundColor: colors.errorContainer },
                pressed && { opacity: 0.8 },
              ]}
            >
              <MaterialCommunityIcons name="close-circle-outline" size={16} color={colors.onErrorContainer} />
              <ThemedText style={[styles.bulkButtonText, { color: colors.onErrorContainer, fontFamily: fonts.semibold }]}>
                Cancel All
              </ThemedText>
            </Pressable>
          </View>
        );

      case 'completed':
        return (
          <View style={[styles.bulkContainer, { backgroundColor: colors.surfaceContainer }]}>
            <ThemedText style={[styles.bulkText, { color: colors.onSurfaceVariant, fontFamily: fonts.medium }]}>
              {counts.completed} completed task{counts.completed === 1 ? '' : 's'}
            </ThemedText>
            <Pressable
              onPress={clearCompleted}
              style={({ pressed }) => [
                styles.bulkButton,
                { backgroundColor: colors.surfaceContainerHigh },
                pressed && { opacity: 0.8 },
              ]}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.onSurface} />
              <ThemedText style={[styles.bulkButtonText, { color: colors.onSurface, fontFamily: fonts.semibold }]}>
                Clear All
              </ThemedText>
            </Pressable>
          </View>
        );

      case 'failed':
        return (
          <View style={[styles.bulkContainer, { backgroundColor: colors.surfaceContainer }]}>
            <ThemedText style={[styles.bulkText, { color: colors.onSurfaceVariant, fontFamily: fonts.medium }]}>
              {counts.failed} failed task{counts.failed === 1 ? '' : 's'}
            </ThemedText>
            <Pressable
              onPress={retryAllFailed}
              style={({ pressed }) => [
                styles.bulkButton,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.8 },
              ]}
            >
              <MaterialCommunityIcons name="refresh" size={16} color={colors.onPrimary} />
              <ThemedText style={[styles.bulkButtonText, { color: colors.onPrimary, fontFamily: fonts.semibold }]}>
                Retry All
              </ThemedText>
            </Pressable>
          </View>
        );

      default:
        return null;
    }
  };

  const handleOpenApp = (item: DownloadTask) => {
    if (Platform.OS === 'android') {
      const IntentLauncher = require('expo-intent-launcher');
      IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
        category: 'android.intent.category.LAUNCHER',
        packageName: item.packageName,
      }).catch((e: any) => console.warn('[DownloadManager] Failed to launch package:', e));
    } else {
      alert(`Opening ${item.packageName} (Simulated - Launcher works on Android)`);
    }
  };

  const handleShareApp = (item: DownloadTask) => {
    const minimalApp = {
      id: item.appId,
      packageName: item.packageName,
      name: item.name,
      developer: item.developer,
      source: 'Other',
      repositoryId: item.repositoryId || 'manual',
      description: 'Downloaded via SHEEN',
      currentVersion: {
        versionName: item.versionName,
        versionCode: item.versionCode,
        added: Date.now(),
        sizeBytes: item.totalBytes,
        apkUrl: item.apkUrl,
      },
      versions: [],
      added: Date.now(),
      lastUpdated: Date.now(),
      cachedAt: Date.now(),
    } as any;
    shareApp(minimalApp);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar translucent backgroundColor="transparent" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.surface }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && { backgroundColor: colors.surfaceContainerHigh },
            ]}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onSurface} />
          </Pressable>
          <ThemedText style={[styles.headerTitle, { color: colors.onSurface, fontFamily: fonts.bold }]}>
            Download Manager
          </ThemedText>
        </View>

        {/* Search & Sort Controls */}
        <View style={styles.controlsRow}>
          <View style={[styles.searchContainer, { backgroundColor: colors.surfaceContainerHigh }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.onSurfaceVariant} style={styles.searchIcon} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search downloads..."
              placeholderTextColor={colors.onSurfaceVariant + '80'}
              style={[styles.searchInput, { color: colors.onSurface, fontFamily: fonts.regular }]}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <MaterialCommunityIcons name="close" size={18} color={colors.onSurfaceVariant} />
              </Pressable>
            )}
          </View>

          <View style={[styles.sortContainer, { backgroundColor: colors.surfaceContainerHigh }]}>
            <MaterialCommunityIcons name="sort" size={18} color={colors.onSurfaceVariant} style={{ marginRight: 4 }} />
            <Pressable
              onPress={() => {
                const order: typeof sortBy[] = ['newest', 'oldest', 'name', 'size'];
                const nextIndex = (order.indexOf(sortBy) + 1) % order.length;
                setSortBy(order[nextIndex]);
              }}
              style={styles.sortButton}
            >
              <ThemedText style={[styles.sortText, { color: colors.onSurface, fontFamily: fonts.medium }]}>
                {sortBy === 'newest' && 'Newest'}
                {sortBy === 'oldest' && 'Oldest'}
                {sortBy === 'name' && 'Name'}
                {sortBy === 'size' && 'Size'}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Tabs Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
        >
          {(['active', 'queued', 'installing', 'completed', 'failed'] as TabType[]).map((tab) => {
            const isActive = activeTab === tab;
            const count = counts[tab];

            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.tabItem,
                  isActive && { borderBottomColor: colors.primary, borderBottomWidth: 3 },
                ]}
              >
                <ThemedText
                  style={[
                    styles.tabText,
                    {
                      color: isActive ? colors.primary : colors.onSurfaceVariant,
                      fontFamily: isActive ? fonts.semibold : fonts.medium,
                    },
                  ]}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </ThemedText>
                {count > 0 && (
                  <View style={[styles.badge, { backgroundColor: isActive ? colors.primary : colors.surfaceContainerHighest }]}>
                    <ThemedText style={[styles.badgeText, { color: isActive ? colors.onPrimary : colors.onSurfaceVariant }]}>
                      {count}
                    </ThemedText>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Bulk actions */}
      {renderBulkActions()}

      {/* Main Download List */}
      <Animated.ScrollView
        key={activeTab}
        entering={FadeIn.duration(280)}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {processedTasks.length === 0 ? (
          <Animated.View entering={FadeIn.delay(100)} style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name={
                activeTab === 'active'
                  ? 'download-off-outline'
                  : activeTab === 'queued'
                  ? 'clock-alert-outline'
                  : activeTab === 'installing'
                  ? 'package-variant-closed'
                  : activeTab === 'completed'
                  ? 'check-circle-outline'
                  : 'alert-circle-outline'
              }
              size={64}
              color={colors.onSurfaceVariant + '40'}
            />
            <ThemedText style={[styles.emptyTitle, { color: colors.onSurfaceVariant, fontFamily: fonts.semibold }]}>
              {searchQuery ? 'No search results' : `No ${activeTab} downloads`}
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: colors.onSurfaceVariant + '90', fontFamily: fonts.regular }]}>
              {searchQuery ? 'Try adjusting your search criteria' : `Items you queue or download will appear here`}
            </ThemedText>
          </Animated.View>
        ) : (
          <Animated.View layout={LinearTransition}>
            {processedTasks.map((item, index) => {
              const progress = item.totalBytes > 0 ? item.downloadedBytes / item.totalBytes : 0;
              const speedText = formatSpeed(item.speedBps);
              const downloadedText = formatBytes(item.downloadedBytes);
              const totalText = formatBytes(item.totalBytes);
              const etaText = formatEta(item.totalBytes - item.downloadedBytes, item.speedBps);

              return (
                <Animated.View
                  key={item.id}
                  entering={materialCardEnter(index, 0, 30)}
                  exiting={FadeOut}
                  layout={LinearTransition}
                  style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
                >
                  <View style={styles.cardHeader}>
                    <AppIconWithRing
                      letter={item.name.charAt(0).toUpperCase()}
                      color={item.packageName.charCodeAt(0) ? `hsl(${(item.packageName.charCodeAt(0) * 15) % 360}, 65%, 45%)` : colors.primary}
                      iconUrl={item.iconUrl}
                      size={44}
                      download={item}
                    />
                    <View style={styles.cardInfo}>
                      <ThemedText style={[styles.appName, { color: colors.onSurface, fontFamily: fonts.bold }]} numberOfLines={1}>
                        {item.name}
                      </ThemedText>
                      <ThemedText style={[styles.developerName, { color: colors.onSurfaceVariant, fontFamily: fonts.medium }]} numberOfLines={1}>
                        {item.developer} • {item.versionName}
                      </ThemedText>
                    </View>

                    {/* Right-side controls based on tab */}
                    {activeTab === 'active' && (
                      <View style={styles.activeActions}>
                        <Pressable
                          onPress={() => (item.status === 'paused' ? resumeDownload(item.id) : pauseDownload(item.id))}
                          style={styles.iconAction}
                        >
                          <MaterialCommunityIcons
                            name={item.status === 'paused' ? 'play' : 'pause'}
                            size={22}
                            color={colors.primary}
                          />
                        </Pressable>
                        <Pressable onPress={() => cancelDownload(item.id)} style={styles.iconAction}>
                          <MaterialCommunityIcons name="close" size={22} color={colors.error} />
                        </Pressable>
                      </View>
                    )}

                    {activeTab === 'queued' && (
                      <View style={styles.queuedActions}>
                        {/* Drag and Drop/Reordering buttons */}
                        <Pressable
                          onPress={() => handleMoveQueued(index, 'up')}
                          disabled={index === 0}
                          style={[styles.iconAction, index === 0 && { opacity: 0.3 }]}
                        >
                          <MaterialCommunityIcons name="chevron-up" size={24} color={colors.onSurface} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleMoveQueued(index, 'down')}
                          disabled={index === processedTasks.length - 1}
                          style={[styles.iconAction, index === processedTasks.length - 1 && { opacity: 0.3 }]}
                        >
                          <MaterialCommunityIcons name="chevron-down" size={24} color={colors.onSurface} />
                        </Pressable>
                        <Pressable onPress={() => cancelDownload(item.id)} style={[styles.iconAction, { marginLeft: 4 }]}>
                          <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error} />
                        </Pressable>
                      </View>
                    )}

                    {activeTab === 'installing' && (
                      <View style={styles.installingStatus}>
                        <SkeletonIcon size={24} radius={12} />
                      </View>
                    )}

                    {activeTab === 'completed' && (
                      <View style={styles.completedActions}>
                        <Pressable onPress={() => handleOpenApp(item)} style={[styles.chipButton, { backgroundColor: colors.primaryContainer }]}>
                          <MaterialCommunityIcons name="open-in-new" size={14} color={colors.onPrimaryContainer} style={{ marginRight: 4 }} />
                          <ThemedText style={[styles.chipButtonText, { color: colors.onPrimaryContainer, fontFamily: fonts.semibold }]}>
                            Open
                          </ThemedText>
                        </Pressable>
                        <Pressable onPress={() => router.push(`/app-details/${item.appId}`)} style={[styles.iconAction, { marginHorizontal: 4 }]}>
                          <MaterialCommunityIcons name="information-outline" size={20} color={colors.primary} />
                        </Pressable>
                        <Pressable onPress={() => handleShareApp(item)} style={styles.iconAction}>
                          <MaterialCommunityIcons name="share-variant-outline" size={20} color={colors.onSurfaceVariant} />
                        </Pressable>
                      </View>
                    )}

                    {activeTab === 'failed' && (
                      <View style={styles.failedActions}>
                        <Pressable onPress={() => retryDownload(item.id)} style={[styles.chipButton, { backgroundColor: colors.primary }]}>
                          <MaterialCommunityIcons name="refresh" size={14} color={colors.onPrimary} style={{ marginRight: 4 }} />
                          <ThemedText style={[styles.chipButtonText, { color: colors.onPrimary, fontFamily: fonts.semibold }]}>
                            Retry
                          </ThemedText>
                        </Pressable>
                        <Pressable onPress={() => cancelDownload(item.id)} style={[styles.iconAction, { marginLeft: 8 }]}>
                          <MaterialCommunityIcons name="close" size={20} color={colors.error} />
                        </Pressable>
                      </View>
                    )}
                  </View>

                  {/* Progressive indicator bars and stats */}
                  {activeTab === 'active' && (
                    <View style={styles.progressContainer}>
                      <View style={styles.statsRow}>
                        <ThemedText style={[styles.statsText, { color: colors.onSurfaceVariant, fontFamily: fonts.medium }]}>
                          {item.status === 'verifying' ? 'Verifying integrity...' : `${downloadedText} / ${totalText}`}
                        </ThemedText>
                        {item.status !== 'verifying' && (
                          <ThemedText style={[styles.statsText, { color: colors.onSurfaceVariant, fontFamily: fonts.medium }]}>
                            {speedText} • ETA: {etaText}
                          </ThemedText>
                        )}
                      </View>
                      <ProgressIndicator
                        progress={progress}
                        color={colors.primary}
                        height={4}
                      />
                    </View>
                  )}

                  {activeTab === 'queued' && (
                    <View style={styles.progressContainer}>
                      <View style={styles.statsRow}>
                        <ThemedText style={[styles.statsText, { color: colors.onSurfaceVariant, fontFamily: fonts.medium }]}>
                          Queue position: <ThemedText style={{ color: colors.primary, fontFamily: fonts.bold }}>#{index + 1}</ThemedText>
                        </ThemedText>
                        <ThemedText style={[styles.statsText, { color: colors.onSurfaceVariant, fontFamily: fonts.medium }]}>
                          {index === 0 ? 'Starting shortly...' : 'Waiting for slot...'}
                        </ThemedText>
                      </View>
                      <ShimmerLoading height={4} borderRadius={2} style={{ marginTop: 4 }} />
                    </View>
                  )}

                  {activeTab === 'installing' && (
                    <InstallingProgressBar item={item} colors={colors} fonts={fonts} />
                  )}

                  {activeTab === 'completed' && (
                    <View style={styles.progressContainer}>
                      <View style={styles.statsRow}>
                        <ThemedText style={[styles.statsText, { color: colors.onSurfaceVariant, fontFamily: fonts.medium }]}>
                          Version: {item.versionName} • Size: {totalText}
                        </ThemedText>
                        {item.completedAt && (
                          <ThemedText style={[styles.statsText, { color: colors.onSurfaceVariant, fontFamily: fonts.medium }]}>
                            Installed at {new Date(item.completedAt).toLocaleTimeString()}
                          </ThemedText>
                        )}
                      </View>
                    </View>
                  )}

                  {activeTab === 'failed' && (
                    <View style={styles.progressContainer}>
                      <View style={[styles.errorRow, { backgroundColor: colors.errorContainer + '30' }]}>
                        <MaterialCommunityIcons name="alert-circle" size={16} color={colors.error} style={{ marginRight: 6 }} />
                        <ThemedText style={[styles.errorText, { color: colors.error, fontFamily: fonts.medium }]} numberOfLines={2}>
                          {item.error || 'System installation request failed'}
                        </ThemedText>
                      </View>
                    </View>
                  )}
                </Animated.View>
              );
            })}
          </Animated.View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    width: '100%',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    marginLeft: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
  sortContainer: {
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortButton: {
    height: '100%',
    justifyContent: 'center',
  },
  sortText: {
    fontSize: 13,
  },
  tabsScrollContent: {
    paddingHorizontal: 8,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
  },
  badge: {
    height: 18,
    minWidth: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  bulkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    elevation: 1,
  },
  bulkText: {
    fontSize: 13,
  },
  bulkButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  bulkButtonText: {
    fontSize: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  appName: {
    fontSize: 15,
  },
  developerName: {
    fontSize: 12,
    marginTop: 1,
  },
  activeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  queuedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  installingStatus: {
    padding: 8,
  },
  completedActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  failedActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipButtonText: {
    fontSize: 12,
  },
  progressContainer: {
    marginTop: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statsText: {
    fontSize: 11,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
});
