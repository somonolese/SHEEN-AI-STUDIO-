import React from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNetwork } from '@/contexts/NetworkContext';
import { useColors } from '@/hooks/useColors';
import { useTypography } from '@/hooks/useTypography';
import { ThemedText } from './ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function NoInternetBanner() {
  const { isOffline, isChecking, checkConnection } = useNetwork();
  const colors = useColors();
  const fonts = useTypography();
  const insets = useSafeAreaInsets();

  if (!isOffline) return null;

  const handleRetry = async () => {
    // Tactile feedback on press
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        // Safe fallback
      }
    }

    const connected = await checkConnection();

    if (Platform.OS !== 'web') {
      try {
        if (connected) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } catch (e) {
        // Safe fallback
      }
    }
  };

  return (
    <View 
      style={[
        styles.overlayContainer, 
        { bottom: insets.bottom + 16 }
      ]}
      pointerEvents="box-none"
    >
      <Animated.View
        entering={FadeInDown.duration(350).springify().damping(18).stiffness(120)}
        exiting={FadeOutDown.duration(250)}
        style={[
          styles.bannerCard,
          {
            backgroundColor: colors.surfaceContainerHigh,
            borderColor: colors.border,
            borderRadius: colors.radius,
            shadowColor: '#000',
          }
        ]}
      >
        <View style={styles.leftCol}>
          <View style={[styles.iconContainer, { backgroundColor: colors.destructive + '15' }]}>
            <MaterialCommunityIcons 
              name="wifi-off" 
              size={22} 
              color={colors.destructive} 
            />
          </View>
          <View style={styles.textContainer}>
            <ThemedText style={[styles.title, { fontFamily: fonts.semibold, color: colors.onSurface }]}>
              No Internet Connection
            </ThemedText>
            <ThemedText style={[styles.subtitle, { fontFamily: fonts.regular, color: colors.mutedForeground }]}>
              Browsing offline catalog mode
            </ThemedText>
          </View>
        </View>

        <Pressable
          onPress={handleRetry}
          disabled={isChecking}
          style={({ pressed }) => [
            styles.retryButton,
            {
              backgroundColor: isChecking ? colors.surfaceVariant : colors.primary,
              borderRadius: colors.radius / 1.5,
              opacity: pressed ? 0.85 : 1.0,
            }
          ]}
        >
          {isChecking ? (
            <SkeletonButton width={48} height={16} style={[styles.spinner, { backgroundColor: colors.onSurface + "66" }]} />
          ) : (
            <ThemedText style={[styles.retryText, { fontFamily: fonts.semibold, color: colors.onPrimary }]}>
              Retry
            </ThemedText>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    zIndex: 9999, // Ensure it's above bottom tabs and layouts
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 500, // Look great on tablet & desktop views
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
  },
  retryText: {
    fontSize: 13,
  },
  spinner: {
    transform: [{ scale: 0.8 }],
  }
});
