import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Platform,
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
  SectionList,
  ScrollView,
  FlatList,
  Image,
  TouchableOpacity,
  Pressable,
  Animated as RNAnimated,
  Easing as RNEasing,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { materialCardEnter } from "../../components/animations";
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeInDown,
  FadeOutUp,
  FadeOut,
  ZoomIn,
  ZoomOut,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/useColors';
import { useTypography } from '@/hooks/useTypography';
import { ThemedText } from '@/components/ThemedText';
import { SheenIcon } from '@/components/SheenIcon';
import { AppIconWithRing } from '@/components/downloads/AppIconWithRing';
import { AppDownloadButton } from '@/components/downloads/AppDownloadButton';
import { useAppDownload, useDownloads } from '@/hooks/useDownloads';
import { FeaturedCarouselSkeleton, Skeleton, BrowseAppCardSkeleton, AppCardSkeleton } from '@/components/Skeleton';
import { useCatalogLists } from '@/hooks/useCatalogLists';
import { App } from '@/lib/types';
import { useUpdates } from '@/hooks/useUpdates';
import { useCatalog } from '@/contexts/CatalogContext';
import TabAnimationWrapper from '@/components/TabAnimationWrapper';
import { SheenBackgroundLogo } from '@/components/SheenBackgroundLogo';
import { LinearGradient } from 'expo-linear-gradient';
import { SmartImage } from '@/components/SmartImage';

import { FeaturedCarousel } from '@/components/categories/FeaturedCarousel';
import { ParallaxWrapper } from '@/components/ParallaxWrapper';
import { BrowseAppCard } from '@/components/categories/BrowseAppCard';
import { PostInstallRecommendationCard } from "@/components/recommendations/PostInstallRecommendationCard";
import { AnimatedBasketButton } from '@/components/AnimatedBasketButton';
import { usePostInstallRecommendations } from '@/hooks/usePostInstallRecommendations';
import { useSettings } from '@/hooks/useSettings';
import { AnimatedPressable } from '@/components/settings/SettingsPrimitives';
import { useBasket } from '@/hooks/useBasket';
import { useNotifications } from '@/hooks/useNotifications';

type AppSource = App['source'];

const SOURCE_CONFIG: Record<AppSource, { color: string; bg: string; darkBg: string }> = {
  'F-Droid': { color: '#1B5E20', bg: '#E8F5E9', darkBg: 'rgba(27,94,32,0.35)' },
  'GitHub': { color: '#1565C0', bg: '#E3F2FD', darkBg: 'rgba(21,101,192,0.35)' },
  'IzzyOnDroid': { color: '#BF360C', bg: '#FBE9E7', darkBg: 'rgba(191,54,12,0.35)' },
  'Other': { color: '#455A64', bg: '#ECEFF1', darkBg: 'rgba(69,90,100,0.35)' },
};

function SourceBadge({ source, dark = false }: { source: AppSource; dark?: boolean }) {
  const cfg = SOURCE_CONFIG[source] || SOURCE_CONFIG['Other'];
  return (
    <View style={[styles.badge, { backgroundColor: dark ? cfg.darkBg : cfg.bg }]}>
      <ThemedText style={[styles.badgeText, { color: dark ? '#fff' : cfg.color }]}>{source}</ThemedText>
    </View>
  );
}

