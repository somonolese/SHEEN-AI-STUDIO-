import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { Image as ExpoImage, ImageProps as ExpoImageProps } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Skeleton } from '@/components/Skeleton';
import { smartImageCacheService, ImageCacheType } from '@/lib/services/SmartImageCacheService';

export interface SmartImageProps extends Omit<ExpoImageProps, 'source'> {
  source: ExpoImageProps['source'] | string | null | undefined;
  fallbackIcon?: string;
  fallbackColor?: string;
  blurhash?: string;
  cacheType?: ImageCacheType;
  appInfo?: { id: string; lastUpdated: number; packageName?: string };
}

export const SmartImage = ({
  source,
  style,
  fallbackIcon = 'image-broken-variant',
  fallbackColor,
  blurhash,
  cacheType,
  appInfo,
  ...props
}: SmartImageProps) => {
  const colors = useColors();
  const [resolvedSource, setResolvedSource] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);
  
  const activeUriRef = useRef<string | null>(null);

  // Extract remote URI if present
  const remoteUri = typeof source === 'string' 
    ? source 
    : (source && typeof source === 'object' && 'uri' in source) 
      ? source.uri 
      : null;

  useEffect(() => {
    let isMounted = true;

    // Reset error & retry state when source changes
    setError(false);
    setRetryCount(0);

    // If there is no remote URI or cacheType is not specified, bypass our custom cache pipeline
    if (!remoteUri || !cacheType || !remoteUri.startsWith('http')) {
      setResolvedSource(source);
      setIsLoading(false);
      return;
    }

    activeUriRef.current = remoteUri;
    setIsLoading(true);

    async function fetchAndCache() {
      try {
        const localPath = await smartImageCacheService.getAndCacheImage(
          remoteUri!,
          cacheType!,
          appInfo
        );

        if (!isMounted || activeUriRef.current !== remoteUri) return;

        if (localPath) {
          setResolvedSource({ uri: localPath });
          setIsLoading(false);
        } else {
          // If resolving failed, retry automatically once
          handleFailure();
        }
      } catch (e) {
        if (!isMounted || activeUriRef.current !== remoteUri) return;
        handleFailure();
      }
    }

    async function handleFailure() {
      if (retryCount < 1) {
        // Attempt immediate single automatic retry
        setRetryCount((prev) => prev + 1);
        try {
          const retryPath = await smartImageCacheService.getAndCacheImage(
            remoteUri!,
            cacheType!,
            appInfo
          );
          if (isMounted && activeUriRef.current === remoteUri && retryPath) {
            setResolvedSource({ uri: retryPath });
            setIsLoading(false);
            return;
          }
        } catch {}
      }

      if (isMounted && activeUriRef.current === remoteUri) {
        setError(true);
        setIsLoading(false);
      }
    }

    fetchAndCache();

    return () => {
      isMounted = false;
    };
  }, [remoteUri, cacheType, appInfo, retryCount]);

  const handleImageError = useCallback(() => {
    if (retryCount < 1) {
      setRetryCount((prev) => prev + 1);
    } else {
      setError(true);
      setIsLoading(false);
    }
  }, [retryCount]);

  const finalFallbackColor = fallbackColor || colors.mutedForeground;

  // Show shimmer placeholder during loading or resolving phases
  if (isLoading) {
    return (
      <View style={[styles.container, style]}>
        <Skeleton style={StyleSheet.absoluteFillObject} radius={12} />
      </View>
    );
  }

  // Display clean placeholder on double failures (broken image avoidance)
  if (error || !resolvedSource) {
    return (
      <View style={[styles.container, style, styles.fallbackContainer, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
        <MaterialCommunityIcons name={fallbackIcon as any} size={24} color={finalFallbackColor} />
      </View>
    );
  }

  return (
    <ExpoImage
      source={resolvedSource}
      style={style}
      onError={handleImageError}
      placeholder={blurhash ? { blurhash } : null}
      contentFit="cover"
      transition={250}
      cachePolicy="memory-disk"
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
});
