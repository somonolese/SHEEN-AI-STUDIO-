import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable, useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  interpolate,
  interpolateColor,
  useDerivedValue,
  useSharedValue,
  FadeIn,
  FadeOut
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useTypography } from '@/hooks/useTypography';
import { useSettings } from '@/hooks/useSettings';
import { ThemedText } from './ThemedText';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useDownloads } from '@/hooks/useDownloads';
import { useNotifications } from '@/hooks/useNotifications';
import { SheenIcon } from './SheenIcon';
import * as Haptics from 'expo-haptics';

export function Material3TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const { tasks } = useDownloads();
  const { unreadCount } = useNotifications();

  const activeDownloadsCount = tasks.filter(
    (t) =>
      t.status === 'downloading' ||
      t.status === 'queued' ||
      t.status === 'paused'
  ).length;

  const isRailMode = windowWidth >= 600;

  const railModeAnim = useSharedValue(isRailMode ? 1 : 0);
  useEffect(() => {
    railModeAnim.value = withSpring(isRailMode ? 1 : 0, { damping: 20, stiffness: 150 });
  }, [isRailMode]);

  const displayRoutes = state.routes.filter(route => 
    ['index', 'downloads', 'categories', 'search', 'settings'].includes(route.name)
  );

  const activeIndex = displayRoutes.findIndex(route => {
    const actualIndex = state.routes.findIndex(r => r.key === route.key);
    return state.index === actualIndex;
  });

  const getBadgeForRoute = (routeName: string) => {
    if (routeName === 'downloads') {
      return activeDownloadsCount;
    }
    if (routeName === 'settings' && unreadCount > 0) {
      return unreadCount;
    }
    return 0;
  };

  // Single continuous animated shared value representing the active index.
  // Using an expressive spring with a natural weight (slight responsive overshoot)
  const transitionVal = useSharedValue(activeIndex);
  useEffect(() => {
    transitionVal.value = withSpring(activeIndex, {
      damping: 22,
      stiffness: 170,
      mass: 0.9,
    });
  }, [activeIndex]);

  // Dynamic continuous organic stretch calculation (jelly-like morphing peaking exactly at midpoint)
  const stretchVal = useDerivedValue(() => {
    const x = transitionVal.value;
    const dist = Math.abs(x - Math.round(x)); // Distance from nearest integer [0, 0.5]
    const smoothFactor = Math.sin(dist * Math.PI); // Continuous sine wave peaking at 1.0 at midpoint
    return smoothFactor * 24; // Maximum stretch of 24dp
  });

  // Determines whether the active pill is currently gliding or resting
  const movementVal = useDerivedValue(() => {
    const x = transitionVal.value;
    const dist = Math.abs(x - Math.round(x));
    return Math.min(1, dist * 2); // 1 at midpoint (full glide), 0 at anchors (settled)
  });

  // Derived dimensions of the container
  const paddingHorizontal = 12;
  const topPad = insets.top || 20;
  const railTopPaddingVal = topPad + 72;

  // Tailored active pill widths for each tab to fit [icon + label] side-by-side beautifully
  const activeWidths = [84, 114, 118, 92, 104];
  const labelWidths = [36, 68, 72, 44, 52];

  // Deriving Left position for translation
  const leftStyleVal = useDerivedValue(() => {
    const containerWidth = windowWidth - 40;
    const usableWidth = containerWidth - 2 * paddingHorizontal;
    const tabWidth = usableWidth / 5;

    // Smoothly interpolate the active width of the pill as it glides
    const baseWidth = interpolate(
      transitionVal.value,
      [0, 1, 2, 3, 4],
      activeWidths,
      'clamp'
    );

    const horizontalWidth = baseWidth + stretchVal.value;
    const horizontalLeft = transitionVal.value * tabWidth + (tabWidth - horizontalWidth) / 2 + paddingHorizontal;
    
    const verticalLeft = 12; // Centered inside 80dp rail: (80 - 56) / 2 = 12

    return interpolate(railModeAnim.value, [0, 1], [horizontalLeft, verticalLeft]);
  });

  // Deriving Top position for translation
  const topStyleVal = useDerivedValue(() => {
    const horizontalTop = 20; // Mathematically centered vertically in height 76
    
    const verticalHeight = 32 + stretchVal.value;
    const verticalTop = railTopPaddingVal + transitionVal.value * 80 + (80 - verticalHeight) / 2;
    
    return interpolate(railModeAnim.value, [0, 1], [horizontalTop, verticalTop]);
  });

  // Dynamic width of the pill base size
  const widthStyleVal = useDerivedValue(() => {
    const baseWidth = interpolate(
      transitionVal.value,
      [0, 1, 2, 3, 4],
      activeWidths,
      'clamp'
    );
    const horizontalWidth = baseWidth + stretchVal.value;
    const verticalWidth = 56;
    
    return interpolate(railModeAnim.value, [0, 1], [horizontalWidth, verticalWidth]);
  });

  // Dynamic height of the pill base size
  const heightStyleVal = useDerivedValue(() => {
    const horizontalHeight = 36;
    const verticalHeight = 32 + stretchVal.value;
    
    return interpolate(railModeAnim.value, [0, 1], [horizontalHeight, verticalHeight]);
  });

  // Highly optimized GPU-friendly style using transform translations to avoid layout recalculations!
  const indicatorStyle = useAnimatedStyle(() => {
    const isMoving = movementVal.value;
    
    // Expressive scale deformation: subtly flattens and stretches as it moves fast!
    const scaleY = interpolate(isMoving, [0, 1], [1, 0.94]);
    const scaleX = interpolate(isMoving, [0, 1], [1, 1.04]);

    return {
      transform: [
        { translateX: leftStyleVal.value },
        { translateY: topStyleVal.value },
        { scaleX },
        { scaleY },
      ],
      width: widthStyleVal.value,
      height: heightStyleVal.value,
      // Morphing corners based on stretch (surface tension simulation)
      borderRadius: interpolate(stretchVal.value, [0, 24], [18, 14]),
      elevation: interpolate(railModeAnim.value, [0, 1], [
        interpolate(isMoving, [0, 1], [2, 4.5]), // Floating up effect on Android
        0
      ]),
      shadowOpacity: interpolate(railModeAnim.value, [0, 1], [
        interpolate(isMoving, [0, 1], [0.12, 0.22]), // Deeper shadow while moving
        0
      ]),
      shadowRadius: interpolate(isMoving, [0, 1], [4, 9]),
      shadowOffset: {
        width: 0,
        height: interpolate(isMoving, [0, 1], [2.5, 4.5]),
      },
    };
  });

  const containerStyle = useAnimatedStyle(() => {
    const anim = railModeAnim.value;
    const animatedWidth = interpolate(anim, [0, 1], [windowWidth - 40, 80]);
    const animatedHeight = interpolate(anim, [0, 1], [76, windowHeight]);
    const animatedLeft = interpolate(anim, [0, 1], [20, 0]);
    const animatedBottom = interpolate(anim, [0, 1], [Math.max(insets.bottom, 16), 0]);
    const animatedBorderRadius = interpolate(anim, [0, 1], [36, 0]);
    const animatedElevation = interpolate(anim, [0, 1], [10, 0]);
    const animatedShadowOpacity = interpolate(anim, [0, 1], [0.24, 0]);

    return {
      width: animatedWidth,
      height: animatedHeight,
      left: animatedLeft,
      bottom: animatedBottom,
      borderRadius: animatedBorderRadius,
      elevation: animatedElevation,
      shadowOpacity: animatedShadowOpacity,
      borderRightWidth: 1.2,
      borderWidth: interpolate(anim, [0, 1], [1.2, 0]),
      borderRightColor: colors.border,
      borderTopColor: colors.border,
      borderBottomColor: colors.border,
      borderLeftColor: colors.border,
    };
  });

  const pillContentStyle = useAnimatedStyle(() => {
    return {
      flexDirection: railModeAnim.value > 0.5 ? 'column' : 'row',
      alignItems: 'center',
      flex: 1,
      width: '100%',
      height: '100%',
    };
  });

  // Unified instant haptic triggering function
  const triggerHaptic = () => {
    if (Platform.OS !== 'web' && settings?.hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  return (
    <Animated.View style={[
      styles.floatingContainer, 
      { 
        shadowColor: '#000',
        backgroundColor: colors.surfaceContainerHigh,
        borderColor: colors.border,
      },
      containerStyle
    ]}>
      {isRailMode && (
        <Animated.View 
          entering={FadeIn.duration(320)}
          exiting={FadeOut.duration(240)}
          style={[styles.railLogo, { top: topPad + 16 }]}
        >
          <SheenIcon size={36} />
        </Animated.View>
      )}

      {/* Sliding Active Pill Background (GPU-Friendly Single Morphing Element using TranslateX/Y) */}
      <Animated.View style={[
        styles.slidingIndicatorContainer, 
        { backgroundColor: colors.primaryContainer },
        indicatorStyle
      ]} />

      <Animated.View style={pillContentStyle}>
        {displayRoutes.map((route, index) => {
          const actualIndex = state.routes.findIndex(r => r.key === route.key);
          const { options } = descriptors[route.key];
          const isFocused = state.index === actualIndex;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const iconActive = options.tabBarIcon ? options.tabBarIcon({ 
            focused: true, 
            color: colors.onPrimaryContainer,
            size: 22
          }) : null;

          const iconInactive = options.tabBarIcon ? options.tabBarIcon({ 
            focused: false, 
            color: colors.onSurfaceVariant,
            size: 22
          }) : null;

          // Compute exact static layout dimensions for perfect symmetric spacing
          const tabItemStyle = useAnimatedStyle(() => {
            const anim = railModeAnim.value;
            const containerWidth = windowWidth - 40;
            const usableWidth = containerWidth - 2 * paddingHorizontal;
            const tabWidth = usableWidth / 5;

            const horizontalLeft = index * tabWidth + paddingHorizontal;
            const verticalLeft = 0;
            const leftVal = interpolate(anim, [0, 1], [horizontalLeft, verticalLeft]);

            const horizontalTop = 0;
            const verticalTop = railTopPaddingVal + index * 80;
            const topVal = interpolate(anim, [0, 1], [horizontalTop, verticalTop]);

            const horizontalWidth = tabWidth;
            const verticalWidth = 80;
            const widthVal = interpolate(anim, [0, 1], [horizontalWidth, verticalWidth]);

            const horizontalHeight = 76;
            const verticalHeight = 80;
            const heightVal = interpolate(anim, [0, 1], [horizontalHeight, verticalHeight]);

            return {
              position: 'absolute',
              left: leftVal,
              top: topVal,
              width: widthVal,
              height: heightVal,
              justifyContent: 'center',
              alignItems: 'center',
            };
          });

          return (
            <Animated.View key={route.key} style={tabItemStyle}>
              <TabItem
                isFocused={isFocused}
                onPress={onPress}
                label={options.title || route.name}
                iconActive={iconActive}
                iconInactive={iconInactive}
                badge={getBadgeForRoute(route.name)}
                index={index}
                transitionVal={transitionVal}
                activeColor={colors.primary}
                inactiveColor={colors.onSurfaceVariant}
                badgeColor={colors.primary}
                badgeTextColor={colors.onPrimary}
                triggerHaptic={triggerHaptic}
                labelWidth={labelWidths[index]}
              />
            </Animated.View>
          );
        })}
      </Animated.View>
    </Animated.View>
  );
}

interface TabItemProps {
  isFocused: boolean;
  onPress: () => void;
  label: string;
  iconActive: React.ReactNode;
  iconInactive: React.ReactNode;
  badge?: number;
  index: number;
  transitionVal: Animated.SharedValue<number>;
  activeColor: string;
  inactiveColor: string;
  badgeColor: string;
  badgeTextColor: string;
  triggerHaptic: () => void;
  labelWidth: number;
}

function TabItem({
  isFocused,
  onPress,
  label,
  iconActive,
  iconInactive,
  badge,
  index,
  transitionVal,
  activeColor,
  inactiveColor,
  badgeColor,
  badgeTextColor,
  triggerHaptic,
  labelWidth,
}: TabItemProps) {
  const fonts = useTypography();
  const pulseScale = useSharedValue(1);

  // Compute this tab's specific progress (0.0 to 1.0) synchronized perfectly to the gliding pill's position!
  const progressValue = useDerivedValue(() => {
    const distance = Math.abs(transitionVal.value - index);
    return Math.max(0, 1 - distance);
  });

  const rowStyle = useAnimatedStyle(() => {
    return {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      width: '100%',
      transform: [
        { scale: pulseScale.value }
      ],
    };
  });

  const labelContainerStyle = useAnimatedStyle(() => {
    const currentWidth = interpolate(progressValue.value, [0, 1], [0, labelWidth]);
    const marginLeft = interpolate(progressValue.value, [0, 1], [0, 8]);
    const opacity = progressValue.value;
    const translateX = interpolate(progressValue.value, [0, 1], [-8, 0]);

    return {
      width: currentWidth,
      marginLeft: marginLeft,
      opacity: opacity,
      transform: [{ translateX }],
      justifyContent: 'center',
      alignItems: 'flex-start',
      overflow: 'hidden',
    };
  });

  const labelTextStyle = useAnimatedStyle(() => {
    return {
      color: interpolateColor(
        progressValue.value,
        [0, 1],
        [inactiveColor, activeColor]
      ) as any
    };
  });

  const iconWrapperStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: interpolate(progressValue.value, [0, 1], [0.92, 1.0]) }
      ]
    };
  });

  const activeIconStyle = useAnimatedStyle(() => {
    return {
      opacity: progressValue.value,
      position: 'absolute',
    };
  });

  const inactiveIconStyle = useAnimatedStyle(() => {
    return {
      opacity: 1 - progressValue.value,
      position: 'absolute',
    };
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        triggerHaptic(); // Immediate touch acknowledgment on press down!
        pulseScale.value = withSpring(0.92, { damping: 12, stiffness: 240 });
      }}
      onPressOut={() => {
        pulseScale.value = withSpring(1, { damping: 12, stiffness: 240 });
      }}
      android_ripple={{ color: 'rgba(255, 255, 255, 0.08)', borderless: true, radius: 28 }}
      style={styles.pressable}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
    >
      <Animated.View style={rowStyle}>
        <View style={styles.iconContainer}>
          <Animated.View style={[iconWrapperStyle, styles.iconWrapper]}>
            <Animated.View style={inactiveIconStyle}>
              {iconInactive}
            </Animated.View>
            <Animated.View style={activeIconStyle}>
              {iconActive}
            </Animated.View>

            {badge !== undefined && badge > 0 && (
              <Animated.View 
                entering={FadeIn.duration(180)} 
                exiting={FadeOut.duration(150)} 
                style={[styles.badge, { backgroundColor: badgeColor }]}
              >
                <ThemedText style={[styles.badgeText, { color: badgeTextColor }]}>{badge}</ThemedText>
              </Animated.View>
            )}
          </Animated.View>
        </View>

        <Animated.View style={labelContainerStyle} pointerEvents="none">
          <Animated.Text 
            style={[
              styles.label, 
              labelTextStyle,
              { 
                fontFamily: fonts.medium,
                textAlign: 'left',
                fontSize: 10.5,
                letterSpacing: 0.4,
              }
            ]} 
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {label}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    elevation: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    zIndex: 1000,
  },
  slidingIndicatorContainer: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  pressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  iconContainer: {
    width: 24,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  label: {
    fontWeight: '500',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    zIndex: 10,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 10,
  },
  railLogo: {
    position: 'absolute',
    left: 22,
    zIndex: 10,
  },
});
