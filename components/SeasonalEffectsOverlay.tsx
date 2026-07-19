import React, { useEffect, useState } from 'react';
import { View, StyleSheet, useWindowDimensions, AccessibilityInfo, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  runOnJS
} from 'react-native-reanimated';
import { useSettings, SeasonalEffectPreview, getSpecialDay } from '@/hooks/useSettings';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

function getSeason(): SeasonalEffectPreview {
  const month = new Date().getMonth();
  if (month === 11 || month === 0 || month === 1) return 'winter';
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'none';
}

const BaseParticle = ({ 
  children, 
  duration, 
  delay, 
  startX, 
  endX, 
  startY, 
  endY, 
  rotateStart, 
  rotateEnd, 
  size 
}: any) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    const start = () => {
      progress.value = withRepeat(
        withTiming(1, { duration, easing: Easing.linear }),
        -1,
        false
      );
    };

    if (delay > 0) {
      const t = setTimeout(start, delay);
      return () => clearTimeout(t);
    } else {
      start();
    }
  }, [duration, delay, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: startX + (endX - startX) * progress.value },
        { translateY: startY + (endY - startY) * progress.value },
        { rotate: `${rotateStart + (rotateEnd - rotateStart) * progress.value}deg` }
      ],
      opacity: progress.value < 0.1 
        ? progress.value * 10 
        : progress.value > 0.9 
          ? (1 - progress.value) * 10 
          : 1
    };
  });

  return (
    <Animated.View style={[styles.particle, { width: size, height: size }, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

const OneShotParticle = ({ 
  children, 
  duration, 
  delay, 
  startX, 
  endX, 
  startY, 
  endY, 
  rotateStart, 
  rotateEnd, 
  size,
  onComplete
}: any) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    const start = () => {
      progress.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished && onComplete) {
          runOnJS(onComplete)();
        }
      });
    };

    if (delay > 0) {
      const t = setTimeout(start, delay);
      return () => clearTimeout(t);
    } else {
      start();
    }
  }, [duration, delay, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: startX + (endX - startX) * progress.value },
        { translateY: startY + (endY - startY) * progress.value },
        { rotate: `${rotateStart + (rotateEnd - rotateStart) * progress.value}deg` }
      ],
      opacity: progress.value > 0.8 ? (1 - progress.value) * 5 : 1
    };
  });

  return (
    <Animated.View style={[styles.particle, { width: size, height: size }, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

const ConfettiEffect = ({ count, onComplete }: { count: number, onComplete: () => void }) => {
  const { width, height } = useWindowDimensions();
  const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
  const [active, setActive] = useState(true);
  
  useEffect(() => {
    const t = setTimeout(() => {
      setActive(false);
      onComplete();
    }, 6000);
    return () => clearTimeout(t);
  }, []);

  if (!active) return null;

  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const size = Math.random() * 8 + 6;
        const color = colors[Math.floor(Math.random() * colors.length)];
        return (
          <OneShotParticle
            key={`confetti-${i}`}
            duration={Math.random() * 2000 + 3000}
            delay={Math.random() * 500}
            startX={width / 2 + (Math.random() - 0.5) * 50}
            endX={Math.random() * width}
            startY={height / 2 + 100}
            endY={height + 50}
            rotateStart={Math.random() * 360}
            rotateEnd={Math.random() * 360 + 720}
            size={size}
          >
            <View style={{ width: size, height: size, backgroundColor: color, borderRadius: 2 }} />
          </OneShotParticle>
        );
      })}
    </>
  );
};

const AnniversarySparkles = ({ count }: { count: number }) => {
  const { width, height } = useWindowDimensions();
  
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const size = Math.random() * 12 + 8;
        return (
          <BaseParticle
            key={`sparkle-${i}`}
            duration={Math.random() * 4000 + 6000}
            delay={Math.random() * 6000}
            startX={Math.random() * width}
            endX={Math.random() * width + (Math.random() - 0.5) * 100}
            startY={height + 20}
            endY={-20}
            rotateStart={Math.random() * 360}
            rotateEnd={Math.random() * 360 + 180}
            size={size}
          >
            <MaterialCommunityIcons name="star-four-points" size={size} color="rgba(212, 175, 55, 0.6)" />
          </BaseParticle>
        );
      })}
    </>
  );
};

// ... Winter, Spring, Summer, Autumn effects remain unchanged
const WinterEffect = ({ count }: { count: number }) => {
  const { width, height } = useWindowDimensions();
  
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const size = Math.random() * 8 + 4;
        return (
          <BaseParticle
            key={`winter-${i}`}
            duration={Math.random() * 5000 + 8000}
            delay={Math.random() * 8000}
            startX={Math.random() * width}
            endX={Math.random() * width + (Math.random() - 0.5) * 100}
            startY={-20}
            endY={height + 20}
            rotateStart={Math.random() * 360}
            rotateEnd={Math.random() * 360 + 360}
            size={size}
          >
            <View style={[styles.snowflake, { width: size, height: size, borderRadius: size / 2 }]} />
          </BaseParticle>
        );
      })}
    </>
  );
};

