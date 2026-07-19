import React from 'react';
import { Pressable, PressableProps, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

interface AnimatedPressableProps extends PressableProps {
  children: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
  style?: ViewStyle | ((state: { pressed: boolean }) => ViewStyle);
  scaleValue?: number;
  haptic?: boolean;
}

export function AnimatedPressable({
  children,
  style,
  scaleValue = 0.97,
  haptic = false,
  onPressIn,
  onPressOut,
  onPress,
  ...props
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = (e: any) => {
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(scaleValue, {
      damping: 12,
      stiffness: 350,
      mass: 0.5,
    });
    if (onPressIn) onPressIn(e);
  };

  const handlePressOut = (e: any) => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
      mass: 0.5,
    });
    if (onPressOut) onPressOut(e);
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      {...props}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            typeof style === 'function' ? style({ pressed }) : style,
            animatedStyle,
          ]}
        >
          {typeof children === 'function' ? children({ pressed }) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}
