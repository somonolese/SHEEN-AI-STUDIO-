/**
 * CollapsibleSection — Material Motion expandable section wrapper for Settings.
 *
 * Measures child content at natural height, then animates between 0 and that
 * height so the collapse / expand is pixel-perfect smooth with no layout jumps.
 *
 * Usage:
 *   <CollapsibleSection emoji="🎨" title="Appearance" index={0} defaultOpen>
 *     <SettingsCard index={0}>...</SettingsCard>
 *   </CollapsibleSection>
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ThemedText } from '@/components/ThemedText';

interface Props {
  emoji: string;
  title: string;
  index: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  emoji,
  title,
  index,
  defaultOpen = false,
  children,
}: Props) {
  const colors = useColors();

  // Track whether section is open
  const [open, setOpen] = useState(defaultOpen);
  // Content height measured from the ghost render
  const [contentHeight, setContentHeight] = useState(0);
  // Whether we've completed at least one measurement
  const measured = useRef(false);

  // Animated height value (in px)
  const heightAnim = useSharedValue(0);
  // Arrow rotation progress 0→1
  const arrowAnim = useSharedValue(defaultOpen ? 1 : 0);

  // Once we have a height measurement, snap to it if defaultOpen
  useEffect(() => {
    if (contentHeight > 0 && !measured.current) {
      measured.current = true;
      if (defaultOpen) {
        heightAnim.value = contentHeight;
      }
    }
  }, [contentHeight, defaultOpen, heightAnim]);

  // Animate whenever open / contentHeight changes after first measure
  const toggle = useCallback(() => {
    if (contentHeight === 0) return; // not yet measured
    const next = !open;
    setOpen(next);
    arrowAnim.value = withSpring(next ? 1 : 0, {
      damping: 22,
      stiffness: 220,
      mass: 0.7,
      overshootClamping: true,
    });
    heightAnim.value = withSpring(next ? contentHeight : 0, {
      damping: 24,
      stiffness: 220,
      mass: 0.8,
      overshootClamping: true,
    });
  }, [open, contentHeight, arrowAnim, heightAnim]);

  // If content height changes (e.g. items added/removed), update animated target
  useEffect(() => {
    if (!measured.current || contentHeight === 0) return;
    if (open) {
      heightAnim.value = withSpring(contentHeight, {
        damping: 24,
        stiffness: 220,
        mass: 0.8,
        overshootClamping: true,
      });
    }
  }, [contentHeight, open, heightAnim]);

  const bodyStyle = useAnimatedStyle(() => ({
    height: heightAnim.value,
    overflow: 'hidden',
  }));

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(arrowAnim.value, [0, 1], [0, 180])}deg` },
    ],
  }));

  return (
    <View style={styles.wrapper}>
      {/* ── Header row (tappable) ── */}
      <Animated.View
        entering={FadeInUp.delay(index * 40)
          .duration(420)
          .springify()
          .damping(22)
          .stiffness(160)}
      >
        <Pressable
          onPress={toggle}
          style={({ pressed }) => [
            styles.header,
            pressed && { opacity: 0.7 },
          ]}
          android_ripple={{ color: `${colors.primary}22`, borderless: false }}
        >
          <ThemedText style={styles.headerEmoji}>{emoji}</ThemedText>
          <ThemedText style={[styles.headerTitle, { color: colors.foreground }]}>
            {title}
          </ThemedText>
          <Animated.View style={arrowStyle}>
            <MaterialCommunityIcons
              name="chevron-down"
              size={20}
              color={colors.mutedForeground}
            />
          </Animated.View>
        </Pressable>
      </Animated.View>

      {/* ── Animated height container ── */}
      <Animated.View style={bodyStyle}>
        {/* Inner view at natural height; onLayout captures it */}
        <View
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0) setContentHeight(h);
          }}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 22,
    overflow: 'visible',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginBottom: 2,
    borderRadius: 12,
  },
  headerEmoji: { fontSize: 16 },
  headerTitle: { flex: 1, fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
});
