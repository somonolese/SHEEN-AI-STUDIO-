import React, { useState, useEffect } from 'react';
import { SmartImage } from '@/components/SmartImage';
import { StyleSheet, View, Platform } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { App, DownloadTask } from '@/lib/types';
import { ThemedText } from '@/components/ThemedText';
import { SkeletonIcon } from '@/components/Skeleton';
import { ProgressRing } from './ProgressRing';
import { proxyUrl } from '@/lib/services/Network';
import { getResolvedIconUri, getCachedIconSync } from '@/lib/services/IconCacheService';

interface AppIconWithRingProps {
  app?: App;
  iconUrl?: string;
  letter: string;
  color: string;
  size?: number;
  download?: DownloadTask;
  hasUpdate?: boolean;
}

export function AppIconWithRing({ letter, color, size = 48, download, hasUpdate, iconUrl, app }: AppIconWithRingProps) {
  // Construct a minimal but complete App object if it wasn't passed directly
  const resolvedApp: App = app || {
    id: `custom:${iconUrl || letter}`,
    packageName: letter,
    name: letter,
    developer: 'Unknown',
    source: 'Other',
    repositoryId: 'custom',
    description: '',
    iconUrl,
    letter,
    color,
    currentVersion: { versionName: '1.0', versionCode: 1, added: Date.now() },
    versions: [],
    added: Date.now(),
    lastUpdated: 0,
    cachedAt: Date.now(),
  };

  const initialUri = getCachedIconSync(resolvedApp) || iconUrl;
  const [currentIconUri, setCurrentIconUri] = useState<string | undefined>(initialUri);
  const [fallbackToLetter, setFallbackToLetter] = useState<boolean>(!initialUri);
  const [isLoading, setIsLoading] = useState<boolean>(!initialUri && !!iconUrl);

  useEffect(() => {
    let active = true;

    // Check synchronous cache first
    const syncCache = getCachedIconSync(resolvedApp);
    if (syncCache) {
      setCurrentIconUri(syncCache);
      setFallbackToLetter(false);
      setIsLoading(false);
      return;
    }

    if (!iconUrl) {
      setFallbackToLetter(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    getResolvedIconUri(resolvedApp)
      .then((uri) => {
        if (!active) return;
        if (uri) {
          setCurrentIconUri(uri);
          setFallbackToLetter(false);
        } else {
          setFallbackToLetter(true);
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setFallbackToLetter(true);
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [app, iconUrl]);

  const status = download?.status;
  const showRing =
    status === 'queued' || 
    status === 'downloading' || 
    status === 'verifying' || 
    status === 'installing' ||
    status === 'paused';

  const progress =
    download && download.totalBytes > 0
      ? download.downloadedBytes / download.totalBytes
      : 0;

  const ringSize = size + 10;
  const indeterminate = status === 'queued' || status === 'verifying' || status === 'installing';

  return (
    <View style={{ width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }}>
      {/* App Icon / Letter bubble */}
      <View
        style={[
          styles.bubble,
          { width: size, height: size, borderRadius: size * 0.24, backgroundColor: color, overflow: 'hidden' },
        ]}
      >
        {!fallbackToLetter && currentIconUri ? (
          <>
            <SmartImage
              source={{ uri: proxyUrl(currentIconUri) }}
              style={{ width: size, height: size }}
              contentFit="cover"
              transition={200}
            />
            {isLoading && (
              <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
                <SkeletonIcon size={size * 0.4} radius={size * 0.2} style={{ backgroundColor: "#ffffff" }} />
              </View>
            )}
          </>
        ) : (
          <>
            <ThemedText style={[styles.letter, { fontSize: size * 0.4 }]}>{letter}</ThemedText>
            {isLoading && (
              <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
                <SkeletonIcon size={size * 0.4} radius={size * 0.2} style={{ backgroundColor: "#ffffff" }} />
              </View>
            )}
          </>
        )}
      </View>

      {/* Update indicator */}
      {hasUpdate && !showRing && (
        <View style={[styles.updateDot, { width: size / 4, height: size / 4, borderRadius: size / 8 }]} />
      )}

      {/* Animated progress ring overlay */}
      {showRing && (
        <Animated.View
          entering={FadeIn.duration(280)}
          exiting={FadeOut.duration(220)}
          style={[StyleSheet.absoluteFill, styles.ringOverlay]}
          pointerEvents="none"
        >
          <ProgressRing
            progress={progress}
            size={ringSize}
            strokeWidth={3}
            color={color}
            trackColor={`${color}30`}
            showPercent={false}
            indeterminate={indeterminate}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  letter: {
    color: '#fff',
    fontWeight: '800',
  },
  ringOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#000',
  },
});
