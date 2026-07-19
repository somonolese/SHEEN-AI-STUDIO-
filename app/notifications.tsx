import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  TextInput,
  ScrollView,
  FlatList,
  AccessibilityInfo,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  Layout,
  withSpring,
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTypography } from '@/hooks/useTypography';
import { ThemedText } from '@/components/ThemedText';
import { useNotifications } from '@/hooks/useNotifications';
import { AppNotification, NotificationType } from '@/lib/types';
import { EmptyState } from '@/components/EmptyState';
import { emitNotification } from '@/lib/services/NotificationService';

type FilterType = 'all' | 'downloads' | 'installs' | 'updates' | 'repository' | 'system';

interface FilterChipConfig {
  key: FilterType;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const FILTER_CHIPS: FilterChipConfig[] = [
  { key: 'all', label: 'All Activity', icon: 'clock-outline' },
  { key: 'downloads', label: 'Downloads', icon: 'download-outline' },
  { key: 'installs', label: 'Installations', icon: 'check-decagram-outline' },
  { key: 'updates', label: 'Updates', icon: 'update' },
  { key: 'repository', label: 'Repository', icon: 'database-outline' },
  { key: 'system', label: 'System', icon: 'server-network' },
];

const TYPE_METADATA: Record<
  NotificationType,
  {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    label: string;
    color: string;
    bgOpacity: number;
  }
> = {
  download_started: { icon: 'download-outline', label: 'Download Started', color: '#1E90FF', bgOpacity: 0.15 },
  download_progress: { icon: 'progress-download', label: 'Downloading', color: '#1E90FF', bgOpacity: 0.15 },
  download_complete: { icon: 'download-multiple', label: 'Download Completed', color: '#32CD32', bgOpacity: 0.15 },
  download_completed: { icon: 'download-multiple', label: 'Download Completed', color: '#32CD32', bgOpacity: 0.15 },
  install_complete: { icon: 'check-decagram-outline', label: 'Installation Succeeded', color: '#00E5FF', bgOpacity: 0.15 },
  install_completed: { icon: 'check-decagram-outline', label: 'Installation Succeeded', color: '#00E5FF', bgOpacity: 0.15 },
  install_failed: { icon: 'alert-decagram-outline', label: 'Installation Failed', color: '#FF3D00', bgOpacity: 0.15 },
  update_available: { icon: 'update', label: 'Update Available', color: '#FF9100', bgOpacity: 0.15 },
  sync_finished: { icon: 'sync', label: 'Sync Succeeded', color: '#4CAF50', bgOpacity: 0.15 },
  sync_failed: { icon: 'sync-alert', label: 'Sync Failed', color: '#FF1744', bgOpacity: 0.15 },
  repo_added: { icon: 'database-plus-outline', label: 'Repository Added', color: '#00B0FF', bgOpacity: 0.15 },
  repo_removed: { icon: 'database-minus-outline', label: 'Repository Removed', color: '#9E9E9E', bgOpacity: 0.15 },
  basket_action: { icon: 'basket-outline', label: 'Basket Updated', color: '#AA00FF', bgOpacity: 0.15 },
  app_shared: { icon: 'share-variant-outline', label: 'App Shared', color: '#00D8A0', bgOpacity: 0.15 },
  experimental_announcement: { icon: 'flask-outline', label: 'Experimental Feature', color: '#D500F9', bgOpacity: 0.15 },
  release_notes: { icon: 'newspaper-variant-outline', label: 'SHEEN Release Notes', color: '#FFAB00', bgOpacity: 0.15 },
  error: { icon: 'alert-circle-outline', label: 'Error', color: '#FF1744', bgOpacity: 0.15 },
  info: { icon: 'information-outline', label: 'Information', color: '#2979FF', bgOpacity: 0.15 },
  success: { icon: 'check-circle-outline', label: 'Success', color: '#00E676', bgOpacity: 0.15 },
  warning: { icon: 'alert-outline', label: 'Warning', color: '#FFEA00', bgOpacity: 0.15 },
  upload: { icon: 'upload-outline', label: 'Upload', color: '#7C4DFF', bgOpacity: 0.15 },
  sync: { icon: 'sync', label: 'Sync', color: '#00B0FF', bgOpacity: 0.15 },
};

export default function ActionCenterScreen() {
  const colors = useColors();
  const fonts = useTypography();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { notifications, markRead, deleteNotification, markAllRead, clearAll } = useNotifications();

  // Screen States
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(15);
  const [isDemoSeeding, setIsDemoSeeding] = useState(false);

  // Auto scroll/top management
  const topPad = Platform.OS === 'web' ? 16 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 24 : insets.bottom + 16;

  // Toggle multi-select
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Toggle expand
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  }, []);

  // Enter selection mode
  const enterSelectionMode = useCallback((firstId: string) => {
    setIsSelectionMode(true);
    setSelectedIds(new Set([firstId]));
  }, []);

  // Mark selected as read
  const markSelectedRead = useCallback(async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await markRead(id);
    }
    clearSelection();
  }, [selectedIds, markRead, clearSelection]);

  // Delete selected
  const deleteSelected = useCallback(async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await deleteNotification(id);
    }
    clearSelection();
  }, [selectedIds, deleteNotification, clearSelection]);

  // Bulk Seed Actions (Material 3 craftsmanship demo)
  const handleSeedDemo = async () => {
    if (isDemoSeeding) return;
    setIsDemoSeeding(true);
    try {
      // 1. Release Notes
      await emitNotification(
        'release_notes',
        'SHEEN Release Notes — v1.2.0',
        'We are thrilled to bring you the new Universal Action Center, enhanced Material You support, fluid spring animations, and 2x faster repository loading! This release centers on elite craftsmanship.',
        { pinned: true, releaseVersion: 'v1.2.0' }
      );

      // 2. Experimental Announcement
      await emitNotification(
        'experimental_announcement',
        'Experimental: Shizuku Installer',
        'Enable the experimental Shizuku mode in Settings for background app installations without root privileges.',
        { pinned: true }
      );

      // 3. Failed Download
      await emitNotification(
        'error',
        'Download Failed: Signal Private Messenger',
        'Network socket connection timed out while retrieving Signal APK. Please verify your connection and try again.',
        { pinned: true, packageName: 'org.thoughtcrime.securesms', appId: 'github:Signal' }
      );

      // 4. Update available
      await emitNotification(
        'update_available',
        'Updates Available: 3 packages',
        'New stable versions are available for Termux, OsmAnd+, and VLC. Tap to inspect changed permissions.',
        { pinned: true, appId: 'fdroid:com.termux' }
      );

      // 5. Repository Sync Succeeded
      await emitNotification(
        'sync_finished',
        'IzzyOnDroid Sync Completed',
        'Successfully fetched new packages and catalog index from IzzyOnDroid. Updated 281 apps in 1.4s.',
        { repositoryId: 'izzy' }
      );

      // 6. Repo Sync Failed
      await emitNotification(
        'sync_failed',
        'Repository Synchronization Failed',
        'Failed to connect to F-Droid repository mirror. Server returned 502 Bad Gateway.',
        { pinned: true, repositoryId: 'fdroid' }
      );

      // 7. Repo Added
      await emitNotification(
        'repo_added',
        'GitHub Releases Source Registered',
        'Registered "NewPipe" GitHub Releases repository successfully. Ready to check updates.',
        { repositoryId: 'github:TeamNewPipe' }
      );

      // 8. Basket update
      await emitNotification(
        'basket_action',
        'OsmAnd Added to Basket',
        'OsmAnd was added to your installation basket. Ready for bulk installation.',
        { appId: 'fdroid:net.osmand.plus' }
      );

      // 9. App Shared
      await emitNotification(
        'app_shared',
        'App Shared: NewPipe',
        'You have successfully shared NewPipe with a friend via android share intent.',
        { appId: 'github:NewPipe', packageName: 'org.schabi.newpipe' }
      );

    } catch (e) {
      console.warn('Demo seeding failed:', e);
    } finally {
      setIsDemoSeeding(false);
    }
  };

  // Helper to check if event is pinned
  const isPinned = useCallback((notif: AppNotification): boolean => {
    if (notif.read) return false; // Once marked read, they unpin/archive
    const t = notif.type;
    if (t === 'update_available' || t === 'install_failed' || t === 'sync_failed') {
      return true;
    }
    if (t === 'error') {
      return true;
    }
    if (
      notif.data?.pinned ||
      notif.title.toLowerCase().includes('failed') ||
      notif.title.toLowerCase().includes('error')
    ) {
      return true;
    }
    return false;
  }, []);

  // Filter & Search Logic
  const processedNotifications = useMemo(() => {
    let result = [...notifications];

    // Search query
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
      );
    }

    // Filter Chips
    if (activeFilter !== 'all') {
      result = result.filter((n) => {
        const t = n.type;
        if (activeFilter === 'downloads') {
          return ['download_started', 'download_progress', 'download_complete', 'download_completed'].includes(t);
        }
        if (activeFilter === 'installs') {
          return ['install_complete', 'install_completed', 'install_failed'].includes(t);
        }
        if (activeFilter === 'updates') {
          return ['update_available'].includes(t);
        }
        if (activeFilter === 'repository') {
          return ['sync_finished', 'sync_failed', 'repo_added', 'repo_removed', 'sync'].includes(t);
        }
        if (activeFilter === 'system') {
          return [
            'info',
            'warning',
            'error',
            'success',
            'upload',
            'experimental_announcement',
            'release_notes',
            'basket_action',
            'app_shared',
          ].includes(t);
        }
        return true;
      });
    }

    return result;
  }, [notifications, searchQuery, activeFilter]);

  // Split into pinned and regular (chronological) lists
  const { pinnedEvents, regularEvents } = useMemo(() => {
    const pinned: AppNotification[] = [];
    const regular: AppNotification[] = [];

    processedNotifications.forEach((n) => {
      if (isPinned(n)) {
        pinned.push(n);
      } else {
        regular.push(n);
      }
    });

    return { pinnedEvents: pinned, regularEvents: regular };
  }, [processedNotifications, isPinned]);

  // Group chronological regular list
  const groupedChronological = useMemo(() => {
    const groups: { title: string; data: AppNotification[] }[] = [];
    const today: AppNotification[] = [];
    const yesterday: AppNotification[] = [];
    const older: AppNotification[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

    regularEvents.forEach((n) => {
      if (n.createdAt >= todayStart) {
        today.push(n);
      } else if (n.createdAt >= yesterdayStart) {
        yesterday.push(n);
      } else {
        older.push(n);
      }
    });

    if (today.length > 0) {
      groups.push({ title: 'Today', data: today });
    }
    if (yesterday.length > 0) {
      groups.push({ title: 'Yesterday', data: yesterday });
    }
    if (older.length > 0) {
      groups.push({ title: 'Older Activities', data: older });
    }

    return groups;
  }, [regularEvents]);

  // Count total events matching current filter in each category
  const getFilterCounts = useCallback(
    (filterKey: FilterType): number => {
      const q = searchQuery.toLowerCase();
      let filtered = notifications.filter((n) => {
        if (q.length === 0) return true;
        return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
      });

      if (filterKey === 'all') return filtered.length;

      return filtered.filter((n) => {
        const t = n.type;
        if (filterKey === 'downloads') {
          return ['download_started', 'download_progress', 'download_complete', 'download_completed'].includes(t);
        }
        if (filterKey === 'installs') {
          return ['install_complete', 'install_completed', 'install_failed'].includes(t);
        }
        if (filterKey === 'updates') {
          return ['update_available'].includes(t);
        }
        if (filterKey === 'repository') {
          return ['sync_finished', 'sync_failed', 'repo_added', 'repo_removed', 'sync'].includes(t);
        }
        if (filterKey === 'system') {
          return [
            'info',
            'warning',
            'error',
            'success',
            'upload',
            'experimental_announcement',
            'release_notes',
            'basket_action',
            'app_shared',
          ].includes(t);
        }
        return true;
      }).length;
    },
    [notifications, searchQuery]
  );

  // Relative Time String Helper
  const getRelativeTime = useCallback((timestamp: number): string => {
    const diffMs = Date.now() - timestamp;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }, []);

  // Contextual actions executor
  const handleContextAction = useCallback(
    (actionType: 'retry' | 'update' | 'details' | 'dismiss' | 'open', item: AppNotification) => {
      if (actionType === 'dismiss') {
        void markRead(item.id);
      } else if (actionType === 'retry') {
        if (item.type === 'sync_failed' || item.type === 'error') {
          router.push('/settings');
        } else {
          router.push('/downloads');
        }
      } else if (actionType === 'update') {
        router.push('/updates');
      } else if (actionType === 'details') {
        const appId = item.data?.appId || item.data?.packageName;
        if (appId) {
          router.push({ pathname: '/app-details/[id]', params: { id: String(appId) } });
        } else {
          router.push('/settings');
        }
      } else if (actionType === 'open') {
        const pkg = item.data?.packageName;
        if (pkg) {
          AccessibilityInfo.announceForAccessibility(`Attempting to launch app ${pkg}`);
        } else {
          void markRead(item.id);
        }
      }
    },
    [markRead, router]
  );

  // Incremental loader
  const hasMore = processedNotifications.length > visibleCount;
  const loadMore = useCallback(() => {
    if (hasMore) {
      setVisibleCount((prev) => prev + 15);
    }
  }, [hasMore]);

  // Card component
  const renderEventCard = useCallback(
    ({ item, pinned = false }: { item: AppNotification; pinned?: boolean }) => {
      const typeMeta = TYPE_METADATA[item.type] ?? TYPE_METADATA.info;
      const isSelected = selectedIds.has(item.id);
      const isExpanded = expandedIds.has(item.id);
      const relativeTime = getRelativeTime(item.createdAt);

      // Determine available actions based on event type
      const actions: { type: 'retry' | 'update' | 'details' | 'dismiss' | 'open'; label: string; icon: string }[] = [];
      if (item.type === 'update_available') {
        actions.push({ type: 'update', label: 'Update', icon: 'arrow-up-bold-box-outline' });
        actions.push({ type: 'details', label: 'View Details', icon: 'information-outline' });
      } else if (item.type === 'install_failed' || item.type === 'sync_failed') {
        actions.push({ type: 'retry', label: 'Retry', icon: 'refresh' });
      } else if (item.type === 'error' && item.title.toLowerCase().includes('download')) {
        actions.push({ type: 'retry', label: 'Retry', icon: 'refresh' });
      } else if (item.type === 'basket_action') {
        actions.push({ type: 'details', label: 'View Details', icon: 'magnify' });
      } else if (item.type === 'install_complete' || item.type === 'install_completed') {
        actions.push({ type: 'open', label: 'Open App', icon: 'play-outline' });
      }

      // Every card gets dismiss
      actions.push({ type: 'dismiss', label: item.read ? 'Archive' : 'Dismiss', icon: 'close-circle-outline' });

      return (
        <Animated.View
          entering={FadeInUp.duration(350).springify().damping(22)}
          exiting={FadeOut.duration(200)}
          layout={Layout.springify().damping(22)}
          style={[
            styles.cardWrap,
            {
              backgroundColor: isSelected
                ? colors.primaryContainer
                : pinned
                ? colors.surfaceContainerHigh
                : colors.surfaceContainer,
              borderColor: isSelected
                ? colors.primary
                : pinned
                ? colors.tertiary
                : !item.read
                ? colors.primary
                : 'transparent',
              borderWidth: pinned || !item.read || isSelected ? 1.5 : 0,
            },
          ]}
        >
          <Pressable
            onPress={() => {
              if (isSelectionMode) {
                toggleSelect(item.id);
              } else {
                toggleExpand(item.id);
              }
            }}
            onLongPress={() => {
              if (!isSelectionMode) {
                enterSelectionMode(item.id);
              }
            }}
            style={styles.cardPressable}
            accessibilityRole="button"
            accessibilityLabel={`${pinned ? 'Pinned ' : ''}${item.read ? 'Read' : 'Unread'} ${typeMeta.label} event: ${item.title}. ${item.body}. ${relativeTime}.`}
          >
            <View style={styles.cardHeader}>
              {/* Checkbox (only in selection mode) */}
              {isSelectionMode && (
                <View style={styles.checkboxContainer}>
                  <MaterialCommunityIcons
                    name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={isSelected ? colors.primary : colors.mutedForeground}
                  />
                </View>
              )}

              {/* Event Circular Icon */}
              <View style={[styles.iconWrap, { backgroundColor: typeMeta.color + '26' }]}>
                <MaterialCommunityIcons name={typeMeta.icon} size={20} color={typeMeta.color} />
              </View>

              {/* Title & Body Block */}
              <View style={styles.textBlock}>
                <View style={styles.titleRow}>
                  <ThemedText
                    numberOfLines={1}
                    style={[
                      styles.cardTitle,
                      { color: colors.foreground, fontFamily: item.read ? fonts.medium : fonts.bold },
                    ]}
                  >
                    {item.title}
                  </ThemedText>
                  {pinned && (
                    <View style={[styles.pinBadge, { backgroundColor: colors.tertiary + '26' }]}>
                      <MaterialCommunityIcons name="pin" size={12} color={colors.tertiary} />
                      <ThemedText style={[styles.pinBadgeText, { color: colors.tertiary }]}>Pinned</ThemedText>
                    </View>
                  )}
                </View>

                <ThemedText
                  numberOfLines={isExpanded ? undefined : 2}
                  style={[styles.cardBody, { color: colors.onSurfaceVariant, fontFamily: fonts.regular }]}
                >
                  {item.body}
                </ThemedText>

                <View style={styles.cardFooterRow}>
                  <ThemedText style={[styles.cardMeta, { color: colors.mutedForeground, fontFamily: fonts.regular }]}>
                    {typeMeta.label} • {relativeTime}
                  </ThemedText>
                  {!item.read && <View style={[styles.unreadBadgeDot, { backgroundColor: colors.primary }]} />}
                </View>
              </View>
            </View>

            {/* Expanded Action Buttons */}
            {isExpanded && actions.length > 0 && (
              <Animated.View entering={FadeIn.duration(200)} style={styles.actionButtonsWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsScroll}>
                  {actions.map((act) => (
                    <Pressable
                      key={act.type}
                      onPress={() => handleContextAction(act.type, item)}
                      style={({ pressed }) => [
                        styles.contextActionButton,
                        {
                          backgroundColor: pressed ? colors.surfaceContainerHighest : colors.surfaceContainerLow,
                          borderColor: colors.outlineVariant,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons name={act.icon as any} size={15} color={colors.primary} />
                      <ThemedText style={[styles.contextActionText, { color: colors.primary, fontFamily: fonts.bold }]}>
                        {act.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              </Animated.View>
            )}
          </Pressable>
        </Animated.View>
      );
    },
    [selectedIds, expandedIds, isSelectionMode, colors, fonts, getRelativeTime, handleContextAction, toggleSelect, toggleExpand, enterSelectionMode]
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
      />

      {/* Header Panel */}
      <View style={[styles.headerContainer, { paddingTop: topPad }]}>
        <View style={styles.headerTopBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back">
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.foreground} />
          </Pressable>

          {isSelectionMode ? (
            <View style={styles.titleWrapper}>
              <ThemedText style={[styles.titleText, { color: colors.foreground, fontFamily: fonts.bold }]}>
                {selectedIds.size} Selected
              </ThemedText>
            </View>
          ) : (
            <View style={styles.titleWrapper}>
              <ThemedText style={[styles.titleText, { color: colors.foreground, fontFamily: fonts.bold }]}>
                Activity Center
              </ThemedText>
              {notifications.filter((n) => !n.read).length > 0 && (
                <View style={[styles.titleBadge, { backgroundColor: colors.primary }]}>
                  <ThemedText style={[styles.titleBadgeText, { color: colors.onPrimary }]}>
                    {notifications.filter((n) => !n.read).length} New
                  </ThemedText>
                </View>
              )}
            </View>
          )}

          {/* Bulk actions panel */}
          <View style={styles.bulkActionsRow}>
            {isSelectionMode ? (
              <>
                <Pressable
                  onPress={markSelectedRead}
                  style={styles.headerIconButton}
                  accessibilityLabel="Mark selected read"
                >
                  <MaterialCommunityIcons name="email-open-outline" size={22} color={colors.foreground} />
                </Pressable>
                <Pressable
                  onPress={deleteSelected}
                  style={styles.headerIconButton}
                  accessibilityLabel="Delete selected"
                >
                  <MaterialCommunityIcons name="delete-outline" size={22} color={colors.error} />
                </Pressable>
                <Pressable
                  onPress={clearSelection}
                  style={styles.headerIconButton}
                  accessibilityLabel="Clear selection"
                >
                  <MaterialCommunityIcons name="close" size={22} color={colors.foreground} />
                </Pressable>
              </>
            ) : (
              <>
                {notifications.length > 0 && (
                  <>
                    <Pressable
                      onPress={() => void markAllRead()}
                      style={styles.headerIconButton}
                      accessibilityLabel="Mark all as read"
                    >
                      <MaterialCommunityIcons name="check-all" size={20} color={colors.primary} />
                    </Pressable>
                    <Pressable
                      onPress={() => void clearAll()}
                      style={styles.headerIconButton}
                      accessibilityLabel="Delete all notifications"
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error} />
                    </Pressable>
                  </>
                )}
              </>
            )}
          </View>
        </View>

        {/* Search input bar */}
        <View style={[styles.searchBarWrap, { backgroundColor: colors.surfaceContainerLow }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.mutedForeground} />
          <TextInput
            placeholder="Search activity inbox..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setVisibleCount(15);
            }}
            style={[styles.searchInput, { color: colors.foreground, fontFamily: fonts.regular }]}
            accessibilityLabel="Search activity history"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} style={styles.searchClearBtn}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        {/* Filter chips list */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsScroll}
        >
          {FILTER_CHIPS.map((chip) => {
            const count = getFilterCounts(chip.key);
            const isActive = activeFilter === chip.key;
            return (
              <Pressable
                key={chip.key}
                onPress={() => {
                  setActiveFilter(chip.key);
                  setVisibleCount(15);
                }}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? colors.primary : colors.surfaceContainerHigh,
                    opacity: count === 0 && !isActive ? 0.45 : pressed ? 0.8 : 1,
                    borderColor: isActive ? 'transparent' : colors.outlineVariant,
                    borderWidth: isActive ? 0 : 1,
                  },
                ]}
                accessibilityLabel={`${chip.label} filter, ${count} items`}
              >
                <MaterialCommunityIcons
                  name={chip.icon}
                  size={14}
                  color={isActive ? colors.onPrimary : colors.primary}
                  style={styles.chipIcon}
                />
                <Text style={[styles.chipText, { color: isActive ? colors.onPrimary : colors.foreground, fontFamily: fonts.medium }]}>
                  {chip.label}
                </Text>
                {count > 0 && (
                  <View
                    style={[
                      styles.chipCountBadge,
                      { backgroundColor: isActive ? colors.onPrimary + '40' : colors.primary + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipCountText,
                        { color: isActive ? colors.onPrimary : colors.primary, fontFamily: fonts.bold },
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Primary List View */}
      {processedNotifications.length > 0 ? (
        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        >
          {/* 1. PINNED EVENTS SECTION */}
          {pinnedEvents.length > 0 && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <MaterialCommunityIcons name="pin-outline" size={16} color={colors.tertiary} />
                <ThemedText style={[styles.sectionTitle, { color: colors.tertiary, fontFamily: fonts.bold }]}>
                  Pinned Priorities
                </ThemedText>
              </View>
              {pinnedEvents.slice(0, visibleCount).map((notif) => (
                <View key={notif.id} style={styles.cardOuter}>
                  {renderEventCard({ item: notif, pinned: true })}
                </View>
              ))}
            </View>
          )}

          {/* 2. CHRONOLOGICAL GROUPS */}
          {groupedChronological.length > 0 ? (
            groupedChronological.map((group) => (
              <View key={group.title} style={styles.sectionContainer}>
                <ThemedText style={[styles.sectionGroupTitle, { color: colors.mutedForeground, fontFamily: fonts.medium }]}>
                  {group.title}
                </ThemedText>
                {group.data.slice(0, visibleCount).map((notif) => (
                  <View key={notif.id} style={styles.cardOuter}>
                    {renderEventCard({ item: notif, pinned: false })}
                  </View>
                ))}
              </View>
            ))
          ) : pinnedEvents.length === 0 ? (
            <View style={styles.noResultsContainer}>
              <MaterialCommunityIcons name="filter-variant-remove" size={48} color={colors.mutedForeground} />
              <ThemedText style={[styles.noResultsText, { color: colors.mutedForeground, fontFamily: fonts.medium }]}>
                No events match this filter or query
              </ThemedText>
            </View>
          ) : null}

          {/* Incremental Load older events button */}
          {hasMore && (
            <Pressable
              onPress={loadMore}
              style={({ pressed }) => [
                styles.loadMoreButton,
                {
                  backgroundColor: colors.surfaceContainerHigh,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <ThemedText style={[styles.loadMoreText, { color: colors.primary, fontFamily: fonts.bold }]}>
                Load Older Activities
              </ThemedText>
              <MaterialCommunityIcons name="chevron-down" size={18} color={colors.primary} />
            </Pressable>
          )}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <EmptyState
            type="notifications"
            onPrimaryPress={() => router.back()}
            primaryLabel="Go Back"
          />
          
          {/* Seeding Controls for Interactive Testing */}
          <View style={styles.demoBox}>
            <ThemedText style={[styles.demoTitle, { color: colors.foreground, fontFamily: fonts.bold }]}>
              Action Center Demo Toolkit
            </ThemedText>
            <ThemedText style={[styles.demoDesc, { color: colors.mutedForeground, fontFamily: fonts.regular }]}>
              Pre-populate realistic Material 3 actions (Release notes, errors, updates) to test filters and pinning.
            </ThemedText>
            <Pressable
              onPress={handleSeedDemo}
              disabled={isDemoSeeding}
              style={({ pressed }) => [
                styles.demoButton,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed || isDemoSeeding ? 0.8 : 1,
                },
              ]}
            >
              {isDemoSeeding ? (
                <SkeletonButton width={150} height={20} style={{ borderRadius: 10, backgroundColor: colors.onPrimary + "66" }} />
              ) : (
                <>
                  <MaterialCommunityIcons name="database-import" size={16} color={colors.onPrimary} />
                  <Text style={[styles.demoButtonText, { color: colors.onPrimary, fontFamily: fonts.bold }]}>
                    Seed Rich Sample Activities
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    elevation: 2,
  },
  headerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  titleText: {
    fontSize: 20,
    letterSpacing: -0.2,
  },
  titleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  titleBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  bulkActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 10,
    paddingVertical: 8,
  },
  searchClearBtn: {
    padding: 4,
  },
  filterChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  chipIcon: {
    marginRight: 6,
  },
  chipText: {
    fontSize: 12,
  },
  chipCountBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  chipCountText: {
    fontSize: 10,
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 20,
  },
  sectionContainer: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    paddingLeft: 4,
  },
  sectionTitle: {
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionGroupTitle: {
    fontSize: 14,
    letterSpacing: 0.1,
    marginBottom: 4,
    paddingLeft: 4,
  },
  cardOuter: {
    marginBottom: 8,
  },
  cardWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 1,
  },
  cardPressable: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkboxContainer: {
    alignSelf: 'center',
    marginRight: 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontSize: 15,
    flex: 1,
    letterSpacing: -0.1,
  },
  pinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  pinBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  cardMeta: {
    fontSize: 11,
  },
  unreadBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  actionButtonsWrap: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  actionsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  contextActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  contextActionText: {
    fontSize: 11,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 8,
  },
  loadMoreText: {
    fontSize: 13,
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  noResultsText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  demoBox: {
    marginTop: 24,
    width: '100%',
    maxWidth: 340,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
    alignItems: 'center',
    gap: 8,
  },
  demoTitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  demoDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 4,
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    width: '100%',
  },
  demoButtonText: {
    fontSize: 12,
  },
});
