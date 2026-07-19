import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  Platform,
  Dimensions,
  AccessibilityInfo,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  useReducedMotion,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useCatalog } from '@/contexts/CatalogContext';
import { ThemedText } from '@/components/ThemedText';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Threshold distance to trigger refresh
const THRESHOLD = 85;
const MAX_PULL = 135;

export interface ScrollProps {
  scrollEnabled: boolean;
  onScroll: (event: any) => void;
  scrollEventThrottle: number;
}

interface PremiumPullToRefreshProps {
  refreshing: boolean;
  onRefresh: () => Promise<void> | void;
  children: (scrollProps: ScrollProps) => React.ReactNode;
}

export function PremiumPullToRefresh({
  refreshing,
  onRefresh,
  children,
}: PremiumPullToRefreshProps) {
  const colors = useColors();
  const { apps, syncState } = useCatalog();
  const isReducedMotion = useReducedMotion();

  // Internal states
  const [refreshState, setRefreshState] = useState<'idle' | 'pulling' | 'refreshing' | 'success'>('idle');
  const [accessibleAnnouncement, setAccessibleAnnouncement] = useState('');

  // Animation shared values
  const pullDistance = useSharedValue(0);
  const shimmerOffset = useSharedValue(-150);
  
  // Icon burst positions and scales
  const iconScale1 = useSharedValue(0);
  const iconScale2 = useSharedValue(0);
  const iconScale3 = useSharedValue(0);
  const iconScale4 = useSharedValue(0);

  const iconX1 = useSharedValue(0);
  const iconY1 = useSharedValue(0);
  const iconX2 = useSharedValue(0);
  const iconY2 = useSharedValue(0);
  const iconX3 = useSharedValue(0);
  const iconY3 = useSharedValue(0);
  const iconX4 = useSharedValue(0);
  const iconY4 = useSharedValue(0);

  const iconRot1 = useSharedValue(0);
  const iconRot2 = useSharedValue(0);
  const iconRot3 = useSharedValue(0);
  const iconRot4 = useSharedValue(0);

  const iconOpacity = useSharedValue(0);

  // Track scroll position
  const scrollY = useRef(0);
  const isPulling = useRef(false);

  const triggerHaptic = useCallback((style: 'medium' | 'success') => {
    if (Platform.OS === 'web') return;
    if (style === 'medium') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, []);

  // Fetch 4 distinct apps with high quality assets to show during pull-to-refresh
  const refreshIcons = useMemo(() => {
    if (!apps || apps.length === 0) return [];
    // Prioritize apps with icon URLs and good rating/developer
    const sorted = [...apps]
      .filter((app) => app.iconUrl)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const selection = sorted.slice(0, 4);
    // Fallback if not enough apps
    while (selection.length < 4 && apps.length > selection.length) {
      const fallbackApp = apps.find(a => !selection.includes(a));
      if (fallbackApp) selection.push(fallbackApp);
      else break;
    }
    return selection;
  }, [apps]);

  // Handle trigger animations
  const triggerIconBurst = useCallback(() => {
    iconOpacity.value = withTiming(1, { duration: 150 });
    
    // Scale up with spring
    const springConfig = { damping: 12, stiffness: 100 };
    iconScale1.value = withSpring(1, springConfig);
    iconScale2.value = withSpring(1, springConfig);
    iconScale3.value = withSpring(1, springConfig);
    iconScale4.value = withSpring(1, springConfig);

    // Staggered horizontal & vertical explosions
    iconX1.value = withSpring(-60, springConfig);
    iconY1.value = withSpring(-15, springConfig);

    iconX2.value = withSpring(60, springConfig);
    iconY2.value = withSpring(-15, springConfig);

    iconX3.value = withSpring(-30, springConfig);
    iconY3.value = withSpring(25, springConfig);

    iconX4.value = withSpring(30, springConfig);
    iconY4.value = withSpring(25, springConfig);

    // Subtle drift rotation loop
    if (!isReducedMotion) {
      iconRot1.value = withRepeat(withTiming(360, { duration: 6000, easing: Easing.linear }), -1, false);
      iconRot2.value = withRepeat(withTiming(-360, { duration: 7500, easing: Easing.linear }), -1, false);
      iconRot3.value = withRepeat(withTiming(360, { duration: 9000, easing: Easing.linear }), -1, false);
      iconRot4.value = withRepeat(withTiming(-360, { duration: 8000, easing: Easing.linear }), -1, false);
    }
  }, [isReducedMotion]);

  // Clean up burst values
  const resetIconBurst = useCallback((fadeOutDuration = 300) => {
    iconOpacity.value = withTiming(0, { duration: fadeOutDuration });
    iconScale1.value = withTiming(0, { duration: fadeOutDuration });
    iconScale2.value = withTiming(0, { duration: fadeOutDuration });
    iconScale3.value = withTiming(0, { duration: fadeOutDuration });
    iconScale4.value = withTiming(0, { duration: fadeOutDuration });

    iconX1.value = withTiming(0, { duration: fadeOutDuration });
    iconY1.value = withTiming(0, { duration: fadeOutDuration });
    iconX2.value = withTiming(0, { duration: fadeOutDuration });
    iconY2.value = withTiming(0, { duration: fadeOutDuration });
    iconX3.value = withTiming(0, { duration: fadeOutDuration });
    iconY3.value = withTiming(0, { duration: fadeOutDuration });
    iconX4.value = withTiming(0, { duration: fadeOutDuration });
    iconY4.value = withTiming(0, { duration: fadeOutDuration });

    iconRot1.value = 0;
    iconRot2.value = 0;
    iconRot3.value = 0;
    iconRot4.value = 0;
  }, []);

  // Shimmer loop across glass panel
  useEffect(() => {
    if (refreshState === 'refreshing') {
      shimmerOffset.value = withRepeat(
        withTiming(SCREEN_WIDTH + 150, { duration: 1800, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
        -1,
        false
      );
    } else {
      shimmerOffset.value = -150;
    }
  }, [refreshState]);

  // Listen to refreshing prop to control completion
  useEffect(() => {
    if (refreshing && refreshState === 'idle') {
      // Triggered from outside (e.g., initial loading)
      setRefreshState('refreshing');
      pullDistance.value = withSpring(THRESHOLD, { damping: 15, stiffness: 120 });
      triggerIconBurst();
    } else if (!refreshing && refreshState === 'refreshing') {
      // Completed!
      setRefreshState('success');
      triggerHaptic('success');
      setAccessibleAnnouncement('Repository synchronized successfully');
      AccessibilityInfo.announceForAccessibility('Repository synchronized successfully');

      // Gently dissolve
      setTimeout(() => {
        resetIconBurst(400);
        pullDistance.value = withSpring(0, { damping: 18, stiffness: 100 }, (finished) => {
          if (finished) {
            runOnJS(setRefreshState)('idle');
          }
        });
      }, 1000);
    }
  }, [refreshing, refreshState, triggerIconBurst, resetIconBurst, triggerHaptic]);

  // Create PanResponder to capture pull gestures
  const refreshStateRef = useRef(refreshState);
  useEffect(() => {
    refreshStateRef.current = refreshState;
  }, [refreshState]);

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isScrollAtTop = scrollY.current <= 3;
        const isDraggingDown = gestureState.dy > 5;
        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5;
        const state = refreshStateRef.current;

        if (isScrollAtTop && isDraggingDown && isVerticalSwipe && state !== 'refreshing' && state !== 'success') {
          isPulling.current = true;
          return true;
        }
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        const isScrollAtTop = scrollY.current <= 3;
        const isDraggingDown = gestureState.dy > 5;
        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5;
        const state = refreshStateRef.current;

        if (isScrollAtTop && isDraggingDown && isVerticalSwipe && state !== 'refreshing' && state !== 'success') {
          isPulling.current = true;
          return true;
        }
        return false;
      },
      onPanResponderGrant: () => {
        setRefreshState('pulling');
        setAccessibleAnnouncement('Pulling down to refresh');
      },
      onPanResponderMove: (_, gestureState) => {
        if (!isPulling.current) return;
        const dy = gestureState.dy;
        if (dy > 0) {
          // Apply a smooth non-linear resistance formula (Spring-like stretch)
          let targetDistance = 0;
          if (dy <= 150) {
            targetDistance = dy * 0.6;
          } else {
            targetDistance = 90 + (dy - 150) * 0.25;
          }
          // Cap at max pull
          targetDistance = Math.min(MAX_PULL, targetDistance);
          
          pullDistance.value = targetDistance;

          // Haptic tick when passing threshold
          const thresholdReached = targetDistance >= THRESHOLD;
          const wasThresholdReached = pullDistance.value >= THRESHOLD;
          if (thresholdReached && !wasThresholdReached) {
            triggerHaptic('medium');
          }
        }
      },
      onPanResponderRelease: () => {
        isPulling.current = false;
        const currentPull = pullDistance.value;

        if (currentPull >= THRESHOLD) {
          setRefreshState('refreshing');
          setAccessibleAnnouncement('Refreshing repository metadata');
          triggerHaptic('medium');
          
          pullDistance.value = withSpring(THRESHOLD, { damping: 14, stiffness: 120 });
          triggerIconBurst();

          // Trigger refresh callback
          onRefresh();
        } else {
          setRefreshState('idle');
          pullDistance.value = withSpring(0, { damping: 16, stiffness: 150 });
        }
      },
      onPanResponderTerminate: () => {
        isPulling.current = false;
        setRefreshState('idle');
        pullDistance.value = withSpring(0, { damping: 16, stiffness: 150 });
      },
    });
  }, [onRefresh, triggerHaptic, triggerIconBurst]);

  // Connect scroll events to track scroll offset
  const handleScroll = useCallback((event: any) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
  }, []);

  // Animated styles for pull container height & stretch
  const animatedHeaderStyle = useAnimatedStyle(() => {
    return {
      height: pullDistance.value,
      opacity: pullDistance.value > 0 ? 1 : 0,
    };
  });

  const animatedProgressStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, pullDistance.value / THRESHOLD);
    return {
      width: `${progress * 100}%`,
      opacity: refreshState === 'refreshing' || refreshState === 'success' ? 0 : 1,
    };
  });

  // Soft glow style following the drag
  const animatedGlowStyle = useAnimatedStyle(() => {
    const scale = Math.min(2, 0.5 + (pullDistance.value / THRESHOLD) * 1.5);
    const opacity = Math.min(0.2, (pullDistance.value / THRESHOLD) * 0.2);
    return {
      transform: [{ scale }],
      opacity: refreshState === 'success' ? withTiming(0.05) : opacity,
    };
  });

  // Animated styles for each emerging app icon
  const iconStyle1 = useAnimatedStyle(() => ({
    transform: [
      { translateX: iconX1.value },
      { translateY: iconY1.value },
      { scale: iconScale1.value },
      { rotate: `${iconRot1.value}deg` },
    ],
    opacity: iconOpacity.value,
  }));

  const iconStyle2 = useAnimatedStyle(() => ({
    transform: [
      { translateX: iconX2.value },
      { translateY: iconY2.value },
      { scale: iconScale2.value },
      { rotate: `${iconRot2.value}deg` },
    ],
    opacity: iconOpacity.value,
  }));

  const iconStyle3 = useAnimatedStyle(() => ({
    transform: [
      { translateX: iconX3.value },
      { translateY: iconY3.value },
      { scale: iconScale3.value },
      { rotate: `${iconRot3.value}deg` },
    ],
    opacity: iconOpacity.value,
  }));

  const iconStyle4 = useAnimatedStyle(() => ({
    transform: [
      { translateX: iconX4.value },
      { translateY: iconY4.value },
      { scale: iconScale4.value },
      { rotate: `${iconRot4.value}deg` },
    ],
    opacity: iconOpacity.value,
  }));

  // Glass panel shimmering overlay position
  const animatedShimmerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: shimmerOffset.value }],
    };
  });

  const scrollProps: ScrollProps = useMemo(() => ({
    scrollEnabled: refreshState === 'idle',
    onScroll: handleScroll,
    scrollEventThrottle: 16,
  }), [refreshState, handleScroll]);

  return (
    <View style={styles.root} {...panResponder.panHandlers}>
      {/* Premium Translucent Frosted Glass Header */}
      <Animated.View style={[styles.headerContainer, animatedHeaderStyle]}>
        <BlurView
          intensity={Platform.OS === 'web' ? 0 : 35}
          tint={colors.scheme === 'dark' ? 'dark' : 'light'}
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: Platform.OS === 'web'
                ? `${colors.surfaceContainerLowest}d0`
                : `${colors.surfaceContainerLowest}80`,
            },
          ]}
        >
          {/* Accent-colored soft glow in the background */}
          <Animated.View
            style={[
              styles.glow,
              { backgroundColor: colors.primary },
              animatedGlowStyle,
            ]}
          />

          {/* Shimmer effect during refresh */}
          {refreshState === 'refreshing' && (
            <Animated.View
              style={[
                styles.shimmerLine,
                { backgroundColor: `${colors.primary}25` },
                animatedShimmerStyle,
              ]}
            />
          )}

          {/* Floating/staggered icons container */}
          <View style={styles.iconsWrapper}>
            {refreshIcons[0] && (
              <Animated.View style={[styles.floatingIconFrame, iconStyle1]}>
                <Image
                  source={refreshIcons[0].iconUrl || undefined}
                  style={styles.iconImage}
                  placeholder={refreshIcons[0].letter}
                  placeholderContentFit="contain"
                />
              </Animated.View>
            )}
            {refreshIcons[1] && (
              <Animated.View style={[styles.floatingIconFrame, iconStyle2]}>
                <Image
                  source={refreshIcons[1].iconUrl || undefined}
                  style={styles.iconImage}
                  placeholder={refreshIcons[1].letter}
                  placeholderContentFit="contain"
                />
              </Animated.View>
            )}
            {refreshIcons[2] && (
              <Animated.View style={[styles.floatingIconFrame, iconStyle3]}>
                <Image
                  source={refreshIcons[2].iconUrl || undefined}
                  style={styles.iconImage}
                  placeholder={refreshIcons[2].letter}
                  placeholderContentFit="contain"
                />
              </Animated.View>
            )}
            {refreshIcons[3] && (
              <Animated.View style={[styles.floatingIconFrame, iconStyle4]}>
                <Image
                  source={refreshIcons[3].iconUrl || undefined}
                  style={styles.iconImage}
                  placeholder={refreshIcons[3].letter}
                  placeholderContentFit="contain"
                />
              </Animated.View>
            )}

            {/* Static Central Status Indicator */}
            {refreshState === 'success' ? (
              <Animated.View
                entering={withSequence(withSpring(1.2), withSpring(1))}
                style={[styles.centerStatus, { backgroundColor: '#2E7D32' }]}
              >
                <MaterialCommunityIcons name="check" size={24} color="#FFFFFF" />
              </Animated.View>
            ) : (
              <View style={[styles.centerStatus, { backgroundColor: colors.surfaceContainer }]}>
                <MaterialCommunityIcons
                  name={refreshState === 'refreshing' ? 'cloud-sync-outline' : 'rhombus-split-outline'}
                  size={22}
                  color={colors.primary}
                />
              </View>
            )}
          </View>

          {/* Subtle Accent-Colored Progress Indicator Bar */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressBar,
                { backgroundColor: colors.primary },
                animatedProgressStyle,
              ]}
            />
          </View>
        </BlurView>
      </Animated.View>

      {/* Screen reader helper announcement */}
      <View
        style={styles.screenReaderText}
        accessible
        accessibilityLabel={accessibleAnnouncement || 'Pull down to refresh'}
      />

      {/* Content Scroll Area */}
      <View style={styles.contentContainer}>
        {children(scrollProps)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  headerContainer: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 100,
  },
  glow: {
    position: 'absolute',
    top: -60,
    alignSelf: 'center',
    width: 150,
    height: 150,
    borderRadius: 75,
    blurRadius: 40,
    opacity: 0,
  },
  shimmerLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 150,
    transform: [{ skewX: '-25deg' }],
  },
  iconsWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  floatingIconFrame: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  iconImage: {
    width: '100%',
    height: '100%',
  },
  centerStatus: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 10,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'transparent',
  },
  progressBar: {
    height: '100%',
    alignSelf: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  screenReaderText: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
