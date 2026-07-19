import RNAnimated from 'react-native-reanimated';
import { materialCardEnter } from '../../components/animations';
import { ThemedText } from "@/components/ThemedText";
import { AnimatedPressable } from "@/components/settings/SettingsPrimitives";
import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Image, Animated, Easing, Modal, TextInput, Platform, SectionList, LayoutAnimation, useWindowDimensions } from "react-native";
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/lib/i18n';
import { useUpdates } from '@/hooks/useUpdates';
import { useCatalog } from '@/contexts/CatalogContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { UpdateInfo } from '@/lib/types';
import { ignoreUpdates, ignoreVersion, clearIgnoredVersion, getInstalledApps } from '@/lib/services/UpdateManager';
import { loadUpdateSettings, UpdateSettings } from '@/lib/services/CacheService';
import { useDownloads } from '@/hooks/useDownloads';
import { EmptyState } from '@/components/EmptyState';
import { analyzeUpdate } from '@/lib/services/UpdateIntelligence';
import { CategoryBadge, UpdateBadgesList } from '@/components/updates/IntelligenceBadges';
import { ChangelogRenderer } from '@/components/updates/ChangelogRenderer';
import { PremiumPullToRefresh } from '@/components/PremiumPullToRefresh';
import { cleanHtml } from '@/lib/html';

const formatBytes = (bytes?: number) => bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : 'Unknown size';