function SectionHeader({ title, showSeeAll = true, colors, onPress }: { title: string; showSeeAll?: boolean; colors: ReturnType<typeof useColors>; onPress?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</ThemedText>
      {showSeeAll && (
        <TouchableOpacity onPress={onPress}>
          <ThemedText style={[styles.seeAll, { color: colors.primary }]}>See all</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
}

function AppCard({ app, index, colors, onPress, hasUpdate }: { app: App; index: number; colors: ReturnType<typeof useColors>; onPress?: () => void; hasUpdate?: boolean }) {
  const { startDownload } = useDownloads();
  const download = useAppDownload(app.id);
  const { add: addToBasket, remove: removeFromBasket, isInBasket } = useBasket();
  const inBasket = isInBasket(app.id);

  return (
    <Animated.View entering={materialCardEnter(index, 180, 30)}>
      <AnimatedPressable accessibilityRole="none" style={[styles.appCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onPress}>
        <View style={[styles.appCardIconArea, { backgroundColor: `${app.color ?? '#000'}14` }]}>
          <AppIconWithRing 
            app={app}
            letter={app.letter ?? app.name.charAt(0)} 
            color={app.color ?? '#000'} 
            size={46} 
            download={download} 
            hasUpdate={hasUpdate} 
            iconUrl={app.iconUrl} 
          />
        </View>
        <View style={styles.appCardBody}>
          <ThemedText style={[styles.appCardName, { color: colors.foreground }]} numberOfLines={1}>{app.name}</ThemedText>
          <ThemedText style={[{ fontSize: 13, color: colors.foreground, marginTop: 4 }]} numberOfLines={3}>{cleanHtml(app.shortDescription || app.description)}</ThemedText>
          <ThemedText style={[styles.appCardDev, { color: colors.mutedForeground, marginTop: 6, fontSize: 11, fontWeight: '500' }]} numberOfLines={1}>{app.developer} • {app.source} • v{app.currentVersion?.versionName || '1.0.0'}</ThemedText>
        </View>
        <View style={styles.appCardBtnWrap}>
          <AnimatedBasketButton
            inBasket={inBasket}
            onPress={(e: any) => {
              e.stopPropagation();
              inBasket ? removeFromBasket(app.id) : addToBasket(app);
            }}
            style={styles.basketBtn}
            textStyle={styles.basketBtnText}
            colors={colors}
            iconSize={16}
          />
          <AppDownloadButton
            appId={app.id}
            onStartDownload={() =>
              startDownload({
                appId: app.id,
                name: app.name,
                developer: app.developer,
                letter: app.letter ?? app.name.charAt(0).toUpperCase(),
                color: app.color ?? '#4F46E5',
                version: app.currentVersion?.versionName ?? '1.0.0',
                sizeBytes: app.currentVersion?.sizeBytes,
                apkUrl: app.currentVersion?.apkUrl,
                repositoryId: app.repositoryId,
                iconUrl: app.iconUrl,
              })
            }
          />
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

import { EmptyState } from '@/components/EmptyState';
import { useNetwork } from '@/contexts/NetworkContext';
import { cleanHtml } from '@/lib/html';

function EmptyCatalogState({ colors, onSync }: { colors: ReturnType<typeof useColors>; onSync: () => void }) {
  const { isOffline, checkConnection } = useNetwork();

  if (isOffline) {
    return (
      <EmptyState
        type="offline"
        onPrimaryPress={checkConnection}
        primaryLabel="Retry"
      />
    );
  }

  return (
    <EmptyState
      type="first_launch"
      onPrimaryPress={onSync}
      primaryLabel="Sync now"
    />
  );
}

function ProfileHeader({ colors, fonts, settings, onAvatarPress, updatesCount, unreadCount = 0 }: { colors: ReturnType<typeof useColors>, fonts: ReturnType<typeof useTypography>, settings: ReturnType<typeof useSettings>['settings'], onAvatarPress: () => void, updatesCount: number, unreadCount?: number }) {
  const getBaseGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const [greeting, setGreeting] = useState(() => getBaseGreeting());

  useEffect(() => {
    const interval = setInterval(() => {
      const nextGreeting = getBaseGreeting();
      if (nextGreeting !== greeting) {
        setGreeting(nextGreeting);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [greeting]);

  const [brightness, setBrightness] = useState<number>(150);

  useEffect(() => {
    if (settings.coverPhoto) {
      const cacheKey = `sheen:brightness:${settings.coverPhoto}`;
      AsyncStorage.getItem(cacheKey)
        .then((stored) => {
          if (stored !== null) {
            const val = parseFloat(stored);
            if (!isNaN(val)) {
              setBrightness(val);
              return;
            }
          }
          if (Platform.OS === 'web') {
            const img = new window.Image();
            img.crossOrigin = 'Anonymous';
            img.src = settings.coverPhoto!;
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = 10;
                canvas.height = 10;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0, 10, 10);
                  const imgData = ctx.getImageData(0, 0, 10, 10).data;
                  let r = 0, g = 0, b = 0;
                  for (let i = 0; i < imgData.length; i += 4) {
                    r += imgData[i];
                    g += imgData[i + 1];
                    b += imgData[i + 2];
                  }
                  const count = imgData.length / 4;
                  const avgR = r / count;
                  const avgG = g / count;
                  const avgB = b / count;
                  const calculated = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;
                  setBrightness(calculated);
                  AsyncStorage.setItem(cacheKey, calculated.toString()).catch(() => {});
                }
              } catch (e) {
                setBrightness(150);
              }
            };
            img.onerror = () => {
              setBrightness(150);
            };
          } else {
            setBrightness(150);
          }
        })
        .catch(() => {
          setBrightness(150);
        });
    }
  }, [settings.coverPhoto]);

  const hasAccount = !!(settings.userName || settings.profilePicture);
  const displayName = hasAccount ? (settings.userName || 'Guest') : 'Hello there';
  const hasImage = !!settings.profilePicture;
  const initial = settings.userName ? settings.userName.charAt(0).toUpperCase() : 'S';
  const hasCover = !!settings.coverPhoto;

  // Adaptive overlay levels based on calculated image brightness
  const baseScrimOpacity = 0.12 + (brightness / 255) * 0.28; // ranges from 0.12 to 0.40
  const bottomGradientOpacity = 0.25 + (brightness / 255) * 0.50; // ranges from 0.25 to 0.75

  const containerStyle = [
    styles.profileHeader,
    hasCover && {
      marginHorizontal: 20,
      paddingVertical: 24,
      paddingHorizontal: 20,
      borderRadius: 24,
      overflow: 'hidden',
      marginTop: 16,
      marginBottom: 28,
      backgroundColor: colors.surfaceContainerHigh,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
    }
  ];

  return (
    <Animated.View entering={FadeInUp.duration(600).springify().damping(20)} style={containerStyle}>
      {hasCover && (
        <Animated.View 
          entering={FadeIn.duration(400)}
          exiting={FadeOut.duration(400)}
          style={StyleSheet.absoluteFill}
        >
          <SmartImage 
            source={{ uri: settings.coverPhoto }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={400}
          />
          {/* Solid color dimming overlay adapted to image brightness */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'black', opacity: baseScrimOpacity }]} />
          
          {/* Smooth bottom-to-top scrim gradient */}
          <LinearGradient
            colors={['rgba(0,0,0,0)', `rgba(0,0,0,${bottomGradientOpacity})` ]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
        </Animated.View>
      )}

      <View style={styles.profileHeaderLeft}>
        <ThemedText 
          style={[
            styles.profileGreeting, 
            { 
              color: hasCover ? 'rgba(255, 255, 255, 0.75)' : colors.mutedForeground, 
              fontFamily: fonts.medium 
            }
          ]}
        >
          {greeting}
        </ThemedText>
        <ThemedText 
          style={[
            styles.profileLeftName, 
            { 
              color: hasCover ? '#FFFFFF' : colors.foreground, 
              fontFamily: fonts.bold,
              textShadowColor: hasCover ? 'rgba(0,0,0,0.4)' : 'transparent',
              textShadowOffset: hasCover ? { width: 0, height: 1 } : { width: 0, height: 0 },
              textShadowRadius: hasCover ? 4 : 0,
            }
          ]}
        >
          {displayName}
        </ThemedText>
      </View>
      <View style={styles.profileHeaderRight}>
        <AnimatedPressable 
          onPress={onAvatarPress} 
          style={[
            styles.largeAvatarWrap, 
            { 
              backgroundColor: colors.surfaceContainerHigh,
              borderColor: hasCover ? '#FFFFFF' : colors.primary,
              borderWidth: hasCover ? 2 : 1.5,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: hasCover ? 0.3 : 0.08,
              shadowRadius: 4,
            }
          ]}
        >
          {hasImage ? (
            <Image source={{ uri: settings.profilePicture }} style={styles.largeAvatarImage} />
          ) : (
            <ThemedText style={[styles.largeAvatarInitial, { color: colors.onSurfaceVariant }]}>{initial}</ThemedText>
          )}
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
}

function HorizontalAppList({ apps, title, colors, updateIds, openDetails, onSeeAll }: { apps: App[], title: string, colors: ReturnType<typeof useColors>, updateIds: Set<string>, openDetails: (id: string) => void, onSeeAll: () => void }) {
  if (!apps || apps.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(100).springify().damping(22).stiffness(140)} style={styles.section}>
      <SectionHeader title={title} showSeeAll={true} colors={colors} onPress={onSeeAll} />
      <FlatList
        data={apps}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <AppCard
            app={item}
            index={index}
            colors={colors}
            onPress={() => openDetails(item.id)}
            hasUpdate={updateIds.has(item.id)}
          />
        )}
      />
    </Animated.View>
  );
}

const SORT_OPTIONS = [
  { id: 'recommended', label: 'Recommended', icon: 'thumb-up-outline' },
  { id: 'recently_updated', label: 'Recently Updated', icon: 'calendar-sync' },
  { id: 'newly_added', label: 'Newly Added', icon: 'new-box' },
  { id: 'trending', label: 'Trending', icon: 'trending-up' },
  { id: 'most_downloaded', label: 'Most Downloaded', icon: 'download-outline' },
  { id: 'highest_rated', label: 'Highest Rated', icon: 'star-outline' },
  { id: 'a_z', label: 'A–Z', icon: 'sort-alphabetical-ascending' },
  { id: 'z_a', label: 'Z–A', icon: 'sort-alphabetical-descending' },
  { id: 'smallest_size', label: 'Smallest Size', icon: 'file-download-outline' },
  { id: 'largest_size', label: 'Largest Size', icon: 'file-percent-outline' },
] as const;

type SortOption = typeof SORT_OPTIONS[number]['id'];

const AnimatedSectionList = RNAnimated.createAnimatedComponent(SectionList);


function ParallaxProfileHeader({ scrollY, colors, fonts, settings, onAvatarPress, updatesCount, unreadCount = 0, insets }: any) {
  const HEADER_MAX_HEIGHT = 280;
  const HEADER_MIN_HEIGHT = Platform.OS === 'web' ? 64 : insets.top + 60;
  const scrollDistance = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, scrollDistance],
    outputRange: [0, -scrollDistance],
    extrapolate: 'clamp',
  });

  const imageScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.3, 1],
    extrapolateLeft: 'extend',
    extrapolateRight: 'clamp',
  });

  const imageTranslateY = scrollY.interpolate({
    inputRange: [0, scrollDistance],
    outputRange: [0, scrollDistance * 0.5],
    extrapolate: 'clamp',
  });

  const contentOpacity = scrollY.interpolate({
    inputRange: [0, scrollDistance * 0.6],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const getBaseGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };
  const [greeting, setGreeting] = React.useState(getBaseGreeting);

  React.useEffect(() => {
    const interval = setInterval(() => {
      const nextGreeting = getBaseGreeting();
      if (nextGreeting !== greeting) setGreeting(nextGreeting);
    }, 60000);
    return () => clearInterval(interval);
  }, [greeting]);

  const hasAccount = !!(settings.userName || settings.profilePicture);
  const displayName = hasAccount ? (settings.userName || 'Guest') : 'Hello there';
  const hasImage = !!settings.profilePicture;
  const initial = settings.userName ? settings.userName.charAt(0).toUpperCase() : 'S';
  const hasCover = !!settings.coverPhoto;

  const toolbarTranslateY = scrollY.interpolate({
    inputRange: [0, scrollDistance],
    outputRange: [0, scrollDistance],
    extrapolate: 'clamp',
  });

  return (
    <RNAnimated.View style={[styles.parallaxHeader, { height: HEADER_MAX_HEIGHT, transform: [{ translateY: headerTranslateY }] }]}>
      {hasCover ? (
        <RNAnimated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: imageTranslateY }, { scale: imageScale }] }]}>
          <SmartImage source={{ uri: settings.coverPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'black', opacity: 0.3 }]} />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0.3 }}
            end={{ x: 0, y: 1 }}
          />
        </RNAnimated.View>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceContainerHigh }]} />
      )}

      {/* Toolbar top icons (Notification & Avatar) */}
      <RNAnimated.View style={[styles.parallaxToolbar, { paddingTop: Platform.OS === 'web' ? 12 : insets.top + 8, transform: [{ translateY: toolbarTranslateY }] }]}>
        <View style={{ flex: 1 }} />
        <View style={styles.parallaxToolbarIcons}>
          <TouchableOpacity style={styles.toolbarIconWrap}>
            <MaterialCommunityIcons name="bell-outline" size={24} color={hasCover ? '#FFFFFF' : colors.onSurface} />
            {unreadCount > 0 && (
              <View style={styles.badgeDot} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={onAvatarPress} style={[styles.toolbarAvatarWrap, { borderColor: hasCover ? 'rgba(255,255,255,0.8)' : colors.border }]}>
            {hasImage ? (
              <Image source={{ uri: settings.profilePicture }} style={styles.toolbarAvatar} />
            ) : (
              <ThemedText style={{ color: colors.onSurfaceVariant, fontWeight: 'bold' }}>{initial}</ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </RNAnimated.View>

      {/* Bottom Content */}
      <RNAnimated.View style={[styles.parallaxContent, { opacity: contentOpacity }]}>
        <ThemedText style={[styles.parallaxGreeting, { color: hasCover ? 'rgba(255,255,255,0.8)' : colors.mutedForeground, fontFamily: fonts.medium }]}>
          {greeting}
        </ThemedText>
        <ThemedText style={[styles.parallaxName, { color: hasCover ? '#FFFFFF' : colors.foreground, fontFamily: fonts.bold }]}>
          {displayName}
        </ThemedText>
      </RNAnimated.View>
    </RNAnimated.View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const fonts = useTypography();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const hasCover = !!settings.coverPhoto;
  const { apps, repositories, syncRepositories, syncState, syncProgress, isLoading: catalogLoading } = useCatalog();
  const { featured, popular, recentlyUpdated, trending, recommended, isLoading, hasApps } = useCatalogLists();
  const { updates, isLoading: updatesLoading } = useUpdates(apps);
  const { unreadCount } = useNotifications();
  const { activeRecommendationAppId, dismissRecommendation } = usePostInstallRecommendations();
  const updateIds = useMemo(() => new Set(updates.map(u => u.app.id)), [updates]);
  const autoSyncAttempted = useRef(false);

  const [refreshing, setRefreshing] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(20);
  const [filter, setFilter] = useState<SortOption>('recommended');
  const [showSortChips, setShowSortChips] = useState(false);

  // Load last selected sort option from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem('sheen.last_sort_option')
      .then((savedFilter) => {
        if (savedFilter) {
          setFilter(savedFilter as SortOption);
        }
      })
  }, []);

  const handleSelectSort = useCallback((option: SortOption) => {
    setFilter(option);
    AsyncStorage.setItem('sheen.last_sort_option', option).catch(() => {});
  }, []);

  // Custom Pull-To-Refresh States
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshState, setRefreshState] = useState<'idle' | 'pulling' | 'refreshing' | 'success'>('idle');
  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const reanimatedScrollY = useSharedValue(0);

  const touchStartY = useRef<number | null>(null);
  const isPulling = useRef(false);
  const sectionListRef = useRef<AnimatedSectionList>(null);
  const [isFabVisible, setIsFabVisible] = useState(false);
  const fabScale = useSharedValue(0);

  useEffect(() => {
    fabScale.value = withSpring(isFabVisible ? 1 : 0);
  }, [isFabVisible]);

  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
    opacity: fabScale.value,
  }));
  
  const pullAnim = useRef(new RNAnimated.Value(0)).current;
  const spinAnim = useRef(new RNAnimated.Value(0)).current;
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;

  const onRefresh = useCallback(async () => {
    if (syncState === 'syncing') return;
    setRefreshing(true);
    setVisibleLimit(20);
    await syncRepositories();
    setRefreshing(false);
  }, [syncRepositories, syncState]);

  // Listen to external syncState changes
  useEffect(() => {
    if (refreshState === 'refreshing') {
      if (syncState === 'success' || (syncState === 'idle' && !refreshing)) {
        setRefreshState('success');
        
        // Use a timeout that doesn't get cleared on the immediate re-render 
        // caused by setRefreshState('success')
        setTimeout(() => {
          RNAnimated.spring(pullAnim, {
            toValue: 0,
            useNativeDriver: false,
            tension: 80,
            friction: 8,
          }).start(() => {
            setPullDistance(0);
            pullDistanceRef.current = 0;
            setRefreshState('idle');
          });
        }, 1200);
      } else if (syncState === 'error') {
        setRefreshState('idle');
        pullDistanceRef.current = 0;
        RNAnimated.spring(pullAnim, {
          toValue: 0,
          useNativeDriver: false,
          tension: 100,
          friction: 10,
        }).start(() => {
          setPullDistance(0);
        });
      }
    }
  }, [syncState, refreshing, refreshState]);

  // Spin and pulse loops
  useEffect(() => {
    if (refreshState === 'refreshing') {
      spinAnim.setValue(0);
      pulseAnim.setValue(1);

      const spinLoop = RNAnimated.loop(
        RNAnimated.timing(spinAnim, {
          toValue: 1,
          duration: 1500,
          easing: RNEasing.linear,
          useNativeDriver: true,
        })
      );
      spinLoop.start();

      const pulseLoop = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 750,
            useNativeDriver: true,
          }),
          RNAnimated.timing(pulseAnim, {
            toValue: 1,
            duration: 750,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();

      return () => {
        spinLoop.stop();
        pulseLoop.stop();
      };
    }
  }, [refreshState]);

  const pullDistanceRef = useRef(0);

  // Keep stable refs to avoid stale closures in the PanResponder
  const refreshStateRef = useRef(refreshState);
  useEffect(() => {
    refreshStateRef.current = refreshState;
  }, [refreshState]);

  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only trigger if we are at the top of the scroll list, dragging down,
        // and vertical movement is significantly greater than horizontal movement.
        const isScrollAtTop = scrollY.current <= 5;
        const isDraggingDown = gestureState.dy > 5;
        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5;
        const currentRefreshState = refreshStateRef.current;
        
        if (isScrollAtTop && isDraggingDown && isVerticalSwipe && currentRefreshState !== 'refreshing' && currentRefreshState !== 'success') {
          isPulling.current = true;
          return true;
        }
        return false;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        const isScrollAtTop = scrollY.current <= 5;
        const isDraggingDown = gestureState.dy > 5;
        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5;
        const currentRefreshState = refreshStateRef.current;
        
        if (isScrollAtTop && isDraggingDown && isVerticalSwipe && currentRefreshState !== 'refreshing' && currentRefreshState !== 'success') {
          isPulling.current = true;
          return true;
        }
        return false;
      },
      onPanResponderGrant: () => {
        setRefreshState('pulling');
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!isPulling.current) return;
        const dy = gestureState.dy;
        if (dy > 0) {
          let targetDistance = 0;
          if (dy <= 160) {
            targetDistance = dy * 0.5;
          } else {
            targetDistance = 80 + (dy - 160) * 0.2;
          }
          targetDistance = Math.min(120, targetDistance);
          
          const wasReady = pullDistanceRef.current >= 70;
          const isReady = targetDistance >= 70;
          if (wasReady !== isReady) {
            setPullDistance(targetDistance);
          }
          
          pullDistanceRef.current = targetDistance;
          pullAnim.setValue(targetDistance);
        }
      },
      onPanResponderRelease: () => {
        isPulling.current = false;
        const currentPull = pullDistanceRef.current;
        if (currentPull >= 70) {
          setRefreshState('refreshing');
          setPullDistance(80);
          pullDistanceRef.current = 80;
          
          RNAnimated.spring(pullAnim, {
            toValue: 80,
            useNativeDriver: false,
            tension: 80,
            friction: 8,
          }).start();
          
          onRefreshRef.current();
        } else {
          RNAnimated.spring(pullAnim, {
            toValue: 0,
            useNativeDriver: false,
            tension: 100,
            friction: 10,
          }).start(() => {
            setPullDistance(0);
            pullDistanceRef.current = 0;
            setRefreshState('idle');
          });
        }
      },
      onPanResponderTerminate: () => {
        isPulling.current = false;
        RNAnimated.spring(pullAnim, {
          toValue: 0,
          useNativeDriver: false,
          tension: 100,
          friction: 10,
        }).start(() => {
          setPullDistance(0);
          pullDistanceRef.current = 0;
          setRefreshState('idle');
        });
      },
    });
  }, []);

  const renderPullIllustration = () => {
    const rotateValue = spinAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    const swipeRotateValue = pullAnim.interpolate({
      inputRange: [0, 100],
      outputRange: ['0deg', '180deg'],
    });

    let statusText = 'Pull down to refresh';
    let subStatusText = 'Discover updates & new apps';
    
    if (refreshState === 'pulling') {
      if (pullDistance >= 70) {
        statusText = 'Release to sync';
        subStatusText = 'Ready to fetch open-source catalog';
      } else {
        statusText = 'Keep pulling';
        subStatusText = 'Discover updates & new apps';
      }
    } else if (refreshState === 'refreshing') {
      statusText = 'Syncing Catalogs';
      const activeProgress = syncProgress?.find(p => p.phase !== 'done' && p.phase !== 'error');
      if (activeProgress) {
        const repo = repositories.find(r => r.id === activeProgress.repositoryId);
        const repoName = repo?.name || activeProgress.repositoryId;
        const phaseLabel = {
          fetching: `Fetching ${repoName}...`,
          parsing: `Parsing ${repoName}...`,
          caching: `Caching ${repoName}...`,
        }[activeProgress.phase] || `Syncing ${repoName}...`;
        subStatusText = phaseLabel;
      } else {
        subStatusText = 'Connecting to sources...';
      }
    } else if (refreshState === 'success') {
      statusText = 'Synchronized!';
      subStatusText = 'Your catalog is up to date';
    }

    return (
      <RNAnimated.View 
        style={[
          styles.pullContainer, 
          { 
            height: pullAnim,
            opacity: pullAnim.interpolate({
              inputRange: [0, 20, 70],
              outputRange: [0, 0.4, 1],
            }),
            backgroundColor: colors.surfaceContainerLowest,
          }
        ]}
      >
        <View style={styles.pullContent}>
          <View style={styles.illustrationWrapper}>
            <View style={[styles.ambientGlow, { backgroundColor: colors.primary, opacity: refreshState === 'success' ? 0.15 : 0.05 }]} />

            <RNAnimated.View 
              style={[
                styles.orbitRing, 
                { 
                  borderColor: colors.primary, 
                  opacity: 0.3,
                  transform: [
                    { rotate: refreshState === 'refreshing' ? rotateValue : swipeRotateValue },
                    { scale: refreshState === 'refreshing' ? pulseAnim : 1 }
                  ]
                }
              ]}
            >
              <View style={[styles.orbitNode, { backgroundColor: colors.primary, top: -4, left: '50%', marginLeft: -4 }]} />
              <View style={[styles.orbitNode, { backgroundColor: colors.primary, bottom: -4, left: '50%', marginLeft: -4 }]} />
            </RNAnimated.View>

            <RNAnimated.View 
              style={[
                styles.centerIconWrap, 
                { 
                  backgroundColor: refreshState === 'success' ? '#2E7D32' : colors.surfaceContainerHigh,
                  transform: [
                    { scale: refreshState === 'refreshing' ? pulseAnim : 1 }
                  ]
                }
              ]}
            >
              {refreshState === 'success' ? (
                <MaterialCommunityIcons name="check-bold" size={26} color="#FFFFFF" />
              ) : (
                <MaterialCommunityIcons 
                  name={refreshState === 'refreshing' ? "cloud-sync-outline" : "rhombus-split-outline"} 
                  size={26} 
                  color={colors.primary} 
                />
              )}
            </RNAnimated.View>
          </View>

          <View style={styles.pullTextWrap}>
            <ThemedText style={[styles.pullStatusText, { color: colors.foreground, fontFamily: fonts.bold }]}>
              {statusText}
            </ThemedText>
            <ThemedText style={[styles.pullSubstatusText, { color: colors.mutedForeground, fontFamily: fonts.regular }]}>
              {subStatusText}
            </ThemedText>
          </View>
        </View>
      </RNAnimated.View>
    );
  };

  useEffect(() => setVisibleLimit(20), [apps]);
  
  const loadMore = useCallback(() => {
    setVisibleLimit((prev) => prev + 20);
  }, []);

  useEffect(() => {
    if (!catalogLoading && !hasApps && !autoSyncAttempted.current && syncState !== 'syncing') {
      autoSyncAttempted.current = true;
      syncRepositories();
    }
  }, [catalogLoading, hasApps, syncState, syncRepositories]);

  const openDetails = (id: string) => router.push({ pathname: '/app-details/[id]', params: { id } });
  const openUpdates = () => router.push('/updates');
  const updatesCount = updates.length;

  const { width: windowWidth } = useWindowDimensions();
  const isRailMode = windowWidth >= 600;
  const topPad = Platform.OS === 'web' ? 16 : insets.top + 16;
  const bottomPad = isRailMode 
    ? (insets.bottom + 16) 
    : (Platform.OS === 'web' ? 34 + 88 : insets.bottom + 76);

  const isBusy = isLoading || catalogLoading || syncState === 'syncing';

  const sections = useMemo(() => {
    if (!apps || apps.length === 0) return [];
    
    // Deduplicate and sort all apps
    const uniqueAppsMap = new Map<string, App>();
    apps.forEach(app => {
      if (!uniqueAppsMap.has(app.packageName)) {
        uniqueAppsMap.set(app.packageName, app);
      }
    });
    
    let sortedApps = Array.from(uniqueAppsMap.values());
    
    if (filter === 'recommended') {
      sortedApps.sort((a, b) => {
        const scoreA = (a.rating ?? 4.0) * Math.log((a.downloads ?? 0) + 2);
        const scoreB = (b.rating ?? 4.0) * Math.log((b.downloads ?? 0) + 2);
        return scoreB - scoreA;
      });
    } else if (filter === 'recently_updated') {
      sortedApps.sort((a, b) => (b.lastUpdated || b.added || 0) - (a.lastUpdated || a.added || 0));
    } else if (filter === 'newly_added') {
      sortedApps.sort((a, b) => (b.added || 0) - (a.added || 0));
    } else if (filter === 'trending') {
      sortedApps.sort((a, b) => {
        const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
        if (Math.abs(ratingDiff) > 0.1) return ratingDiff;
        return (b.downloads ?? 0) - (a.downloads ?? 0);
      });
    } else if (filter === 'most_downloaded') {
      sortedApps.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));
    } else if (filter === 'highest_rated') {
      sortedApps.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (filter === 'a_z') {
      sortedApps.sort((a, b) => a.name.localeCompare(b.name));
    } else if (filter === 'z_a') {
      sortedApps.sort((a, b) => b.name.localeCompare(a.name));
    } else if (filter === 'smallest_size') {
      sortedApps.sort((a, b) => {
        const sizeA = a.currentVersion?.sizeBytes ?? Infinity;
        const sizeB = b.currentVersion?.sizeBytes ?? Infinity;
        return sizeA - sizeB;
      });
    } else if (filter === 'largest_size') {
      sortedApps.sort((a, b) => {
        const sizeA = a.currentVersion?.sizeBytes ?? 0;
        const sizeB = b.currentVersion?.sizeBytes ?? 0;
        return sizeB - sizeA;
      });
    }
    
    const grouped = new Map<string, App[]>();
    sortedApps.forEach(app => {
      const groupKey = (filter === 'a_z' || filter === 'z_a') 
        ? (/[A-Z]/.test(app.name.charAt(0).toUpperCase()) ? app.name.charAt(0).toUpperCase() : '#') 
        : 'All';
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey)!.push(app);
    });
    
    const result = Array.from(grouped.entries())
      .map(([title, data]) => ({ title, data }))
      .sort((a, b) => {
        if (filter !== 'a_z' && filter !== 'z_a') return 0;
        if (a.title === '#') return 1;
        if (b.title === '#') return -1;
        
        if (filter === 'a_z') {
          return a.title.localeCompare(b.title);
        } else {
          return b.title.localeCompare(a.title);
        }
      });
      
    // Truncate to visibleLimit for lazy loading
    let currentCount = 0;
    const truncatedSections = [];
    for (const section of result) {
      if (currentCount >= visibleLimit) break;
      if (currentCount + section.data.length <= visibleLimit) {
        truncatedSections.push(section);
        currentCount += section.data.length;
      } else {
        truncatedSections.push({ title: section.title, data: section.data.slice(0, visibleLimit - currentCount) });
        currentCount = visibleLimit;
      }
    }
    
    return truncatedSections;
  }, [apps, visibleLimit, filter]);

  const hasMoreApps = useMemo(() => {
    return sections.reduce((acc, s) => acc + s.data.length, 0) < apps.length;
  }, [sections, apps.length]);

  return (
    <TabAnimationWrapper>
      <View style={[styles.root, { backgroundColor: 'transparent' }]} {...panResponder.panHandlers}>
        <StatusBar translucent backgroundColor="transparent" barStyle={hasCover ? 'light-content' : (colorScheme === 'dark' ? 'light-content' : 'dark-content')} />
        
        <SheenBackgroundLogo />
        <ParallaxProfileHeader scrollY={scrollY} colors={colors} fonts={fonts} settings={settings} onAvatarPress={() => router.push('/profile')} updatesCount={updatesCount} unreadCount={unreadCount} insets={insets} />

        <AnimatedSectionList
          ref={sectionListRef}
          sections={sections}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={refreshState === 'idle'}
          contentContainerStyle={[styles.scroll, { paddingTop: topPad + 280, paddingBottom: bottomPad }]}
          stickySectionHeadersEnabled={true}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          onScroll={RNAnimated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            {
              useNativeDriver: true,
              listener: (e: any) => {
                const y = e.nativeEvent.contentOffset.y;
                reanimatedScrollY.value = y;
                setIsFabVisible(y > 500);
              }
            }
          )}
          scrollEventThrottle={16}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <View style={{ paddingHorizontal: 20 }}>
              <BrowseAppCard
                app={item}
                index={index % 10}
                onPress={() => openDetails(item.id)}
                hasUpdate={updateIds.has(item.id)}
              />
            </View>
          )}
          renderSectionHeader={({ section: { title } }) => {
            if (title === 'All') return null;
            return (
              <View style={[styles.alphabetHeader, { backgroundColor: colors.background }]}>
                <ThemedText style={[styles.alphabetHeaderText, { color: colors.primary }]}>{title}</ThemedText>
              </View>
            );
          }}
          ListHeaderComponent={
            <>
              {renderPullIllustration()}
              

              {updatesCount > 0 && (
                <Animated.View entering={FadeInUp.delay(40).springify().damping(20).stiffness(150)} style={styles.updatesBannerWrap}>
                  <AnimatedPressable onPress={openUpdates} style={[styles.updatesBanner, { backgroundColor: colors.secondaryContainer }]}>
                    <MaterialCommunityIcons name="shield-sync-outline" size={20} color={colors.onSecondaryContainer} />
                    <ThemedText style={[styles.updatesBannerText, { color: colors.onSecondaryContainer }]}>
                      {updatesCount} update{updatesCount > 1 ? 's' : ''} available — review confidence before installing
                    </ThemedText>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.onSecondaryContainer} />
                  </AnimatedPressable>
                </Animated.View>
              )}

              {activeRecommendationAppId && (
                <PostInstallRecommendationCard 
                  installedAppId={activeRecommendationAppId}
                  onDismiss={() => dismissRecommendation(activeRecommendationAppId)}
                />
              )}

              {!hasApps && !isBusy ? (
                <EmptyCatalogState colors={colors} onSync={syncRepositories} />
              ) : (
                <>
                  <Animated.View entering={FadeInUp.delay(60).springify().damping(22).stiffness(140)} style={styles.section}>
                    <SectionHeader title="Featured Apps" showSeeAll={false} colors={colors} />
                    {isBusy || !featured || featured.length === 0 ? (
                      <FeaturedCarouselSkeleton />
                    ) : (
                      <ParallaxWrapper scrollY={reanimatedScrollY} height={310}>
                        <FeaturedCarousel apps={featured} onPress={openDetails} updateIds={updateIds} />
                      </ParallaxWrapper>
                    )}
                  </Animated.View>

                  {isBusy ? (
                    <View style={styles.section}>
                       <SectionHeader title="Trending" showSeeAll={true} colors={colors} onPress={() => router.push('/collection/trending')} />
                       <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listContent}>
                         <AppCardSkeleton />
                         <AppCardSkeleton />
                         <AppCardSkeleton />
                       </ScrollView>
                    </View>
                  ) : (
                    <>
                      <HorizontalAppList title="Trending" apps={popular} colors={colors} updateIds={updateIds} openDetails={openDetails} onSeeAll={() => router.push('/collection/trending')} />
                      <HorizontalAppList title="Newly Launched" apps={trending} colors={colors} updateIds={updateIds} openDetails={openDetails} onSeeAll={() => router.push('/collection/newly-launched')} />
                      <HorizontalAppList title="Recommended for You" apps={recommended} colors={colors} updateIds={updateIds} openDetails={openDetails} onSeeAll={() => router.push('/collection/recommended')} />
                    </>
                  )}

                  {hasApps && (
                    <>
                      <View style={[styles.sectionHeader, { marginTop: 36, marginBottom: showSortChips ? 8 : 16 }]}>
                        <ThemedText style={[styles.sectionTitle, { color: colors.foreground }]}>Browse All Apps</ThemedText>
                        <TouchableOpacity 
                          onPress={() => setShowSortChips(prev => !prev)} 
                          style={{ padding: 8 }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MaterialCommunityIcons 
                            name="sort-variant" 
                            size={24} 
                            color={showSortChips ? colors.primary : colors.foreground} 
                          />
                        </TouchableOpacity>
                      </View>
                      
                      {showSortChips && (
                        <Animated.View 
                          entering={FadeInDown.springify().damping(18).stiffness(160).mass(0.8)}
                          exiting={FadeOutUp.duration(150)}
                          style={styles.chipsContainer}
                        >
                          <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.chipsScrollContent}
                          >
                            {SORT_OPTIONS.map((option) => {
                              const isSelected = filter === option.id;
                              return (
                                <AnimatedPressable
                                  key={option.id}
                                  onPress={() => handleSelectSort(option.id)}
                                  style={[
                                    styles.chip,
                                    { 
                                      borderColor: isSelected ? colors.primary : colors.border,
                                      backgroundColor: isSelected ? colors.primary : colors.surfaceContainer,
                                    }
                                  ]}
                                >
                                  <MaterialCommunityIcons 
                                    name={option.icon} 
                                    size={16} 
                                    color={isSelected ? '#FFFFFF' : colors.mutedForeground} 
                                    style={{ marginRight: 6 }}
                                  />
                                  <ThemedText 
                                    style={[
                                      styles.chipText,
                                      { 
                                        color: isSelected ? '#FFFFFF' : colors.foreground,
                                        fontFamily: isSelected ? fonts.bold : fonts.regular 
                                      }
                                    ]}
                                  >
                                    {option.label}
                                  </ThemedText>
                                </AnimatedPressable>
                              );
                            })}
                          </ScrollView>
                        </Animated.View>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          }
          ListFooterComponent={
            hasMoreApps ? (
              <View style={{ paddingHorizontal: 20, gap: 12, paddingBottom: 20 }}>
                <BrowseAppCardSkeleton />
                <BrowseAppCardSkeleton />
                <BrowseAppCardSkeleton />
              </View>
            ) : <View style={{ height: 40 }} />
          }
        />
        {isFabVisible && (
          <Animated.View
            entering={ZoomIn.springify().damping(15).stiffness(160)}
            exiting={ZoomOut.duration(150)}
            style={[styles.fab, fabAnimatedStyle, { backgroundColor: colors.primaryContainer }]}
          >
            <Pressable
              onPress={() => {
                sectionListRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true });
                setIsFabVisible(false);
              }}
              style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28 }}
              accessibilityLabel="Scroll to top"
            >
              <MaterialCommunityIcons name="arrow-up" size={24} color={colors.onPrimaryContainer} />
            </Pressable>
          </Animated.View>
        )}
      </View>
    </TabAnimationWrapper>
  );
}

