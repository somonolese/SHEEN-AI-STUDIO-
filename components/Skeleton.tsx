import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle, Dimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useMotion } from '@/hooks/useMotion';

/**
 * A shimmering placeholder block shown while content is loading.
 */
export function Skeleton({ style, radius = 12 }: { style?: ViewStyle | ViewStyle[]; radius?: number }) {
  const colors = useColors();
  const { reduceAnimations } = useMotion();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    if (reduceAnimations) {
      opacity.value = 0.55;
      return;
    }
    opacity.value = withRepeat(
      withTiming(0.85, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [reduceAnimations, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={[
        { backgroundColor: colors.surfaceVariant, borderRadius: radius },
        style,
        animatedStyle,
      ]}
    />
  );
}

export function SkeletonIcon({ size = 48, radius = 12, style }: { size?: number, radius?: number, style?: ViewStyle }) {
  return <Skeleton style={[{ width: size, height: size }, style]} radius={radius} />;
}

export function SkeletonText({ width = '100%', height = 14, style }: { width?: number | string, height?: number, style?: ViewStyle }) {
  return <Skeleton style={[{ width, height, borderRadius: height / 2 }, style]} radius={height / 2} />;
}

export function SkeletonButton({ width = 100, height = 36, style }: { width?: number | string, height?: number, style?: ViewStyle }) {
  return <Skeleton style={[{ width, height, borderRadius: height / 2 }, style]} radius={height / 2} />;
}

export function SkeletonImage({ width = '100%', height = 200, radius = 16, style }: { width?: number | string, height?: number, radius?: number, style?: ViewStyle }) {
  return <Skeleton style={[{ width, height, borderRadius: radius }, style]} radius={radius} />;
}

/** A skeleton row matching the shape of a horizontal app card (icon + two lines). */
export function AppCardSkeleton({ width = 154 }: { width?: number }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { width, backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.iconArea}>
        <SkeletonIcon size={46} radius={11} />
      </View>
      <View style={styles.body}>
        <SkeletonText width="80%" height={14} />
        <SkeletonText width="55%" height={11} style={{ marginTop: 8 }} />
        <SkeletonText width="40%" height={11} style={{ marginTop: 9 }} />
      </View>
    </View>
  );
}

/** A skeleton for the FeaturedCarousel. */
export function FeaturedCarouselSkeleton() {
  const colors = useColors();
  const { width: SCREEN_WIDTH } = Dimensions.get('window');
  const CARD_WIDTH = SCREEN_WIDTH * 0.85;
  const CARD_HEIGHT = 220;

  return (
    <View style={{ height: CARD_HEIGHT, marginVertical: 12, justifyContent: 'center', alignItems: 'center' }}>
      <View style={[styles.featuredSkeleton, { 
        width: CARD_WIDTH,
        height: CARD_HEIGHT, 
        backgroundColor: colors.card, 
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 32,
        padding: 24,
        justifyContent: 'space-between',
      }]}>
        <SkeletonText width={42} height={24} />
        
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <SkeletonText width="80%" height={28} style={{ marginBottom: 8 }} />
            <SkeletonText width="50%" height={16} />
          </View>
          <View style={{ width: 60, height: 60 }}>
            <SkeletonIcon size={60} radius={16} />
          </View>
        </View>
      </View>
    </View>
  );
}

/** A skeleton for a Browse Apps card in the vertical list */
export function BrowseAppCardSkeleton() {
  const colors = useColors();
  return (
    <View style={[styles.browseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <SkeletonIcon size={64} radius={16} style={{ marginRight: 16 }} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonText width="70%" height={16} />
        <SkeletonText width="90%" height={12} />
        <SkeletonText width="40%" height={12} />
      </View>
    </View>
  );
}

/** A skeleton for the AppDetails screen. */
export function AppDetailsSkeleton() {
  const colors = useColors();
  return (
    <View style={[styles.detailsSkeleton, { backgroundColor: colors.background }]}>
      <View style={styles.detailsHero}>
        <SkeletonIcon size={110} radius={26} />
        <SkeletonText width="60%" height={32} style={{ marginTop: 24 }} />
        <SkeletonText width="40%" height={20} style={{ marginTop: 12 }} />
      </View>
      <View style={styles.detailsStats}>
         <SkeletonText width="28%" height={70} />
         <SkeletonText width="28%" height={70} />
         <SkeletonText width="28%" height={70} />
      </View>
      <SkeletonImage height={380} style={{ marginTop: 32 }} />
      <View style={{ marginTop: 32, gap: 16 }}>
         <SkeletonImage height={100} radius={20} />
         <SkeletonImage height={120} radius={20} />
      </View>
    </View>
  );
}

/** A skeleton row matching the shape of a vertical search result row. */
export function ResultRowSkeleton() {
  const colors = useColors();
  return (
    <View style={[styles.resultRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <SkeletonIcon size={52} radius={12} />
      <View style={styles.resultBody}>
        <SkeletonText width="60%" height={15} />
        <SkeletonText width="40%" height={12} style={{ marginTop: 8 }} />
        <SkeletonText width="30%" height={11} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, overflow: 'hidden', borderWidth: 1 },
  iconArea: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  body: { padding: 13, paddingTop: 11 },
  browseCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 24, marginBottom: 12, borderWidth: 0, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 24, borderWidth: 1, padding: 14, marginBottom: 12 },
  resultBody: { flex: 1 },
  featuredSkeleton: { height: 420, borderRadius: 32, overflow: 'hidden', borderWidth: 1, position: 'relative' },
  featuredSkeletonContent: { position: 'absolute', bottom: 32, left: 24, right: 24 },
  detailsSkeleton: { flex: 1, padding: 24 },
  detailsHero: { alignItems: 'center', marginTop: 40 },
  detailsStats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 40 },
});
