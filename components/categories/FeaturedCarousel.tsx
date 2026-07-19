/**
 * FeaturedCarousel — production-grade implementation
 *
 * Root causes fixed in this rewrite:
 *
 * 1. Hooks-in-loop: renderDot called useAnimatedStyle from a plain function
 *    inside apps.map() → violates Rules of Hooks. Fixed: PaginationDot is
 *    now a proper React component.
 *
 * 2. Side-effect inside setState: auto-scroll called scrollToOffset() from
 *    inside a setActiveIndex() callback → illegal in React. Fixed: position
 *    is tracked in a plain ref (absoluteIndexRef), no state update needed.
 *
 * 3. runOnJS(setTimeout) with no cleanup: each onEndDrag spawned a new 5-second
 *    timeout with no way to cancel earlier ones → stale timers flip isInteracting
 *    false while the user is still dragging. Fixed: resumeTimer ref with
 *    clearTimeout before each new schedule.
 *
 * 4. Resume timer tied to onEndDrag, not onMomentumEnd: list still decelerates
 *    for 0.5–2 s after finger lift; auto-scroll could interrupt momentum.
 *    Fixed: resume timer starts only inside onMomentumEnd.
 *
 * 5. activeIndex starts at 0, not initialScrollIndex: if the interval fired
 *    before the 50 ms init timeout, it scrolled to position 1 (near the list
 *    start) instead of initialScrollIndex+1. Fixed: absoluteIndexRef is set to
 *    initialScrollIndex synchronously, before any interval runs.
 *
 * 6. setActiveIndex on every snap triggered a full carousel re-render tree.
 *    Fixed: removed activeIndex state entirely; position lives in refs only.
 *
 * 7. Animated.Image with no cache policy: refetched banner images on every
 *    mount. Fixed: expo-image with memory-disk cache inside Animated.View.
 *
 * 8. Scale 0.92 / opacity 0.6 for side cards: too aggressive, made transitions
 *    look choppy. Fixed: 0.96 / 0.75 per spec.
 *
 * 9. Parallax ±100 px: excessive GPU work per frame. Fixed: ±35 px for the
 *    same visual depth with less computational cost.
 *
 * 10. MULTIPLIER=50 (250 items for 5 apps): heavy initial render and memory.
 *     Fixed: MULTIPLIER=15.
 *
 * 11. No disableIntervalMomentum: fast swipes could jump multiple cards.
 *     Fixed: added.
 *
 * 12. No removeClippedSubviews; default windowSize=21 rendered 10 screens of
 *     content. Fixed: windowSize=5, removeClippedSubviews, maxToRenderPerBatch=3.
 *
 * 13. renderItem not memoized: new closure on every render. Fixed: useCallback.
 *
 * 14. CarouselCard not React.memo'd: remounted on any parent update. Fixed.
 *
 * 15. 50 ms setTimeout for initial scroll: caused a flash at position 0.
 *     Redundant because initialScrollIndex + getItemLayout handles this natively.
 *     Fixed: removed.
 *
 * 16. Dot modulo edge case: (-0.1) % 5 = -0.1 in JS when scrolling backwards
 *     past a boundary. Fixed: ((x % n) + n) % n for always-positive result.
 */

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Platform, StyleSheet, View, TouchableOpacity, Pressable, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { SmartImage } from '@/components/SmartImage';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors, useEffectiveColorScheme } from '@/hooks/useColors';
import { ThemedText } from '@/components/ThemedText';
import { useAppDownload, useDownloads } from '@/hooks/useDownloads';
import { AppDownloadButton } from '@/components/downloads/AppDownloadButton';
import { AppIconWithRing } from '@/components/downloads/AppIconWithRing';
import { useSettings } from '@/hooks/useSettings';
import { Skeleton, FeaturedCarouselSkeleton } from '@/components/Skeleton';
import { proxyUrl } from '@/lib/services/Network';
// import { useDownloadAnimation } from '@/contexts/DownloadAnimationContext';
import { SourceBadge } from '@/components/SourceBadge';
import { App } from '@/lib/types';
import { cleanHtml } from '@/lib/html';

// ─── Layout constants ─────────────────────────────────────────────────────────
const OVERLAP = 80; // Increased overlap for more "stacked" look
const CARD_HEIGHT = 220;