const styles = StyleSheet.create({
  parallaxHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  parallaxToolbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 20,
  },
  parallaxToolbarIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toolbarIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff3b5c',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  toolbarAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  toolbarAvatar: {
    width: '100%',
    height: '100%',
  },
  parallaxContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  parallaxGreeting: {
    fontSize: 16,
    marginBottom: 4,
  },
  parallaxName: {
    fontSize: 28,
    letterSpacing: -0.5,
  },

  root: { flex: 1, position: 'relative' },
  scroll: { paddingHorizontal: 0 },

  headerBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerBadge: { position: 'absolute', top: -2, right: -2, minWidth: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  headerBadgeText: { fontSize: 10, fontWeight: '800' },
  
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 24,
    marginTop: 8,
  },
  profileHeaderLeft: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 16,
  },
  profileHeaderRight: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileGreeting: {
    fontSize: 14,
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  profileLeftName: {
    fontSize: 26,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  profileColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
  },
  largeAvatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeAvatarImage: {
    width: '100%',
    height: '100%',
  },
  largeAvatarInitial: {
    fontSize: 24,
    fontWeight: '700',
  },

  pullContainer: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  pullContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    height: 80,
    width: '100%',
  },
  illustrationWrapper: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 16,
  },
  ambientGlow: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  orbitRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitNode: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  centerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  pullTextWrap: {
    flexDirection: 'column',
    justifyContent: 'center',
    flex: 1,
  },
  pullStatusText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  pullSubstatusText: {
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.1,
  },

  updatesBannerWrap: { paddingHorizontal: 20, marginBottom: 8 },
  updatesBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, padding: 14 },
  updatesBannerText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  section: { marginTop: 36 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 22, letterSpacing: -0.3, lineHeight: 28 },
  seeAll: { fontSize: 14, letterSpacing: 0.1 },
  listContent: { paddingHorizontal: 20, gap: 14 },

  appCard: { width: 156, borderRadius: 24, overflow: 'hidden', borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
  appCardIconArea: { alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  appCardBody: { padding: 13, paddingTop: 8 },
  appCardName: { fontSize: 16, fontWeight: '700', marginBottom: 2, lineHeight: 20 },
  appCardDev: { fontSize: 12, marginBottom: 12, lineHeight: 16 },
  appCardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appCardBtnWrap: { padding: 12, paddingTop: 6, alignItems: 'center' },

  basketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    width: '100%',
    marginBottom: 8,
  },
  basketBtnText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },

  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11 },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 12 },

  alphabetHeader: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 8,
    opacity: 0.95,
  },
  alphabetHeaderText: {
    fontSize: 18,
    fontWeight: '800',
  },

  chipsContainer: {
    marginBottom: 16,
  },
  chipsScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    letterSpacing: 0.1,
  },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12, marginTop: 60 },
  emptyIconCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 22, letterSpacing: -0.3 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  syncBtn: { paddingHorizontal: 22, paddingVertical: 13, borderRadius: 24, marginTop: 8 },
  syncBtnText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },
  footerLoader: { paddingVertical: 20, alignItems: 'center', gap: 8 },
  footerLoaderText: { fontSize: 13, fontWeight: '500' },
});
