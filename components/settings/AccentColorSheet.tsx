import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ThemedText } from '@/components/ThemedText';

const ACCENT_COLORS = [
  { label: 'Purple', value: '#9C27B0' },
  { label: 'Blue', value: '#2196F3' },
  { label: 'Cyan', value: '#00BCD4' },
  { label: 'Green', value: '#4CAF50' },
  { label: 'Lime', value: '#CDDC39' },
  { label: 'Orange', value: '#FF9800' },
  { label: 'Red', value: '#F44336' },
  { label: 'Pink', value: '#E91E63' },
  { label: 'Indigo', value: '#3F51B5' },
  { label: 'Teal', value: '#009688' },
];

export function AccentColorSheet({
  current,
  onSelect,
  onClose,
  bottomInset,
}: {
  current: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  bottomInset: number;
}) {
  const colors = useColors();

  return (
    <View style={styles.overlay}>
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.springify().damping(22).stiffness(160).mass(0.9)}
        exiting={SlideOutDown.springify().damping(28).stiffness(220).mass(0.8).overshootClamping(true)}
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surfaceContainerHigh,
            paddingBottom: Math.max(bottomInset, 20) + 84,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.outline }]} />
        <ThemedText style={[styles.title, { color: colors.foreground }]}>Accent Color</ThemedText>
        
        <View style={styles.grid}>
          {ACCENT_COLORS.map((color) => {
            const active = current === color.value;
            return (
              <View key={color.value} style={styles.swatchWrap}>
                <Pressable
                  onPress={() => { onSelect(color.value); onClose(); }}
                  style={[
                    styles.swatch,
                    { backgroundColor: color.value },
                    active && { borderWidth: 3, borderColor: colors.foreground }
                  ]}
                />
                <ThemedText style={[styles.swatchLabel, { color: colors.foreground }]}>{color.label}</ThemedText>
              </View>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingHorizontal: 24,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.1,
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    justifyContent: 'flex-start',
    marginBottom: 10,
  },
  swatchWrap: {
    alignItems: 'center',
    gap: 8,
    width: 56,
  },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  swatchLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});
