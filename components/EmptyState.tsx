import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions, Pressable } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  FadeIn, 
  FadeInDown 
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';
import { useColors } from '@/hooks/useColors';

export type EmptyStateType = 
  | 'search'
  | 'basket'
  | 'updates'
  | 'category'
  | 'offline'
  | 'downloads'
  | 'notifications'
  | 'first_launch';

interface EmptyStateProps {
  type: EmptyStateType;
  customSubtitle?: string;
  lastCheckTime?: string;
  onPrimaryPress?: () => void;
  onSecondaryPress?: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
}

export function EmptyState({
  type,
  customSubtitle,
  lastCheckTime,
  onPrimaryPress,
  onSecondaryPress,
  primaryLabel,
  secondaryLabel,
}: EmptyStateProps) {
  const colors = useColors();
  const { width: windowWidth } = useWindowDimensions();
  const scale = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 100,
    });
  }, [type]);

  const animatedIllustrationStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  // Material 3 color selection based on type
  let iconName: keyof typeof MaterialCommunityIcons.definitions | string = 'help-circle-outline';
  let title = '';
  let subtitle = '';
  let defaultPrimaryLabel = '';
  let defaultSecondaryLabel = '';
  let illustrationColor = colors.primary;
  let illustrationBg = colors.primaryContainer || 'rgba(0,0,0,0.05)';

  switch (type) {
    case 'search':
      iconName = 'magnify-close';
      title = 'No apps found';
      subtitle = customSubtitle || "We couldn't find anything matching your search. Try a different keyword or browse Categories.";
      defaultPrimaryLabel = 'Clear Search';
      defaultSecondaryLabel = 'Browse Categories';
      break;

    case 'basket':
      iconName = 'basket-outline';
      title = 'Your basket is empty';
      subtitle = customSubtitle || 'Save apps here to install them later.';
      defaultPrimaryLabel = 'Browse Apps';
      break;

    case 'updates':
      iconName = 'shield-check-outline';
      title = "You're up to date";
      subtitle = customSubtitle || 'All installed apps are running the latest available versions.';
      illustrationColor = '#1B5E20';
      illustrationBg = colors.surfaceVariant || 'rgba(27, 94, 32, 0.1)';
      break;

    case 'category':
      iconName = 'shape-outline';
      title = 'No apps available';
      subtitle = customSubtitle || 'Try another category or check back after the next repository sync.';
      break;

    case 'offline':
      iconName = 'cloud-off-outline';
      title = "You're offline";
      subtitle = customSubtitle || 'Reconnect to sync repositories. Previously synced apps are still available.';
      defaultPrimaryLabel = 'Retry';
      break;

    case 'downloads':
      iconName = 'tray-arrow-down';
      title = 'No active downloads';
      subtitle = customSubtitle || 'Apps you download will appear here.';
      break;

    case 'notifications':
      iconName = 'bell-outline';
      title = 'No notifications';
      subtitle = customSubtitle || "We'll let you know about downloads, updates and important events.";
      break;

    case 'first_launch':
      iconName = 'database-sync-outline';
      title = 'Welcome to SHEEN';
      subtitle = customSubtitle || 'Sync your repositories to discover thousands of open-source Android apps.';
      defaultPrimaryLabel = 'Sync Now';
      break;
  }

  // Determine button labels
  const finalPrimaryLabel = primaryLabel || defaultPrimaryLabel;
  const finalSecondaryLabel = secondaryLabel || defaultSecondaryLabel;

  // Responsive layout constraints
  const isTablet = windowWidth > 600;
  const cardMaxWidth = isTablet ? 480 : '100%';

  return (
    <Animated.View 
      entering={FadeInDown.duration(500).springify().damping(22).stiffness(120)}
      style={[
        styles.container, 
        { 
          maxWidth: cardMaxWidth as any,
          alignSelf: 'center',
        }
      ]}
    >
      {/* Premium M3 Illustration Container with elegant scale spring animation */}
      <Animated.View style={[
        styles.illustrationContainer, 
        { 
          backgroundColor: illustrationBg, 
          borderColor: colors.border || 'rgba(0,0,0,0.06)',
        },
        animatedIllustrationStyle
      ]}>
        <MaterialCommunityIcons 
          name={iconName as any} 
          size={isTablet ? 72 : 56} 
          color={illustrationColor} 
        />
      </Animated.View>

      {/* Narrative Info */}
      <ThemedText style={[styles.title, { color: colors.foreground }]}>
        {title}
      </ThemedText>

      <ThemedText style={[styles.subtitle, { color: colors.mutedForeground }]}>
        {subtitle}
      </ThemedText>

      {/* Optional Metadata (e.g., updates check time) */}
      {lastCheckTime && (
        <View style={styles.metaContainer}>
          <MaterialCommunityIcons name="clock-outline" size={12} color={colors.mutedForeground} />
          <ThemedText style={[styles.metaText, { color: colors.mutedForeground }]}>
            Last checked: {lastCheckTime}
          </ThemedText>
        </View>
      )}

      {/* Button Row / Column for Actions with Staggered layout & high contrast tactile response */}
      <View style={[styles.buttonContainer, { flexDirection: isTablet && onPrimaryPress && onSecondaryPress ? 'row' : 'column' }]}>
        {onPrimaryPress && finalPrimaryLabel && (
          <Pressable 
            onPress={onPrimaryPress} 
            style={({ pressed }) => [
              styles.primaryButton, 
              { 
                backgroundColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }]
              }
            ]}
          >
            <ThemedText style={[styles.primaryButtonText, { color: colors.onPrimary || '#fff' }]}>
              {finalPrimaryLabel}
            </ThemedText>
          </Pressable>
        )}

        {onSecondaryPress && finalSecondaryLabel && (
          <Pressable 
            onPress={onSecondaryPress} 
            style={({ pressed }) => [
              styles.secondaryButton, 
              { 
                backgroundColor: colors.surfaceContainer || 'rgba(0,0,0,0.04)',
                borderColor: colors.border || 'rgba(0,0,0,0.1)',
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }]
              }
            ]}
          >
            <ThemedText style={[styles.secondaryButtonText, { color: colors.primary }]}>
              {finalSecondaryLabel}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  illustrationContainer: {
    width: 120,
    height: 120,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      },
    }),
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 20,
  },
  metaText: {
    fontSize: 12.5,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    width: '100%',
    minWidth: 180,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  primaryButtonText: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    width: '100%',
    minWidth: 180,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
