import React from 'react';
import { Platform, StyleSheet, Switch, Text, View, Pressable } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { ThemedText } from '@/components/ThemedText';
import { useSettings } from '@/hooks/useSettings';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type Colors = ReturnType<typeof useColors>;

// ─── AnimatedPressable ──────────────────────────────────────────────────────
// Same spring-scale press pattern used across Home / Search / Favorites.

export function AnimatedPressable({
  children,
  onPress,
  onLongPress,
  disabled,
  style,
  accessibilityRole = 'button',
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: any;
  accessibilityRole?: any;
}) {
  const scale = useSharedValue(1);
  const elevation = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: elevation.value * 0.1,
    shadowOffset: { width: 0, height: 4 + elevation.value * 4 },
    shadowRadius: 4 + elevation.value * 6,
    elevation: elevation.value * 12, // Android
  }));

  const { settings } = useSettings();

  return (
    <Pressable
      onPress={() => {
        if (settings.hapticFeedback) {
          Haptics.selectionAsync();
        }
        onPress?.();
      }}
      onLongPress={() => {
        if (settings.hapticFeedback) {
          Haptics.selectionAsync();
        }
        onLongPress?.();
      }}
      disabled={disabled}
      onPressIn={() => {
        if (disabled) return;
        scale.value = withSpring(0.95, { damping: 12, stiffness: 350, mass: 0.5 });
        elevation.value = withSpring(1, { damping: 12, stiffness: 350 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300, mass: 0.5 });
        elevation.value = withSpring(0, { damping: 15, stiffness: 300 });
      }}
      accessibilityRole={accessibilityRole}
      android_ripple={{ color: 'rgba(150, 150, 150, 0.15)', borderless: false }}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}


// ─── SettingsCard ───────────────────────────────────────────────────────────
// Wraps a group of rows in a single Material 3 surface card with dividers
// drawn between children.

export function SettingsCard({
  children,
  index = 0,
}: {
  children: React.ReactNode;
  index?: number;
}) {
  const colors = useColors();
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <Animated.View
      entering={FadeInUp.delay(60 + index * 40)
        .duration(440)
        .springify()
        .damping(22)
        .stiffness(150)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {child}
          {i < items.length - 1 && (
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant, opacity: 0.4 }]} />
          )}
        </React.Fragment>
      ))}
    </Animated.View>
  );
}

// ─── Row primitives ─────────────────────────────────────────────────────────

function RowShell({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  disabled,
  right,
  colors,
}: {
  icon: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  disabled?: boolean;
  right: React.ReactNode;
  colors: Colors;
}) {
  const Wrapper = onPress ? AnimatedPressable : View;
  const wrapperProps = onPress ? { onPress, disabled } : {};

  return (
    <Wrapper {...(wrapperProps as any)} style={styles.row}>
      <View
        style={[
          styles.rowIconWrap,
          { backgroundColor: disabled ? colors.surfaceVariant : colors.surfaceContainer },
        ]}
      >
        <MaterialCommunityIcons name={icon} size={20} color={disabled ? colors.outline : (iconColor ?? colors.primary)} />
      </View>
      <View style={styles.rowBody}>
        <ThemedText
          style={[styles.rowTitle, { color: disabled ? colors.outline : colors.foreground }]}
          numberOfLines={1}
        >
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText style={[styles.rowSubtitle, { color: disabled ? colors.outline : colors.mutedForeground }]} numberOfLines={2}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.rowRight}>{right}</View>
    </Wrapper>
  );
}

export function SwitchRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  
  const trackColor = {
    false: disabled ? colors.surfaceVariant : colors.surfaceContainerHighest,
    true: disabled ? `${colors.onSurface}1E` : colors.primary
  };
  
  const thumbColor = Platform.OS === 'android'
    ? (disabled
        ? (value ? colors.surface : `${colors.onSurface}60`)
        : (value ? colors.onPrimary : colors.outline))
    : undefined;

  return (
    <RowShell
      icon={icon}
      title={title}
      subtitle={subtitle}
      disabled={disabled}
      onPress={disabled ? undefined : () => onValueChange(!value)}
      colors={colors}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={trackColor}
          thumbColor={thumbColor}
          ios_backgroundColor={colors.surfaceVariant}
        />
      }
    />
  );
}

export function SelectRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  disabled,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  value: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <RowShell
      icon={icon}
      title={title}
      subtitle={subtitle}
      onPress={onPress}
      disabled={disabled}
      colors={colors}
      right={
        <View style={[styles.valueWrap, { backgroundColor: disabled ? colors.surfaceVariant : colors.secondaryContainer, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 }]}>
          <ThemedText style={[styles.rowValue, { color: disabled ? colors.outline : colors.onSecondaryContainer }]} numberOfLines={1}>
            {value}
          </ThemedText>
          <MaterialCommunityIcons name="chevron-down" size={18} color={disabled ? colors.outline : colors.onSecondaryContainer} />
        </View>
      }
    />
  );
}

export function ActionRow({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  destructive,
  external,
}: {
  icon: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
  external?: boolean;
}) {
  const colors = useColors();
  return (
    <RowShell
      icon={icon}
      iconColor={destructive ? colors.destructive : iconColor}
      title={title}
      subtitle={subtitle}
      onPress={onPress}
      colors={colors}
      right={
        <MaterialCommunityIcons
          name={external ? 'open-in-new' : 'chevron-right'}
          size={18}
          color={colors.mutedForeground}
        />
      }
    />
  );
}

export function InfoRow({
  icon,
  title,
  value,
  onPress,
}: {
  icon: IconName;
  title: string;
  value: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  return (
    <RowShell
      icon={icon}
      title={title}
      colors={colors}
      onPress={onPress}
      right={
        <ThemedText style={[styles.rowValue, { color: colors.mutedForeground }]} numberOfLines={1}>
          {value}
        </ThemedText>
      }
    />
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  sectionEmoji: { fontSize: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    marginLeft: 66,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 16,
    minHeight: 64,
  },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', letterSpacing: 0.1 },
  rowSubtitle: { fontSize: 12.5, lineHeight: 16 },
  rowRight: { alignItems: 'flex-end', justifyContent: 'center' },
  valueWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 140 },
  rowValue: { fontSize: 13, fontWeight: '500' },
});
