import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  interpolate,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { ThemedText } from '@/components/ThemedText';
import { SheenIcon } from '@/components/SheenIcon';
import { Material3Loading } from '@/components/Material3Loading';

interface SplashScreenViewProps {
  ready: boolean;
  onFinish: () => void;
}

export function SplashScreenView({ ready, onFinish }: SplashScreenViewProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  // Animation values for transition
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  const isTransitioning = useRef(false);
  const minimumTimePassed = useRef(false);

  useEffect(() => {
    // The app handles minimum loading time if needed, we should transition immediately when ready
    minimumTimePassed.current = true;
    if (ready) {
      checkTransition();
    }
  }, [ready]);

  const checkTransition = () => {
    if (ready && minimumTimePassed.current && !isTransitioning.current) {
      isTransitioning.current = true;
      
      // Material 3 Shared Axis (Z-axis / Fade) Transition
      // 1. Soft fade out
      // 2. Subtle upward shift
      // 3. Very subtle scale up to "hand off" to the app below
      
      opacity.value = withTiming(0, {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      });

      translateY.value = withTiming(-20, {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      });

      scale.value = withTiming(1.05, {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      }, (finished) => {
        if (finished) {
          runOnJS(onFinish)();
        }
      });
    }
  };

  const containerStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      backgroundColor: colors.background,
    };
  });

  const contentStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { scale: scale.value }
      ],
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    };
  });

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.View style={contentStyle}>
        <View style={styles.iconWrapper}>
          <SheenIcon size={96} />
        </View>

        <View style={styles.loadingWrapper}>
          <Material3Loading color={colors.primary} />
        </View>
      </Animated.View>

      <Animated.View 
        style={[
          styles.footer, 
          { paddingBottom: Math.max(insets.bottom, 24) }
        ]}
      >
        <ThemedText style={[styles.footerText, { color: colors.onSurfaceVariant }]}>
          Made by ❤️ in Kashmir
        </ThemedText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    ...Platform.select({
      web: { position: 'fixed' as 'absolute' },
      default: {},
    }),
  },
  iconWrapper: {
    marginBottom: 48, // Generous whitespace around the icon
  },
  loadingWrapper: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.25,
    opacity: 0.7,
  },
});
