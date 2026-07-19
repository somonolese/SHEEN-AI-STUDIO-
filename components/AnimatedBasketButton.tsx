import React, { useEffect } from 'react';
import { StyleSheet, Pressable, ViewStyle, TextStyle, Platform } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  interpolateColor,
  interpolate,
  useSharedValue,
  Extrapolation
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { M3_SPRING_PRESS, M3_SPRING_RETURN } from '@/components/animations';

interface Props {
  inBasket: boolean;
  onPress: (e: any) => void;
  style?: any;
  textStyle?: any;
  colors: any;
  iconSize?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AnimatedBasketButton({ inBasket, onPress, style, textStyle, colors, iconSize = 18 }: Props) {
  const progress = useSharedValue(inBasket ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    progress.value = withSpring(inBasket ? 1 : 0, {
      damping: 20,
      stiffness: 200,
      mass: 0.8
    });
  }, [inBasket, progress]);

  const handlePressIn = () => {
    scale.value = withSpring(1.06, M3_SPRING_PRESS);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, M3_SPRING_RETURN);
  };

  const containerStyle = useAnimatedStyle(() => {
    return {
      borderColor: interpolateColor(progress.value, [0, 1], [colors.border, colors.primary]),
      backgroundColor: interpolateColor(progress.value, [0, 1], ['transparent', `${colors.primary}10`]),
      transform: [{ scale: scale.value }],
    };
  });

  const contentStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(progress.value, [0, 1], [1, 0], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(progress.value, [0, 1], [1, 0.8], Extrapolation.CLAMP) }
      ]
    };
  });

  const checkStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(progress.value, [0, 1], [0.5, 1], Extrapolation.CLAMP) }
      ]
    };
  });

  return (
    <AnimatedPressable
      accessibilityLabel={inBasket ? "Added to Basket" : "Add to Basket"}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.container, style, containerStyle]}
    >
      <Animated.View style={[styles.innerContent, contentStyle]}>
        <MaterialCommunityIcons 
          name="basket-outline"
          size={iconSize} 
          color={colors.primary} 
          style={{ marginRight: 8 }}
        />
        <ThemedText style={[textStyle, { color: colors.primary }]} numberOfLines={1}>
          Add to Basket
        </ThemedText>
      </Animated.View>
      <Animated.View style={[styles.checkContainer, checkStyle]}>
        <MaterialCommunityIcons 
          name="check"
          size={iconSize + 6} 
          color={colors.primary} 
        />
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Removed width: '100%' so it shrink-wraps correctly
  },
  checkContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