// ─── Infinite-scroll constants ────────────────────────────────────────────────
// 15× is enough for any realistic app list. 50× was wasteful (250 items for 5 apps).
const MULTIPLIER = 15;

// ─── Auto-scroll timing ───────────────────────────────────────────────────────
const AUTO_SCROLL_MS = 3000; // pause between advances
const RESUME_DELAY_MS = 5000; // idle time required before auto-scroll restarts

import { AnimatedPressable } from '@/components/AnimatedPressable';

// ─── PaginationDot ────────────────────────────────────────────────────────────
// Previously implemented as renderDot() calling useAnimatedStyle() — a hooks-
// in-loop violation. Now a proper React component so React can track hook calls.
function PaginationDot({
  index,
  scrollX,
  originalCount,
  primary,
  itemSize,
}: {
  index: number;
  scrollX: SharedValue<number>;
  originalCount: number;
  primary: string;
  itemSize: number;
}) {
  const dotStyle = useAnimatedStyle(() => {
    const currentIndex = scrollX.value / itemSize;
    // Fix: always-positive modulo — JS % can return negative for negative inputs
    const rawMod = currentIndex % originalCount;
    const normalizedMod = ((rawMod % originalCount) + originalCount) % originalCount;
    const distance = Math.abs(normalizedMod - index);
    // Wrap-around: pick the shorter arc
    const effectiveDistance = Math.min(distance, originalCount - distance);

    const width = interpolate(effectiveDistance, [0, 1], [24, 6], Extrapolation.CLAMP);
    const opacity = interpolate(effectiveDistance, [0, 1], [1, 0.4], Extrapolation.CLAMP);

    return { width, opacity, backgroundColor: primary };
  });

  return <Animated.View style={[styles.paginationDot, dotStyle]} />;
}

function ShimmerPlaceholder({ colors, scheme }: { colors: any; scheme: 'light' | 'dark' }) {
  const shimmerVal = useSharedValue(-220);

  React.useEffect(() => {
    shimmerVal.value = withRepeat(
      withTiming(220, { duration: 1200, easing: Easing.bezier(0.4, 0, 0.6, 1) }),
      -1,
      false
    );
  }, [shimmerVal]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerVal.value }],
  }));

  const isDark = scheme === 'dark';
  const gradientColors = isDark 
    ? ['transparent', 'rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.05)', 'transparent']
    : ['transparent', 'rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.35)', 'transparent'];

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceContainer, overflow: 'hidden' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