const SpringEffect = ({ count }: { count: number }) => {
  const { width, height } = useWindowDimensions();
  
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const size = Math.random() * 12 + 8;
        return (
          <BaseParticle
            key={`spring-${i}`}
            duration={Math.random() * 6000 + 10000}
            delay={Math.random() * 10000}
            startX={Math.random() * width}
            endX={Math.random() * width + (Math.random() - 0.5) * 150}
            startY={-30}
            endY={height + 30}
            rotateStart={Math.random() * 360}
            rotateEnd={Math.random() * 360 + 720}
            size={size}
          >
            <MaterialCommunityIcons name="flower-tulip" size={size} color="rgba(255, 182, 193, 0.4)" />
          </BaseParticle>
        );
      })}
    </>
  );
};

const SummerEffect = ({ count }: { count: number }) => {
  const { width, height } = useWindowDimensions();
  
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const size = Math.random() * 6 + 2;
        return (
          <BaseParticle
            key={`summer-${i}`}
            duration={Math.random() * 8000 + 12000}
            delay={Math.random() * 12000}
            startX={Math.random() * width}
            endX={Math.random() * width + (Math.random() - 0.5) * 50}
            startY={height + 20}
            endY={-20}
            rotateStart={0}
            rotateEnd={0}
            size={size}
          >
            <View style={[styles.summerLight, { width: size, height: size, borderRadius: size / 2 }]} />
          </BaseParticle>
        );
      })}
    </>
  );
};

const AutumnEffect = ({ count }: { count: number }) => {
  const { width, height } = useWindowDimensions();
  const colors = ['rgba(217, 119, 6, 0.6)', 'rgba(180, 83, 9, 0.6)', 'rgba(146, 64, 14, 0.6)'];
  
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const size = Math.random() * 16 + 12;
        return (
          <BaseParticle
            key={`autumn-${i}`}
            duration={Math.random() * 5000 + 8000}
            delay={Math.random() * 8000}
            startX={Math.random() * width}
            endX={Math.random() * width + (Math.random() - 0.5) * 200}
            startY={-30}
            endY={height + 30}
            rotateStart={Math.random() * 360}
            rotateEnd={Math.random() * 360 + 540}
            size={size}
          >
            <MaterialCommunityIcons name="leaf-maple" size={size} color={colors[Math.floor(Math.random() * colors.length)]} />
          </BaseParticle>
        );
      })}
    </>
  );
};

export function SeasonalEffectsOverlay() {
  if (Platform.OS === 'web') return null;

  const { settings } = useSettings();
  const [reduceMotionActive, setReduceMotionActive] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotionActive(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (mounted) setReduceMotionActive(enabled);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!settings.seasonalEffectsEnabled) return;
    const checkNewYear = async () => {
      const special = getSpecialDay();
      if (special === 'newyear') {
        const todayStr = new Date().toISOString().split('T')[0];
        const lastConfetti = await AsyncStorage.getItem('sheen.lastConfettiDate');
        if (lastConfetti !== todayStr) {
          setShowConfetti(true);
        }
      }
    };
    checkNewYear();
  }, [settings.seasonalEffectsEnabled]);

  const handleConfettiComplete = () => {
    setShowConfetti(false);
    const todayStr = new Date().toISOString().split('T')[0];
    AsyncStorage.setItem('sheen.lastConfettiDate', todayStr).catch(() => {});
  };

  if (!settings.seasonalEffectsEnabled) return null;
  if (reduceMotionActive || settings.reduceAnimations) return null;

  let activeSeason: SeasonalEffectPreview = 'none';

  if (settings.seasonalEffectsAutoDetect) {
    activeSeason = getSeason();
  } else {
    activeSeason = settings.seasonalEffectsPreview;
  }

  const specialDay = getSpecialDay();
  const count = settings.seasonalEffectsIntensity === 'reduced' ? 12 : 30;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {activeSeason === 'winter' && <WinterEffect count={count} />}
      {activeSeason === 'spring' && <SpringEffect count={count} />}
      {activeSeason === 'summer' && <SummerEffect count={count} />}
      {activeSeason === 'autumn' && <AutumnEffect count={count} />}
      
      {specialDay === 'anniversary' && <AnniversarySparkles count={count} />}
      {showConfetti && <ConfettiEffect count={count * 2} onComplete={handleConfettiComplete} />}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  particle: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  snowflake: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  summerLight: {
    backgroundColor: 'rgba(253, 224, 71, 0.5)',
    shadowColor: '#fef08a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  }
});
