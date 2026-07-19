import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInUp, FadeOutDown, Layout } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { useColors } from '@/hooks/useColors';
import { useCatalog } from '@/contexts/CatalogContext';
import { App } from '@/lib/types';
import { useDownloads } from '@/hooks/useDownloads';
import { AppDownloadButton } from '@/components/downloads/AppDownloadButton';
import { AppIconWithRing } from '@/components/downloads/AppIconWithRing';
import { cleanHtml } from '@/lib/html';

interface Props {
  installedAppId: string;
  onDismiss: () => void;
}

export function PostInstallRecommendationCard({ installedAppId, onDismiss }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { getAppById, apps } = useCatalog();
  const { startDownload } = useDownloads();

  const installedApp = useMemo(() => getAppById(installedAppId), [getAppById, installedAppId]);

  const recommendedApps = useMemo(() => {
    if (!installedApp) return [];
    return apps
      .filter((a) => a.id !== installedApp.id && (a.categoryId === installedApp.categoryId || a.source === installedApp.source))
      .sort(() => 0.5 - Math.random()) // Simple shuffle
      .slice(0, 4);
  }, [apps, installedApp]);

  if (!installedApp || recommendedApps.length === 0) return null;

  return (
    <Animated.View
      entering={FadeInUp.delay(200).springify().damping(22)}
      exiting={FadeOutDown.springify().damping(22)}
      layout={Layout.springify().damping(22)}
      style={[styles.container, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText style={[styles.title, { color: colors.mutedForeground }]}>Installed 3 days ago</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.foreground }]}>How's your experience with {installedApp.name}?</ThemedText>
        </View>
        <Pressable onPress={onDismiss} style={styles.closeBtn} hitSlop={12}>
          <MaterialCommunityIcons name="close" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <View style={styles.dividerWrap}>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <ThemedText style={[styles.dividerText, { color: colors.mutedForeground, backgroundColor: colors.surfaceContainer }]}>You might also like</ThemedText>
      </View>

      <View style={styles.list}>
        {recommendedApps.map((app) => (
          <Pressable 
            key={app.id} 
            style={[styles.appRow, { borderBottomColor: colors.border }]}
            onPress={() => router.push({ pathname: '/app-details/[id]', params: { id: app.id } })}
          >
            <AppIconWithRing 
              app={app}
              letter={app.letter ?? app.name.charAt(0)} 
              color={app.color ?? colors.primary} 
              size={40} 
              iconUrl={app.iconUrl} 
            />
            <View style={styles.appInfo}>
              <ThemedText style={[styles.appName, { color: colors.foreground }]} numberOfLines={1}>{app.name}</ThemedText>
              <ThemedText style={[styles.appDesc, { color: colors.foreground, marginTop: 4 }]} numberOfLines={3}>
                {app.shortDescription ? cleanHtml(app.shortDescription) : app.description ? cleanHtml(app.description) : ''}
              </ThemedText>
              <ThemedText style={[{ color: colors.mutedForeground, fontSize: 11, fontWeight: '500', marginTop: 6 }]} numberOfLines={1}>
                {app.developer} • {app.source} • v{app.currentVersion?.versionName ?? '1.0.0'}
              </ThemedText>
            </View>
            <AppDownloadButton
              appId={app.id}
              onStartDownload={() =>
                startDownload({
                  appId: app.id,
                  name: app.name,
                  developer: app.developer,
                  letter: app.letter ?? app.name.charAt(0),
                  color: app.color ?? colors.primary,
                  version: app.currentVersion?.versionName ?? '1.0.0',
                  sizeBytes: app.currentVersion?.sizeBytes,
                  apkUrl: app.currentVersion?.apkUrl,
                  repositoryId: app.repositoryId,
                  iconUrl: app.iconUrl,
                })
              }
            />
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 24,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  closeBtn: {
    padding: 4,
  },
  dividerWrap: {
    position: 'relative',
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  divider: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 1,
    opacity: 0.5,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 12,
    zIndex: 1,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
    gap: 2,
  },
  appName: {
    fontSize: 15,
    fontWeight: '700',
  },
  appDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