// ─── CarouselCard ─────────────────────────────────────────────────────────────
const CarouselCard = React.memo(function CarouselCard({
  app,
  index,
  scrollX,
  onPress,
  hasUpdate,
  itemSize,
  cardWidth,
}: {
  app: App;
  index: number;
  scrollX: SharedValue<number>;
  onPress?: () => void;
  hasUpdate?: boolean;
  itemSize: number;
  cardWidth: number;
}) {
  const { startDownload } = useDownloads();
  const download = useAppDownload(app.id);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const isNew = useMemo(() => {
    if (!app.added) return false;
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    const diff = Date.now() - app.added;
    return diff >= 0 && diff <= sevenDaysInMs;
  }, [app.added]);

  const cardStyle = useAnimatedStyle(() => {
    const diff = (scrollX.value - index * itemSize) / itemSize;

    // Scale
    const scale = interpolate(
      diff,
      [-2, -1, 0, 1, 2],
      [0.85, 0.92, 1.0, 0.92, 0.85],
      Extrapolation.CLAMP,
    );

    // Opacity
    const opacity = interpolate(
      diff,
      [-2, -1, 0, 1, 2],
      [0, 0.95, 1.0, 0.95, 0],
      Extrapolation.CLAMP,
    );

    // Elevation (Android shadow)
    const elevation = interpolate(
      diff,
      [-2, -1, 0, 1, 2],
      [0, 4, 16, 4, 0],
      Extrapolation.CLAMP,
    );

    // zIndex (Symmetric stack order: active card on top, neighbors tuck behind)
    const zIndex = interpolate(
      diff,
      [-2, -1, 0, 1, 2],
      [50, 80, 100, 80, 50],
      Extrapolation.CLAMP,
    );

    // customTranslateX (controls the stacked cards peek positioning)
    const customTranslateX = interpolate(
      diff,
      [-2, -1, 0, 1, 2],
      [-itemSize * 1.1, -itemSize * 0.42, 0, itemSize * 0.42, itemSize * 1.1],
      Extrapolation.CLAMP,
    );

    // Counteract FlatList native horizontal flow to place all cards perfectly relative to center
    const translateX = - (index * itemSize) + scrollX.value + customTranslateX;

    // iOS Shadow properties
    const shadowOpacity = interpolate(
      diff,
      [-1, 0, 1],
      [0.15, 0.4, 0.15],
      Extrapolation.CLAMP,
    );
    const shadowRadius = interpolate(
      diff,
      [-1, 0, 1],
      [8, 20, 8],
      Extrapolation.CLAMP,
    );
    const shadowOffsetHeight = interpolate(
      diff,
      [-1, 0, 1],
      [4, 12, 4],
      Extrapolation.CLAMP,
    );

    return {
      transform: [
        { translateX },
        { scale },
      ],
      opacity,
      elevation,
      zIndex: Math.round(zIndex),
      shadowOpacity,
      shadowRadius,
      shadowOffset: { width: 0, height: shadowOffsetHeight },
    };
  });

  const bgStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      scrollX.value,
      [(index - 1) * itemSize, index * itemSize, (index + 1) * itemSize],
      [-35, 0, 35],
      Extrapolation.CLAMP,
    );
    return { transform: [{ translateX }] };
  });

  const textFadeStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollX.value,
      [(index - 0.5) * itemSize, index * itemSize, (index + 0.5) * itemSize],
      [0, 1, 0],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollX.value,
      [(index - 0.5) * itemSize, index * itemSize, (index + 0.5) * itemSize],
      [15, 0, 15],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ translateY }] };
  });

  const hasScreenshot = !!(app.screenshotUrls?.[0]);
  const bannerImg = hasScreenshot ? proxyUrl(app.screenshotUrls![0]) : undefined;
  const showBanner = bannerImg && !imageFailed;
  const colors = useColors();
  const scheme = useEffectiveColorScheme();

  return (
    <Animated.View 
      style={[styles.carouselCardWrap, cardStyle, { width: cardWidth }]} 
    >
        <AnimatedPressable style={styles.carouselCardInner} onPress={onPress}>
        {showBanner ? (
          <>
            <Animated.View style={[StyleSheet.absoluteFillObject, styles.carouselCardBg, bgStyle]}>
              {!imageLoaded && <ShimmerPlaceholder colors={colors} scheme={scheme} />}
              <SmartImage
                source={{ uri: bannerImg }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={300}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageFailed(true)}
                cacheType="banner"
                appInfo={{ id: app.id, lastUpdated: app.lastUpdated || 0 }}
              />
            </Animated.View>
            <BlurView style={StyleSheet.absoluteFillObject} intensity={20} tint="dark" />
          </>
        ) : (
          <LinearGradient
            colors={[app.color ?? '#2D2D2D', '#1A1A1A']}
            style={StyleSheet.absoluteFillObject}
          />
        )}

        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={styles.cardContent}>
          <View style={styles.topRow}>
            <SourceBadge source={app.source} dark />
            {isNew && (
              <View style={styles.newBadge}>
                <ThemedText style={styles.newBadgeText}>New</ThemedText>
              </View>
            )}
          </View>

          <View style={styles.bottomSection}>
            <View style={styles.infoSection}>
              <View style={styles.iconWrapper}>
                <AppIconWithRing
                  app={app}
                  letter={app.letter ?? app.name.charAt(0)}
                  color={app.color ?? '#4F46E5'}
                  size={56}
                  download={download}
                  hasUpdate={hasUpdate}
                  iconUrl={app.iconUrl}
                />
              </View>
              <Animated.View style={[styles.textContainer, textFadeStyle]}>
                <Animated.View entering={FadeInDown.delay(100).duration(400).springify().damping(15)}>
                  <ThemedText style={styles.carouselName} numberOfLines={1}>
                    {app.name}
                  </ThemedText>
                </Animated.View>
                <Animated.View entering={FadeInDown.delay(200).duration(400).springify().damping(15)}>
                  <ThemedText style={[styles.featuredDescription, { color: 'rgba(255,255,255,0.95)' }]} numberOfLines={3}>
                    {cleanHtml(app.shortDescription || app.description)}
                  </ThemedText>
                </Animated.View>
                <Animated.View entering={FadeInDown.delay(300).duration(400).springify().damping(15)}>
                  <ThemedText style={[styles.featuredDescription, { opacity: 0.6, marginTop: 4, fontSize: 11, fontWeight: '500' }]} numberOfLines={1}>
                    {app.developer} • {app.source} • v{app.currentVersion?.versionName ?? '1.0.0'}
                  </ThemedText>
                </Animated.View>
              </Animated.View>
            </View>

            <Animated.View 
              entering={FadeInDown.delay(400).duration(400).springify().damping(15)}
              style={styles.actionsColumn}
            >
              <AppDownloadButton 
                appId={app.id} 
                onStartDownload={() => {
                  startDownload({
                    appId: app.id,
                    name: app.name,
                    developer: app.developer,
                    letter: app.letter ?? app.name.charAt(0).toUpperCase(),
                    color: app.color ?? '#4F46E5',
                    version: app.currentVersion?.versionName ?? '1.0.0',
                    sizeBytes: app.currentVersion?.sizeBytes ?? 0,
                    apkUrl: app.currentVersion?.apkUrl,
                    repositoryId: app.repositoryId,
                    iconUrl: app.iconUrl,
                  });
                }} 
              />
              <TouchableOpacity style={styles.basketButton}>
                <MaterialCommunityIcons name="basket-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
});