export default function UpdatesScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isRailMode = width >= 600;
  const { apps, appsByPackage } = useCatalog();
  const { updates, isLoading, check, lastCheck } = useUpdates(apps);
  const { startDownload, tasks, retryDownload } = useDownloads();
  const [recentlyUpdated, setRecentlyUpdated] = useState<any[]>([]);
  const [ignored, setIgnored] = useState<UpdateSettings | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await check();
    await fetchExtra();
    setRefreshing(false);
  }, [check]);

  const fetchExtra = async () => {
    const r = await getInstalledApps();
    setRecentlyUpdated(r);
    const s = await loadUpdateSettings();
    setIgnored(s);
  };

  useEffect(() => {
    fetchExtra();
  }, [updates]);

  const handleUpdate = (u: UpdateInfo) => {
    if (u.availableVersion.apkUrl) {
      startDownload({
        appId: u.packageName,
        name: u.name,
        developer: u.app.developer || '',
        letter: u.name.charAt(0).toUpperCase(),
        color: u.app.color || '#000000',
        version: u.availableVersion.versionName || '',
        sizeBytes: (u.availableVersion as any).size,
        apkUrl: u.availableVersion.apkUrl,
        repositoryId: u.app.repositoryId,
        iconUrl: u.app.iconUrl,
      });
    }
  };

  const handleUpdateAll = () => {
    updates.forEach(handleUpdate);
  };

  const totalSize = useMemo(() => updates.reduce((acc, u) => acc + ((u.availableVersion as any).size || 0), 0), [updates]);

  const estimatedTime = useMemo(() => {
    // assume 5MB/s
    const seconds = totalSize / (5 * 1024 * 1024);
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    return `${Math.ceil(seconds / 60)}m`;
  }, [totalSize]);


  const sections = [];
  if (updates.length > 0) {
    sections.push({ title: 'Updates Available', data: updates.map(u => ({ type: 'available', item: u })) });
  }
  if (recentlyUpdated.length > 0) {
    sections.push({ title: 'Recently Updated', data: recentlyUpdated.slice(0, 10).map(r => ({ type: 'recent', item: r })) });
  }
  
  const ignoredData: any[] = [];
  if (ignored?.ignoredPackages) {
    ignored.ignoredPackages.forEach(pkg => {
      ignoredData.push({ type: 'ignored_app', pkg });
    });
  }
  if (ignored?.ignoredVersions) {
    Object.entries(ignored.ignoredVersions).forEach(([pkg, ver]) => {
      ignoredData.push({ type: 'ignored_version', pkg, ver });
    });
  }
  if (ignoredData.length > 0) {
    sections.push({ title: 'Ignored Updates', data: ignoredData });
  }

  const renderSectionHeader = ({ section: { title } }: any) => (
    <ThemedText style={[styles.sectionTitle, { color: colors.onSurface }]}>{title}</ThemedText>
  );

  const renderItem = ({ item: rowItem }: any) => {
    if (rowItem.type === 'available') {
      const item = rowItem.item as UpdateInfo;
      const task = tasks.find(t => t.appId === item.packageName || t.packageName === item.packageName);
      return (
        <UpdateCard 
          item={item} 
          onUpdate={() => handleUpdate(item)} 
          colors={colors}
          onIgnoreApp={async () => { await ignoreUpdates(item.packageName, true); check(); fetchExtra(); }}
          onIgnoreVersion={async () => { await ignoreVersion(item.packageName, String(item.availableVersion.versionCode)); check(); fetchExtra(); }}
          task={task}
          onRetry={() => task && retryDownload(task.id)}
        />
      );
    } else if (rowItem.type === 'recent') {
      const item = rowItem.item;
      const app = appsByPackage.get(item.packageName);
      return (
        <View style={[styles.recentCard, { backgroundColor: colors.surface }]}>
          {app?.iconUrl ? <Image source={{ uri: app.iconUrl }} style={styles.smallIcon} /> : <View style={[styles.smallIcon, { backgroundColor: colors.surfaceVariant }]} />}
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.appName, { color: colors.onSurface }]} numberOfLines={1}>{app ? app.name : item.packageName}</ThemedText>
            <ThemedText style={[{ fontSize: 13, color: colors.onSurface, marginTop: 4 }]} numberOfLines={3}>{cleanHtml(app?.shortDescription || app?.description)}</ThemedText>
            <ThemedText style={[styles.version, { color: colors.onSurfaceVariant, marginTop: 6, fontSize: 11, fontWeight: '500' }]} numberOfLines={1}>{app?.developer} • {app?.source} • v{item.versionName}</ThemedText>
          </View>
          <ThemedText style={[styles.date, { color: colors.onSurfaceVariant }]}>{new Date(item.installedAt).toLocaleDateString()}</ThemedText>
        </View>
      );
    } else {
      const isApp = rowItem.type === 'ignored_app';
      const app = appsByPackage.get(rowItem.pkg);
      return (
        <View style={[styles.recentCard, { backgroundColor: colors.surface }]}>
          {app?.iconUrl ? <Image source={{ uri: app.iconUrl }} style={styles.smallIcon} /> : <View style={[styles.smallIcon, { backgroundColor: colors.surfaceVariant }]} />}
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.appName, { color: colors.onSurface }]} numberOfLines={1}>{app ? app.name : rowItem.pkg}</ThemedText>
            <ThemedText style={[{ fontSize: 13, color: colors.onSurface, marginTop: 4 }]} numberOfLines={3}>{cleanHtml(app?.shortDescription || app?.description)}</ThemedText>
            <ThemedText style={[styles.version, { color: colors.onSurfaceVariant, marginTop: 6, fontSize: 11, fontWeight: '500' }]} numberOfLines={1}>
              {app?.developer} • {app?.source} • {isApp ? 'All updates ignored' : `v${rowItem.ver} ignored`}
            </ThemedText>
          </View>
          <AnimatedPressable hitSlop={10} onPress={async () => {
            if (isApp) {
              await ignoreUpdates(rowItem.pkg, false);
            } else {
              await clearIgnoredVersion(rowItem.pkg);
            }
            check();
            fetchExtra();
          }}>
            <MaterialCommunityIcons name="close-circle-outline" size={24} color={colors.destructive} />
          </AnimatedPressable>
        </View>
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {updates.length > 0 && (
        <View style={[styles.header, { backgroundColor: colors.surfaceContainer }]}>
          <View>
            <ThemedText style={[styles.title, { color: colors.onSurface }]}>{updates.length} Updates Available</ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>{formatBytes(totalSize)} total • ~{estimatedTime} est.</ThemedText>
          </View>
          <AnimatedPressable hitSlop={10} style={[styles.updateAllBtn, { backgroundColor: colors.primary }]} onPress={handleUpdateAll}>
            <ThemedText style={[styles.updateAllText, { color: colors.onPrimary }]}>Update All</ThemedText>
          </AnimatedPressable>
        </View>
      )}
      
      <PremiumPullToRefresh refreshing={refreshing} onRefresh={onRefresh}>
        {(scrollProps) => (
          <SectionList
            {...scrollProps}
            sections={sections}
            keyExtractor={(item, index) => item.type + '_' + (item.item ? item.item.packageName : item.pkg) + index}
            contentContainerStyle={[styles.listContent, isRailMode && { paddingBottom: 24 }]}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            ListEmptyComponent={
              isLoading ? (
                <View style={{ gap: 12, paddingHorizontal: 20 }}>
                  <ResultRowSkeleton />
                  <ResultRowSkeleton />
                  <ResultRowSkeleton />
                </View>
              ) : (
                <EmptyState
                  type="updates"
                  lastCheckTime={lastCheck ? new Date(lastCheck).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined}
                />
              )
            }
          />
        )}
      </PremiumPullToRefresh>
    </View>
  );
}

