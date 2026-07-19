import React from 'react';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';

export default function TabAnimationWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Animated.View
      entering={FadeInUp.duration(300).springify().damping(20)}
      style={{ flex: 1 }}
    >
      {children}
    </Animated.View>
  );
}