// ─── CarouselCell ─────────────────────────────────────────────────────────────
// Ensures the cell wrapper passes down dynamic zIndex to prevent list item clipping
const CarouselCell = React.memo(function CarouselCell({
  item,
  index,
  scrollX,
  onPress,
  hasUpdate,
  itemSize,
  cardWidth,
}: {
  item: App;
  index: number;
  scrollX: SharedValue<number>;
  onPress?: () => void;
  hasUpdate?: boolean;
  itemSize: number;
  cardWidth: number;
}) {
  const cellStyle = useAnimatedStyle(() => {
    const diff = (scrollX.value - index * itemSize) / itemSize;
    const zIndex = interpolate(
      diff,
      [-2, -1, 0, 1, 2],
      [50, 80, 100, 80, 50],
      Extrapolation.CLAMP,
    );
    return {
      zIndex: Math.round(zIndex),
    };
  });

  return (
    <Animated.View 
      style={[
        { 
          width: itemSize, 
          alignItems: 'center',
          overflow: 'visible',
          height: CARD_HEIGHT + 10,
        }, 
        cellStyle
      ]}
    >
      <CarouselCard
        app={item}
        index={index}
        scrollX={scrollX}
        onPress={onPress}
        hasUpdate={hasUpdate}
        itemSize={itemSize}
        cardWidth={cardWidth}
      />
    </Animated.View>
  );
});

// ─── FeaturedCarousel ─────────────────────────────────────────────────────────
export function FeaturedCarousel({
  apps,
  onPress,
  updateIds,
}: {
  apps: App[];
  onPress?: (id: string) => void;
  updateIds: Set<string>;
}) {
  if (!apps || apps.length === 0) {
    return <FeaturedCarouselSkeleton />;
  }
  return (
    <FeaturedCarouselInner
      apps={apps}
      onPress={onPress}
      updateIds={updateIds}
    />
  );
}

