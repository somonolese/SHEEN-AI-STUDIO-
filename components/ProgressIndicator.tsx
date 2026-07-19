import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';

interface ProgressIndicatorProps {
  progress?: number; // 0 to 1
  indeterminate?: boolean;
  height?: number;
  color?: string;
  trackColor?: string;
  style?: ViewStyle;
}

/**
 * Reusable Material 3 Progress Indicator
 * Supports both determinate (smooth spring updates) and indeterminate (expressive linear motion) states.
 */
export function ProgressIndicator({
  progress = 0,
  indeterminate = false,
  height = 4,
  color,
  trackColor,
  style,
}: ProgressIndicatorProps) {
  const colors = useColors();
  const activeColor = color || colors.primary;
  const activeTrackColor = trackColor || colors.surfaceContainerHighest;

  const left = useSharedValue(-40);
  const animatedProgress = useSharedValue(progress);

  useEffect(() => {
    if (indeterminate) {
      left.value = -40;
      left.value = withRepeat(
        withTiming(110, { duration: 1600, easing: Easing.bezier(0.2, 0, 0, 1) }),
        -1,
        false
      );
    } else {
      animatedProgress.value = withSpring(progress, { damping: 15, stiffness: 120 });
    }
  }, [indeterminate, progress]);

  const determinateStyle = useAnimatedStyle(() => {
    return {
      width: `${Math.min(Math.max(animatedProgress.value * 100, 0), 100)}%`,
    };
  });

  const indeterminateStyle = useAnimatedStyle(() => {
    return {
      left: `${left.value}%`,
      width: '35%',
      position: 'absolute',
    };
  });

  return (
    <View style={[styles.track, { height, backgroundColor: activeTrackColor }, style]}>
      {indeterminate ? (
        <Animated.View
          style={[
            styles.fill,
            { height, backgroundColor: activeColor },
            indeterminateStyle,
          ]}
        />
      ) : (
        <Animated.View
          style={[
            styles.fill,
            { height, backgroundColor: activeColor },
            determinateStyle,
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});
