import React, { useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent, useWindowDimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  SharedValue,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated';
import { SmartImage } from './SmartImage';
import { useColors } from '@/hooks/useColors';

interface ParallaxWrapperProps {
  scrollY: SharedValue<number>;
  backgroundImageUrl?: string;
  height?: number;
  parallaxFactor?: number;
  children: React.ReactNode;
}

/**
 * Reusable Parallax Wrapper Component with Reveal Animation
 * Animates the background at a slower rate than scrolling, and triggers
 * a beautiful fade-in + slide-up reveal when scrolled into view.
 */
export function ParallaxWrapper({
  scrollY,
  backgroundImageUrl = 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
  height = 320,
  parallaxFactor = 0.45,
  children,
}: ParallaxWrapperProps) {
  const colors = useColors();
  const { height: screenHeight } = useWindowDimensions();

  // Layout positions
  const [layoutY, setLayoutY] = useState(0);
  const revealProgress = useSharedValue(0);
  const hasRevealed = useSharedValue(false);

  // Measure self position
  const handleLayout = (event: LayoutChangeEvent) => {
    const y = event.nativeEvent.layout.y;
    setLayoutY(y);
  };

  // Safe scroll-into-view tracking
  useAnimatedReaction(
    () => {
      // Trigger reveal when item is within the viewport
      const threshold = layoutY - screenHeight * 0.95;
      return scrollY.value >= threshold || layoutY < screenHeight; // Auto-trigger if starting inside screen
    },
    (isInViewport) => {
      if (isInViewport && !hasRevealed.value) {
        hasRevealed.value = true;
        // Smooth fade-in + upward slide
        revealProgress.value = withTiming(1, {
          duration: 900,
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        });
      }
    },
    [layoutY, screenHeight]
  );

  // Background parallax + reveal styling
  const bgAnimatedStyle = useAnimatedStyle(() => {
    // Scroll translation
    const translateY = interpolate(
      scrollY.value,
      [layoutY - screenHeight, layoutY, layoutY + height],
      [-height * parallaxFactor, 0, height * parallaxFactor],
      Extrapolation.CLAMP
    );

    // Zoom/Scale effect during reveal
    const scale = interpolate(
      revealProgress.value,
      [0, 1],
      [1.15, 1],
      Extrapolation.CLAMP
    );

    // Reveal upward slide
    const revealSlideY = interpolate(
      revealProgress.value,
      [0, 1],
      [25, 0],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateY: translateY + revealSlideY },
        { scale },
      ],
      opacity: revealProgress.value,
    };
  });

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.container,
        {
          height,
          backgroundColor: colors.surfaceContainerLowest,
        },
      ]}
    >
      {/* Background Image Container with Parallax & Reveal */}
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.backgroundWrap, bgAnimatedStyle]}>
          <SmartImage
            source={{ uri: backgroundImageUrl }}
            style={styles.backgroundImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={300}
          />
          {/* Elegant Dark Vignette Overlays for readability and integration */}
          <View style={[StyleSheet.absoluteFill, styles.overlayScrim]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: 0.25 }]} />
        </Animated.View>
      </View>

      {/* Foreground Content */}
      <View style={styles.contentContainer}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 'auto',
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    marginVertical: 12,
  },
  backgroundWrap: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  overlayScrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
});
