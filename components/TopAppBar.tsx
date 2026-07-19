import React from 'react';
import { View, StyleSheet, Platform, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTypography } from '@/hooks/useTypography';
import { ThemedText } from './ThemedText';
import { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { useSettings, getSpecialDay } from '@/hooks/useSettings';
import { useDownloads } from '@/hooks/useDownloads';

export function TopAppBar({ navigation, route, options, back }: NativeStackHeaderProps) {
  const colors = useColors();
  const fonts = useTypography();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const router = useRouter();
  const { tasks } = useDownloads();

  const activeCount = tasks.filter(
    (t) => t.status === 'downloading' || t.status === 'queued' || t.status === 'installing'
  ).length;

  const title = options.title || route.name;
  const showBack = !!back;
  const isHome = title === 'SHEEN';

  const specialDay = getSpecialDay();
  
  let showFrostyGlow = false;
  let showEid = false;
  
  if (settings.seasonalEffectsEnabled) {
    if (isHome) {
      if (settings.seasonalEffectsAutoDetect) {
        const month = new Date().getMonth();
        if (month === 11 || month === 0 || month === 1) showFrostyGlow = true;
      } else if (settings.seasonalEffectsPreview === 'winter') {
        showFrostyGlow = true;
      }
      
      if (specialDay === 'eid') showEid = true;
    }
  }

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={{ height: insets.top }} />
      <View style={styles.content}>
        <View style={styles.left}>
          {showBack && (
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && { backgroundColor: colors.surfaceContainerHigh },
              ]}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onSurface} />
            </Pressable>
          )}
        </View>
        
        <View style={styles.titleContainer}>
          {showFrostyGlow && (
            <View style={styles.frostyGlow} />
          )}
          {showEid && (
            <MaterialCommunityIcons 
              name="moon-waning-crescent" 
              size={20} 
              color="rgba(253, 224, 71, 0.8)" 
              style={styles.eidIcon} 
            />
          )}
          <ThemedText
            style={[
              styles.title,
              { color: colors.onSurface, fontFamily: fonts.bold },
              !showBack && styles.titleNoBack,
              showEid && styles.titleWithEid
            ]}
            numberOfLines={1}
          >
            {title}
          </ThemedText>
        </View>

        <View style={styles.right}>
          <Pressable
            onPress={() => router.push('/downloads')}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && { backgroundColor: colors.surfaceContainerHigh },
            ]}
          >
            <MaterialCommunityIcons name="download-outline" size={24} color={colors.onSurface} />
            {activeCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <ThemedText style={[styles.badgeText, { color: colors.onPrimary, fontFamily: fonts.bold }]}>
                  {activeCount}
                </ThemedText>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    zIndex: 100,
  },
  content: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  left: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
  },
  titleNoBack: {
    marginLeft: 12,
  },
  titleWithEid: {
    marginLeft: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frostyGlow: {
    position: 'absolute',
    left: 12,
    top: -10,
    width: 80,
    height: 48,
    backgroundColor: 'rgba(186, 230, 253, 0.25)',
    borderRadius: 24,
    shadowColor: '#bae6fd',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
  },
  eidIcon: {
    marginLeft: 12,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
});