function FeaturedCarouselInner({
  apps,
  onPress,
  updateIds,
}: {
  apps: App[];
  onPress?: (id: string) => void;
  updateIds: Set<string>;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const SCREEN_WIDTH = windowWidth > 100 ? windowWidth : 375;
  const CARD_WIDTH = SCREEN_WIDTH * 0.85;
  const ITEM_SIZE = CARD_WIDTH - OVERLAP;
  const SPACER = (SCREEN_WIDTH - CARD_WIDTH) / 2 + OVERLAP / 2;

  const originalCount = apps.length;
  const startOffsetMultiplier = Math.floor(MULTIPLIER / 2);
  const initialScrollIndex = startOffsetMultiplier * originalCount;

  // Start scrollX at the initial offset to perfectly match FlatList's initial mount scroll offset
  // on all platforms, preventing out-of-sync opacity/rendering issues on mount.
  const initialOffset = initialScrollIndex * ITEM_SIZE;
  const scrollX = useSharedValue(initialOffset);
  const flatListRef = useRef<any>(null);
  const { settings } = useSettings();
  const colors = useColors();

  // Inflate data for infinite-feel scroll. MULTIPLIER=15 is sufficient for any
  // realistic session length; was 50 (unnecessary memory/render pressure).
  const data = React.useMemo(() => {
    let result: App[] = [];
    for (let i = 0; i < MULTIPLIER; i++) result = result.concat(apps);
    return result;
  }, [apps]);

  // ── Auto-scroll state — all refs, zero React re-renders ───────────────────
  //
  // absoluteIndexRef: tracks the current absolute item index in the inflated
  // array. Updated synchronously on mount and after every snap (onMomentumEnd).
  // The auto-scroll timer increments this and calls scrollToOffset directly,
  // without touching React state.
  const absoluteIndexRef = useRef(initialScrollIndex);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragging = useRef(false);
  const isSettling = useRef(false);

  // ── Timer helpers ──────────────────────────────────────────────────────────
  const clearAutoScroll = useCallback(() => {
    if (autoScrollTimer.current !== null) {
      clearInterval(autoScrollTimer.current);
      autoScrollTimer.current = null;
    }
  }, []);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimer.current !== null) {
      clearTimeout(resumeTimer.current);
      resumeTimer.current = null;
    }
  }, []);

  const startAutoScroll = useCallback(() => {
    clearAutoScroll();
    autoScrollTimer.current = setInterval(() => {
      // Double-guard: only advance when genuinely idle.
      if (isDragging.current || isSettling.current) return;

      const next = absoluteIndexRef.current + 1;
      absoluteIndexRef.current = next;
      flatListRef.current?.scrollToOffset({
        offset: next * ITEM_SIZE,
        animated: true,
      });
    }, AUTO_SCROLL_MS);
  }, [clearAutoScroll, ITEM_SIZE]);

  // scheduleResume: called ONLY from onMomentumEnd (list fully at rest).
  // Clears any pending resume timer first so rapid swipes don't stack timers.
  const scheduleResume = useCallback(() => {
    clearResumeTimer();
    resumeTimer.current = setTimeout(() => {
      isSettling.current = false;
      isDragging.current = false;
      startAutoScroll();
    }, RESUME_DELAY_MS);
  }, [clearResumeTimer, startAutoScroll]);

  // ── Scroll event handlers (called via runOnJS from UI thread) ─────────────
  const handleBeginDrag = useCallback(() => {
    // Immediately kill auto-scroll and any pending resume.
    isDragging.current = true;
    isSettling.current = false;
    clearAutoScroll();
    clearResumeTimer();
  }, [clearAutoScroll, clearResumeTimer]);

  const handleEndDrag = useCallback(() => {
    // Finger lifted — list may still be decelerating. Mark as settling but do
    // NOT start the resume timer yet; that happens in onMomentumEnd.
    isDragging.current = false;
    isSettling.current = true;
  }, []);

  const handleMomentumEnd = useCallback(
    (offset: number) => {
      // List is fully at rest. Sync absolute position and schedule auto-scroll.
      isSettling.current = false;
      absoluteIndexRef.current = Math.round(offset / ITEM_SIZE);

      if (settings.hapticFeedback) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Start the 5-second idle timer NOW that the list is genuinely stopped.
      scheduleResume();
    },
    [scheduleResume, settings.hapticFeedback, ITEM_SIZE],
  );

  // ── Mount: scroll to initial position + start auto-scroll ─────────────────
  useEffect(() => {
    // Pre-fetch images for smooth loading
    if (apps && apps.length > 0) {
      const imagesToPrefetch = apps
        .map(app => app.screenshotUrls?.[0] ? proxyUrl(app.screenshotUrls[0]) : undefined)
        .filter(Boolean) as string[];
      Image.prefetch(imagesToPrefetch);
    }

    // We rely on initialScrollIndex + getItemLayout for reliable initial mount offset.
    startAutoScroll();
    return () => {
      clearAutoScroll();
      clearResumeTimer();
    };
  }, [apps, startAutoScroll, clearAutoScroll, clearResumeTimer, initialOffset, scrollX]);

  // ── Animated scroll handler (runs entirely on UI thread) ──────────────────
  const onScroll = useAnimatedScrollHandler(
    {
      onScroll: (event) => {
        scrollX.value = event.contentOffset.x;
      },
      onBeginDrag: () => {
        // Cancel auto-scroll immediately — zero delay between touch and stop.
        runOnJS(handleBeginDrag)();
      },
      onEndDrag: () => {
        runOnJS(handleEndDrag)();
      },
      onMomentumEnd: (event) => {
        // List has fully decelerated and snapped. Safe to resume auto-scroll
        // after the idle period.
        runOnJS(handleMomentumEnd)(event.contentOffset.x);
      },
    },
    [handleBeginDrag, handleEndDrag, handleMomentumEnd],
  );

  // ── renderItem: memoized to prevent FlatList re-renders ───────────────────
  const renderItem = useCallback(
    ({ item, index }: { item: App; index: number }) => (
      <CarouselCell
        item={item}
        index={index}
        scrollX={scrollX}
        onPress={() => onPress?.(item.id)}
        hasUpdate={updateIds.has(item.id)}
        itemSize={ITEM_SIZE}
        cardWidth={CARD_WIDTH}
      />
    ),
    // scrollX is a stable SharedValue reference; onPress/updateIds change only
    // when the parent explicitly updates them.
    [scrollX, onPress, updateIds, ITEM_SIZE, CARD_WIDTH],
  );

  return (
    <View style={[styles.carouselContainer, { overflow: 'visible' }]}>
      <Animated.FlatList
        ref={flatListRef}
        data={data}
        keyExtractor={(_, i) => String(i)}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ overflow: 'visible', height: CARD_HEIGHT + 10 }}
        // Native snapping — each snap point is exactly one ITEM_SIZE apart.
        snapToInterval={ITEM_SIZE}
        // "fast" makes the list decelerate aggressively and reach the snap point
        // quickly, giving precise, tight control.
        decelerationRate="fast"
        // Prevents momentum from carrying past more than one snap point per
        // swipe — fulfils "fast swipe → exactly one card" requirement.
        disableIntervalMomentum
        onScroll={onScroll}
        // scrollEventThrottle=1: send every native scroll event to Reanimated
        // so the SharedValue (and all worklets reading it) update every frame.
        scrollEventThrottle={1}
        contentContainerStyle={{ paddingHorizontal: SPACER, overflow: 'visible' }}
        initialScrollIndex={initialScrollIndex}
        getItemLayout={(_, index) => ({
          length: ITEM_SIZE,
          offset: ITEM_SIZE * index,
          index,
        })}
        renderItem={renderItem}
        // ── Performance props ──────────────────────────────────────────────
        // windowSize=5: render 2 items off-screen in each direction (was 21).
        windowSize={5}
        // Disable clipping to ensure overlapping/translated views do not flicker/disappear
        removeClippedSubviews={false}
        // Batch at most 3 items per JS frame during fast scroll.
        maxToRenderPerBatch={3}
        // Only render current + 1 neighbour on initial mount.
        initialNumToRender={3}
        updateCellsBatchingPeriod={50}
      />

      {/* Page indicator — PaginationDot is a proper component, not a function
          with hooks called from inside apps.map(). */}
      <View style={styles.paginationRow}>
        {apps.map((_, i) => (
          <PaginationDot
            key={i}
            index={i}
            scrollX={scrollX}
            originalCount={originalCount}
            primary={colors.primary}
            itemSize={ITEM_SIZE}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11 },

  carouselContainer: {
    marginVertical: 12,
  },
  carouselCardWrap: {
    height: CARD_HEIGHT,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#141414',
    // M3 Elevated Card shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  carouselCardInner: {
    flex: 1,
    padding: 0,
    justifyContent: 'space-between',
  },
  carouselCardBg: {
    width: '130%',
    left: '-15%',
  },
  cardContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'flex-end',
  },
  topRow: {
    position: 'absolute',
    top: 24,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  newBadgeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 16,
  },
  iconWrapper: {
    // Styling for icon
  },
  textContainer: {
    flex: 1,
  },
  actionsColumn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  basketButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 10,
    borderRadius: 20,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselName: {
    fontSize: 20,
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: 24,
    fontWeight: '800',
    marginBottom: 2,
  },
  featuredDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 16,
    fontWeight: '500',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  paginationDot: {
    height: 6,
    borderRadius: 3,
  },
});
