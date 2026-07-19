import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { materialCardEnter } from "../animations";
import Animated, { FadeInUp, LinearTransition } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { AppDownloadButton } from '@/components/downloads/AppDownloadButton';
import { AppIconWithRing } from '@/components/downloads/AppIconWithRing';
import { ThemedText } from '@/components/ThemedText';
import { useAppDownload, useDownloads } from '@/hooks/useDownloads';
import { App } from '@/lib/types';
import { SourceBadge } from '@/components/SourceBadge';
import { SmartImage } from '@/components/SmartImage';
import { proxyUrl } from '@/lib/services/Network';
import { useBasket } from '@/hooks/useBasket';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { cleanHtml } from '@/lib/html';

interface CategoryAppCardProps {
  app: App;
  index: number;
  onPress: (id: string) => void;
  onLongPress?: (app: App) => void;
  onInstall?: () => void;
}

export function CategoryAppCard({ app, index, onPress, onLongPress }: CategoryAppCardProps) {
  const colors = useColors();
  const { startDownload } = useDownloads();
  const download = useAppDownload(app.id);
  const { isInBasket, add, remove } = useBasket();
  const inBasket = isInBasket(app.id);

  const handleBasketPress = async () => {
    if (inBasket) await remove(app.id);
    else await add(app);
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '---';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  return (
    <Animated.View
      entering={materialCardEnter(index, 0, 40)}
      layout={LinearTransition.springify().stiffness(90).damping(12)}
      style={styles.wrapper}
    >
      <AnimatedPressable
        accessibilityRole="none"
        onPress={() => onPress(app.id)}
        onLongPress={() => onLongPress?.(app)}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {/* ── Content row ── */}
        <View style={styles.contentRow}>
          <AppIconWithRing
            app={app}
            letter={app.letter ?? app.name.charAt(0).toUpperCase()}
            color={app.color ?? '#000000'}
            iconUrl={app.iconUrl}
            size={56}
            download={download}
          />
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <ThemedText style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                {app.name}
              </ThemedText>
            </View>
            
            <ThemedText style={[styles.desc, { color: colors.foreground }]} numberOfLines={2}>
              {cleanHtml(app.shortDescription || app.description)}
            </ThemedText>

            <View style={styles.statsMeta}>
              <ThemedText style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {app.developer} • {app.source} • v{app.currentVersion?.versionName ?? '1.0.0'}
              </ThemedText>
            </View>
          </View>
          <View style={[styles.btnWrap, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
            <AnimatedPressable 
              onPress={handleBasketPress}
              style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
            >
              <MaterialCommunityIcons name={inBasket ? 'basket' : 'basket-outline'} size={22} color={inBasket ? colors.primary : colors.mutedForeground} />
            </AnimatedPressable>
            <AppDownloadButton
              appId={app.id}
              onStartDownload={() =>
                startDownload({
                  appId: app.id,
                  name: app.name,
                  developer: app.developer,
                  letter: app.letter ?? app.name.charAt(0).toUpperCase(),
                  color: app.color ?? '#000000',
                  version: app.currentVersion?.versionName ?? '1.0.0',
                  sizeBytes: app.currentVersion?.sizeBytes ?? 0,
                  apkUrl: app.currentVersion?.apkUrl ?? '',
                  repositoryId: app.repositoryId,
                  iconUrl: app.iconUrl,
                })
              }
            />
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  screenshot: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  body: { flex: 1, justifyContent: 'center', gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  dev:  { fontSize: 13, lineHeight: 18, opacity: 0.8 },
  desc: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  statsMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  metaText: { fontSize: 12, fontWeight: '500' },
  dotSeparator: { width: 3, height: 3, borderRadius: 1.5, marginHorizontal: 6 },
  btnWrap: { minWidth: 48, alignItems: 'center' },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },
  sourceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  sourceBadgeText: { fontSize: 9, fontWeight: '800' },
});
