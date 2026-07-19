import { FadeInUp, withSpring, withTiming, useSharedValue, useAnimatedStyle, Easing } from 'react-native-reanimated';
import { Platform } from 'react-native';

// ─── Material 3 Expressive Motion Specs ──────────────────────────────────────

export const M3_SPRING_CARD = {
  stiffness: 90,
  damping: 12,
  mass: 1,
};

export const M3_SPRING_PRESS = {
  stiffness: 350,
  damping: 12,
  mass: 0.5,
};

export const M3_SPRING_RETURN = {
  stiffness: 300,
  damping: 15,
  mass: 0.5,
};

export const M3_TIMING_EXPRESSIVE = {
  duration: 400,
  easing: Easing.bezier(0.2, 0, 0, 1), // Standard Decelerate (M3 Emphasized)
};

// ─── Reusable Spring / Timing Hook ───────────────────────────────────────────

/**
 * Reusable hook to easily apply Material 3 expressive spring or timing transitions.
 * Returns spring and timing builders customized for M3 specs.
 */
export function useM3SpringConfig() {
  const springCard = (toValue: number, callback?: (finished?: boolean) => void) => {
    'worklet';
    return withSpring(toValue, M3_SPRING_CARD, callback);
  };

  const springPress = (toValue: number, callback?: (finished?: boolean) => void) => {
    'worklet';
    return withSpring(toValue, M3_SPRING_PRESS, callback);
  };

  const springReturn = (toValue: number, callback?: (finished?: boolean) => void) => {
    'worklet';
    return withSpring(toValue, M3_SPRING_RETURN, callback);
  };

  const timingExpressive = (toValue: number, callback?: (finished?: boolean) => void) => {
    'worklet';
    return withTiming(toValue, M3_TIMING_EXPRESSIVE, callback);
  };

  return {
    springCard,
    springPress,
    springReturn,
    timingExpressive,
    configs: {
      card: M3_SPRING_CARD,
      press: M3_SPRING_PRESS,
      return: M3_SPRING_RETURN,
      timing: M3_TIMING_EXPRESSIVE,
    },
  };
}

// ─── Card Entrance Animation (stiffness: 90, damping: 12) ──────────────────

/**
 * Entrance animation for cards, app tiles, and detail sections.
 * Styled with Material 3 Expressive spring (stiffness: 90, damping: 12)
 * and optional stagger delay.
 */
export const materialCardEnter = (index: number = 0, baseDelay: number = 0, stagger: number = 40) => {
  const delay = baseDelay + index * stagger;
  return FadeInUp
    .delay(delay)
    .springify()
    .stiffness(M3_SPRING_CARD.stiffness)
    .damping(M3_SPRING_CARD.damping)
    .mass(M3_SPRING_CARD.mass);
};
