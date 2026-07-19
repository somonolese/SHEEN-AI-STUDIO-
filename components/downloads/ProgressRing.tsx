import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { 
  useAnimatedProps, 
  useSharedValue, 
  withSpring, 
  withTiming,
  interpolate,
  useAnimatedStyle
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function ProgressRing({
  progress,
  size = 44,
  strokeWidth = 3.5,
  color,
  trackColor,
  showPercent = true,
  icon,
  iconColor,
  indeterminate = false,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor: string;
  showPercent?: boolean;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconColor?: string;
  indeterminate?: boolean;
}) {
  const animatedProgress = useSharedValue(progress);
  const rotation = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withSpring(progress, { damping: 18, stiffness: 100 });
  }, [progress]);

  useEffect(() => {
    if (indeterminate) {
      rotation.value = withTiming(360, { duration: 1000 }, (finished) => {
        if (finished) {
          rotation.value = 0;
          // Loop is handled by repeating or recursive call if needed, 
          // but withTiming can be replaced by withRepeat
        }
      });
      // Better way for continuous rotation:
      // rotation.value = withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1);
    }
  }, [indeterminate]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animatedProps = useAnimatedProps(() => {
    const dashoffset = circumference * (1 - animatedProgress.value);
    return {
      strokeDashoffset: dashoffset,
    };
  });

  const percent = Math.round(progress * 100);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          fill="none"
        />
      </Svg>
      <View style={styles.center}>
        {icon ? (
          <MaterialCommunityIcons name={icon} size={size * 0.42} color={iconColor ?? color} />
        ) : showPercent && !indeterminate ? (
          <ThemedText style={{ fontSize: size * 0.24, fontWeight: '800', color }}>{percent}%</ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