function UpdateCard({ item, index, onUpdate, colors, onIgnoreApp, onIgnoreVersion, task, onRetry }: { item: UpdateInfo, index?: number, onUpdate: () => void, colors: any, task: any, onRetry: () => void, onIgnoreApp: () => void, onIgnoreVersion: () => void }) {
  const [expanded, setExpanded] = useState(false);

  // Analyze update
  const analysis = useMemo(() => {
    return analyzeUpdate(item.app, item.installedVersionCode, item.installedVersionName);
  }, [item]);

  const hasPermChanges = item.permissionChanges && item.permissionChanges.added.length > 0;
  const sizeBytes = item.availableVersion.sizeBytes ?? (item.availableVersion as any).size ?? 0;
  const sizeDiffBytes = analysis.sizeDiffBytes;

  const formattedSizeDiff = useMemo(() => {
    if (sizeDiffBytes === undefined) return '';
    if (sizeDiffBytes > 0) return ` (+${formatBytes(sizeDiffBytes)})`;
    if (sizeDiffBytes < 0) return ` (-${formatBytes(Math.abs(sizeDiffBytes))})`;
    return ' (No change)';
  }, [sizeDiffBytes]);

  const releaseDate = useMemo(() => {
    if (!item.availableVersion.added) return 'Unknown date';
    return new Date(item.availableVersion.added).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [item.availableVersion.added]);

  return (
    <RNAnimated.View entering={materialCardEnter(index ?? 0, 0, 30)} style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.cardHeader}>
        {item.app.iconUrl ? (
          <Image source={{ uri: item.app.iconUrl }} style={styles.icon} />
        ) : (
          <View style={[styles.icon, { backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' }]}>
            <MaterialCommunityIcons name="application-outline" size={24} color={colors.onSurfaceVariant} />
          </View>
        )}
        <View style={styles.cardInfo}>
          <ThemedText style={[styles.appName, { color: colors.onSurface }]} numberOfLines={1}>{item.name}</ThemedText>
          <ThemedText style={[{ fontSize: 13, color: colors.onSurface, marginTop: 4 }]} numberOfLines={3}>{cleanHtml(item.app?.shortDescription || item.app?.description)}</ThemedText>
          <ThemedText style={[styles.repo, { color: colors.onSurfaceVariant, marginTop: 6, fontSize: 11, fontWeight: '500' }]} numberOfLines={1}>
            {item.app?.developer} • {item.app?.source} • v{item.installedVersionName || '—'} → v{item.availableVersion.versionName}
          </ThemedText>
        </View>
        {!task || task.status === 'failed' ? (
          <AnimatedPressable hitSlop={10} style={[styles.updateBtn, { backgroundColor: colors.primaryContainer }]} onPress={onUpdate}>
            <ThemedText style={[styles.updateText, { color: colors.onPrimaryContainer }]}>Update</ThemedText>
          </AnimatedPressable>
        ) : (
          <View style={[styles.updateBtn, { backgroundColor: colors.surfaceVariant }]}>
            <ThemedText style={[styles.updateText, { color: colors.onSurfaceVariant }]}>
              {task.status === 'queued' ? 'Queued' : task.status === 'downloading' ? 'Downloading...' : 'Installing'}
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.badgeRow}>
        <CategoryBadge category={analysis.category} compact />
        <UpdateBadgesList badges={analysis.badges} compact />
      </View>

      {task && task.status === 'failed' && (
        <View style={{ marginTop: 12, padding: 12, backgroundColor: colors.destructive, borderRadius: 8 }}>
          <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Update failed</ThemedText>
          <ThemedText style={{ color: '#FFFFFF' }}>{task.error}</ThemedText>
          <AnimatedPressable hitSlop={10} style={{ marginTop: 8 }} onPress={onRetry}>
            <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Retry Update</ThemedText>
          </AnimatedPressable>
        </View>
      )}

      <AnimatedPressable 
        hitSlop={10} 
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setExpanded(!expanded);
        }}
        style={styles.expandBtn}
      >
        <ThemedText style={[styles.expandText, { color: colors.primary }]}>
          {expanded ? 'Hide Details' : "What's New"}
        </ThemedText>
        <MaterialCommunityIcons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.primary} />
      </AnimatedPressable>

      {expanded && (
        <View style={styles.details}>
          <View style={[styles.metaGrid, { borderColor: colors.border || 'rgba(0,0,0,0.08)' }]}>
            <View style={styles.metaGridItem}>
              <ThemedText style={[styles.metaLabel, { color: colors.onSurfaceVariant }]}>Installed Version</ThemedText>
              <ThemedText style={[styles.metaValue, { color: colors.onSurface }]}>v{item.installedVersionName || '—'}</ThemedText>
            </View>
            <View style={styles.metaGridItem}>
              <ThemedText style={[styles.metaLabel, { color: colors.onSurfaceVariant }]}>Latest Version</ThemedText>
              <ThemedText style={[styles.metaValue, { color: colors.onSurface }]}>v{item.availableVersion.versionName}</ThemedText>
            </View>
            <View style={styles.metaGridItem}>
              <ThemedText style={[styles.metaLabel, { color: colors.onSurfaceVariant }]}>Release Date</ThemedText>
              <ThemedText style={[styles.metaValue, { color: colors.onSurface }]}>{releaseDate}</ThemedText>
            </View>
            <View style={styles.metaGridItem}>
              <ThemedText style={[styles.metaLabel, { color: colors.onSurfaceVariant }]}>Update Size</ThemedText>
              <ThemedText style={[styles.metaValue, { color: colors.onSurface }]}>
                {formatBytes(sizeBytes)}
                <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: sizeDiffBytes && sizeDiffBytes < 0 ? '#1B5E20' : sizeDiffBytes && sizeDiffBytes > 0 ? '#B3261E' : colors.onSurfaceVariant }}>
                  {formattedSizeDiff}
                </ThemedText>
              </ThemedText>
            </View>
            <View style={[styles.metaGridItem, { width: '100%', borderBottomWidth: 0 }]}>
              <ThemedText style={[styles.metaLabel, { color: colors.onSurfaceVariant }]}>Source Repository</ThemedText>
              <ThemedText style={[styles.metaValue, { color: colors.onSurface }]}>{item.app.repositoryId}</ThemedText>
            </View>
          </View>

          <ThemedText style={[styles.sectionHeading, { color: colors.onSurface }]}>Release Notes</ThemedText>
          <ChangelogRenderer changelog={item.availableVersion.changelog} colors={colors} />

          {hasPermChanges && (
            <View style={styles.permissions}>
              <ThemedText style={[styles.permTitle, { color: colors.destructive }]}>New Permissions Added:</ThemedText>
              {item.permissionChanges!.added.map(p => (
                <ThemedText key={p} style={[styles.permItem, { color: colors.onSurfaceVariant }]}>• {p.split('.').pop()}</ThemedText>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <AnimatedPressable hitSlop={10} onPress={onIgnoreVersion}>
              <ThemedText style={[styles.actionText, { color: colors.primary }]}>Ignore this version</ThemedText>
            </AnimatedPressable>
            <AnimatedPressable hitSlop={10} onPress={onIgnoreApp}>
              <ThemedText style={[styles.actionText, { color: colors.destructive }]}>Ignore all updates</ThemedText>
            </AnimatedPressable>
          </View>
        </View>
      )}
    </RNAnimated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#00000020' },
  title: { fontSize: 20, fontWeight: 'bold' },
  subtitle: { fontSize: 14, marginTop: 4 },
  updateAllBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  updateAllText: { fontWeight: 'bold' },
  listContent: { padding: 16, paddingBottom: 100 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 16, marginBottom: 12 },
  card: { borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 48, height: 48, borderRadius: 12, marginRight: 12 },
  smallIcon: { width: 32, height: 32, borderRadius: 8, marginRight: 12 },
  cardInfo: { flex: 1 },
  appName: { fontSize: 16, fontWeight: 'bold' },
  version: { fontSize: 14, marginTop: 2 },
  repo: { fontSize: 12, marginTop: 2, opacity: 0.8 },
  updateBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginLeft: 12 },
  updateText: { fontWeight: 'bold' },
  expandBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#00000010', justifyContent: 'space-between' },
  expandText: { fontSize: 14, fontWeight: 'bold', marginRight: 4 },
  details: { marginTop: 12 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' },
  metaGrid: { borderWidth: 1, borderRadius: 12, padding: 12, marginVertical: 10, flexDirection: 'row', flexWrap: 'wrap' },
  metaGridItem: { width: '50%', paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#00000010' },
  metaLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2, letterSpacing: 0.3 },
  metaValue: { fontSize: 13, fontWeight: '500' },
  sectionHeading: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 14, marginBottom: 8 },
  changelog: { fontSize: 14, lineHeight: 20 },
  permissions: { marginTop: 12, padding: 12, backgroundColor: '#ff000010', borderRadius: 8 },
  permTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  permItem: { fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  actionText: { fontSize: 14, fontWeight: 'bold' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { fontSize: 18, marginTop: 16, fontWeight: 'bold' },
  recentCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 8 },
  date: { fontSize: 12 },
});
