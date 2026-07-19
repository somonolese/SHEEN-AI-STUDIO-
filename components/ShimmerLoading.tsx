import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';

interface ShimmerLoadingProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Reusable Shimmer Loading Component
 * Animates a glowing sliding pulse highlights mask across a track, perfect for queued or skeleton items.
 */
export function ShimmerLoading({
  width = '100%',
  height = 8,
  borderRadius = 4,
  style,
}: ShimmerLoadingProps) {
  const colors = useColors();

  const pulse = useSharedValue(0.25);
  const left = useSharedValue(-60);

  useEffect(() => {
    // Pulse animation
    pulse.value = withRepeat(
      withTiming(0.65, { duration: 1100, easing: Easing.bezier(0.4, 0, 0.6, 1) }),
      -1,
      true
    );

    // Sliding highlight animation
    left.value = -60;
    left.value = withRepeat(
      withTiming(120, { duration: 1500, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
      -1,
      false
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => {
    return {
      opacity: pulse.value,
    };
  });

  const slideStyle = useAnimatedStyle(() => {
    return {
      left: `${left.value}%`,
    };
  });

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.surfaceContainerHighest,
        },
        style,
      ]}
    >
      {/* Ambient background pulse */}
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: colors.primary,
            width: '100%',
            height: '100%',
          },
          pulseStyle,
        ]}
      />

      {/* Sliding bright highlight */}
      <Animated.View
        style={[
          styles.highlight,
          {
            backgroundColor: '#FFFFFF',
            opacity: 0.35,
            width: '40%',
            height: '100%',
          },
          slideStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  highlight: {
    position: 'absolute',
    top: 0,
  },
});
