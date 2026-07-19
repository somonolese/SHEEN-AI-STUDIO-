import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ThemedText } from '@/components/ThemedText';

export interface SelectOption<T extends string> {
  key: T;
  label: string;
  description?: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  /** When true the row is shown but cannot be selected. */
  disabled?: boolean;
  /** Optional badge shown to the right of the label (e.g. "Android only"). */
  badge?: string;
  previewFontFamily?: string;
  previewText?: string;
}

/**
 * Material 3 bottom sheet for single-choice selection.
 * Pass `radioMode` to show a radio button instead of a check mark — use this
 * for installer selection where the full description is shown.
 */
export function SelectSheet<T extends string>({
  title,
  options,
  current,
  onSelect,
  onClose,
  bottomInset,
  radioMode = false,
}: {
  title: string;
  options: SelectOption<T>[];
  current: T;
  onSelect: (value: T) => void;
  onClose: () => void;
  bottomInset: number;
  radioMode?: boolean;
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
        <ThemedText style={[styles.title, { color: colors.foreground }]}>{title}</ThemedText>

        <ScrollView showsVerticalScrollIndicator={false}>
          {options.map((opt) => {
            const active = current === opt.key;
            const disabled = opt.disabled ?? false;
            const rowBg = active && !disabled ? `${colors.secondaryContainer}66` : undefined;
            const labelColor = disabled
              ? colors.mutedForeground
              : active
              ? colors.primary
              : colors.foreground;

            return (
              <Pressable
                key={opt.key}
                onPress={disabled ? undefined : () => { onSelect(opt.key); onClose(); }}
                style={[styles.option, rowBg ? { backgroundColor: rowBg } : undefined]}
                disabled={disabled}
              >
                {/* Leading icon or radio */}
                {radioMode ? (
                  <MaterialCommunityIcons
                    name={active ? 'radiobox-marked' : 'radiobox-blank'}
                    size={22}
                    color={disabled ? colors.mutedForeground : active ? colors.primary : colors.onSurfaceVariant}
                  />
                ) : opt.icon ? (
                  <MaterialCommunityIcons
                    name={opt.icon}
                    size={22}
                    color={disabled ? colors.mutedForeground : active ? colors.primary : colors.onSurfaceVariant}
                  />
                ) : null}

                <View style={styles.optionBody}>
                  <View style={styles.optionLabelRow}>
                    <ThemedText
                      style={[
                        styles.optionText,
                        { color: labelColor, opacity: disabled ? 0.45 : 1 },
                        opt.previewFontFamily ? { fontFamily: opt.previewFontFamily } : undefined,
                      ]}
                    >
                      {opt.label}
                    </ThemedText>
                    {opt.badge ? (
                      <View style={[styles.badge, { backgroundColor: `${colors.secondaryContainer}99` }]}>
                        <ThemedText style={[styles.badgeText, { color: colors.onSecondaryContainer }]}>
                          {opt.badge}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                  {opt.description ? (
                    <ThemedText
                      style={[
                        styles.optionDesc,
                        { color: colors.mutedForeground, opacity: disabled ? 0.45 : 1 },
                        opt.previewFontFamily ? { fontFamily: opt.previewFontFamily } : undefined,
                      ]}
                    >
                      {opt.description}
                    </ThemedText>
                  ) : null}
                  {opt.previewText ? (
                    <ThemedText
                      style={[
                        styles.optionPreview,
                        { color: colors.mutedForeground, opacity: disabled ? 0.45 : 0.8 },
                        opt.previewFontFamily ? { fontFamily: opt.previewFontFamily } : undefined,
                      ]}
                    >
                      {opt.previewText}
                    </ThemedText>
                  ) : null}
                </View>

                {/* Trailing check — only in non-radio mode */}
                {!radioMode && active && !disabled && (
                  <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    gap: 16,
    borderRadius: 14,
  },
  optionBody: { flex: 1, gap: 3 },
  optionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  optionText: { fontSize: 16, fontWeight: '500', letterSpacing: 0.1 },
  optionDesc: { fontSize: 13, lineHeight: 18 },
  optionPreview: { fontSize: 14, lineHeight: 20, marginTop: 4, opacity: 0.8 },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
});
