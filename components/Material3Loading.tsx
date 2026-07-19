import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle, Rect, Path } from 'react-native-svg';

const SHAPES_COUNT = 6;
const CYCLE_DURATION = 400; // 220ms visible + 180ms morph transition

export function Material3Loading({ color }: { color: string }) {
  const step = useSharedValue(0);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const interval = setInterval(() => {
      // Step transitions to next shape with spring physics
      step.value = withSpring(step.value + 1, { 
        damping: 14,
        stiffness: 120,
        mass: 0.8,
      });

      // Subtle rotation for organic feel
      rotation.value = withSpring(rotation.value + 15, {
        damping: 14,
        stiffness: 120,
        mass: 0.8,
      });

      // Subtle scale pulse (0.92 to 1.08)
      scale.value = withSequence(
        withTiming(1.08, { duration: 100, easing: Easing.out(Easing.ease) }),
        withTiming(0.92, { duration: 100, easing: Easing.in(Easing.ease) }),
        withSpring(1, { damping: 10, stiffness: 100 })
      );
    }, CYCLE_DURATION);

    return () => clearInterval(interval);
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value }
    ]
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.shapeContainer, containerStyle]}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <ShapeItem key={i} index={i} step={step} color={color} />
        ))}
      </Animated.View>
    </View>
  );
}

function ShapeItem({ index, step, color }: { index: number, step: Animated.SharedValue<number>, color: string }) {
  const animatedStyle = useAnimatedStyle(() => {
    const currentFloatIndex = step.value % SHAPES_COUNT;
    
    let dist = Math.abs(currentFloatIndex - index);
    if (dist > SHAPES_COUNT / 2) {
      dist = SHAPES_COUNT - dist;
    }
    
    const opacity = Math.max(0, 1 - dist);

    return {
      opacity,
      position: 'absolute',
      // Adding a scale effect creates a morphing illusion during crossfade
      transform: [
        { scale: 0.85 + 0.15 * opacity }
      ]
    };
  });

  return (
    <Animated.View style={[styles.item, animatedStyle]}>
      <Svg width="36" height="36" viewBox="0 0 24 24">
        {index === 0 && <Circle cx="12" cy="12" r="10" fill={color} />}
        {index === 1 && <Rect x="3" y="3" width="18" height="18" rx="6" fill={color} />}
        {index === 2 && <Path d="M12 3 C12.8 3 13.5 3.5 13.8 4.2 L21.5 18 C22 19.2 21 20.5 19.8 20.5 L4.2 20.5 C3 20.5 2 19.2 2.5 18 L10.2 4.2 C10.5 3.5 11.2 3 12 3 Z" fill={color} />}
        {index === 3 && <Path d="M8.5 3 L15.5 3 C16.5 3 17.2 3.5 17.8 4.2 L21.2 9.8 C21.8 11 21.8 12.5 21.2 13.7 L17.8 19.3 C17.2 20 16.5 20.5 15.5 20.5 L8.5 20.5 C7.5 20.5 6.8 20 6.2 19.3 L2.8 13.7 C2.2 12.5 2.2 11 2.8 9.8 L6.2 4.2 C6.8 3.5 7.5 3 8.5 3 Z" fill={color} />}
        {index === 4 && <Path d="M12 2 C12.8 2 13.2 2.2 13.8 2.8 L21.2 10.2 C22 11.2 22 12.8 21.2 13.8 L13.8 21.2 C13.2 21.8 12.8 22 12 22 C11.2 22 10.8 21.8 10.2 21.2 L2.8 13.8 C2 12.8 2 11.2 2.8 10.2 L10.2 2.8 C10.8 2.2 11.2 2 12 2 Z" fill={color} />}
        {index === 5 && <Rect x="2" y="7" width="20" height="10" rx="5" fill={color} />}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 36,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shapeContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    position: 'absolute',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
