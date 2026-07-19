import React, { useMemo, useState, useCallback } from 'react';
import {
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
  ScrollView,
} from 'react-native';
import Animated, { Easing, FadeIn, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { AnimatedPressable } from '@/components/settings/SettingsPrimitives';
import { CategoryAppCard } from '@/components/categories/CategoryAppCard';
import { ThemedText } from '@/components/ThemedText';
import { useCatalog } from '@/contexts/CatalogContext';
import { App } from '@/lib/types';
import { PremiumPullToRefresh } from '@/components/PremiumPullToRefresh';

// ─── Sort options ───────────────────────────────────────────────────────────────

type SortOption = 'popular' | 'recent' | 'az' | 'rating';

const SORTS: { id: SortOption; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { id: 'popular', label: 'Most Popular', icon: 'fire' },
  { id: 'recent', label: 'Recently Updated', icon: 'clock-outline' },
  { id: 'az', label: 'A–Z', icon: 'sort-alphabetical-ascending' },
  { id: 'rating', label: 'Highest Rated', icon: 'star-outline' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function sortApps(apps: App[], sort: SortOption) {
  const list = [...apps];
  switch (sort) {
    case 'popular':
      return list.sort((a, b) => {
        const aDownloads = a.downloads ?? 0;
        const bDownloads = b.downloads ?? 0;
        if (aDownloads !== bDownloads) return bDownloads - aDownloads;
        const aRating = a.rating ?? 0;
        const bRating = b.rating ?? 0;
        if (aRating !== bRating) return bRating - aRating;
        return a.name.localeCompare(b.name);
      });
    case 'recent':
      return list.sort((a, b) => {
        const aTime = a.lastUpdated || a.added || 0;
        const bTime = b.lastUpdated || b.added || 0;
        if (aTime !== bTime) return bTime - aTime;
        return a.name.localeCompare(b.name);
      });
    case 'az':
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case 'rating':
      return list.sort((a, b) => {
        const aRating = a.rating ?? 0;
        const bRating = b.rating ?? 0;
        if (aRating !== bRating) return bRating - aRating;
        const aDownloads = a.downloads ?? 0;
        const bDownloads = b.downloads ?? 0;
        if (aDownloads !== bDownloads) return bDownloads - aDownloads;
        return a.name.localeCompare(b.name);
      });
    default:
      return list;
  }
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onReturn }: { onReturn: () => void }) {
  const colors = useColors();
  return (
    <Animated.View
      entering={FadeIn.duration(400).easing(Easing.out(Easing.cubic))}
      style={styles.emptyWrap}
    >
      <View style={[styles.illustration, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
        <View style={styles.illoShelf}>
          <View style={[styles.illoBox, { backgroundColor: colors.primaryContainer }]}>
            <MaterialCommunityIcons name="application-brackets-outline" size={24} color={colors.primary} />
          </View>
          <View style={[styles.illoBox, { backgroundColor: colors.secondaryContainer }]}>
            <MaterialCommunityIcons name="puzzle-outline" size={24} color={colors.onSecondaryContainer} />
          </View>
        </View>
        <View style={[styles.illoSearch, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={26} color={colors.mutedForeground} />
        </View>
      </View>
      <ThemedText style={[styles.emptyTitle, { color: colors.foreground }]}>No apps available</ThemedText>
      <ThemedText style={[styles.emptySub, { color: colors.mutedForeground }]}>
        We could not find any apps here. Try a different search or check back later.
      </ThemedText>
      <AnimatedPressable
        onPress={onReturn}
        style={[styles.returnBtn, { backgroundColor: colors.secondaryContainer }]}
      >
        <MaterialCommunityIcons name="arrow-left" size={16} color={colors.onSecondaryContainer} />
        <ThemedText style={[styles.returnBtnText, { color: colors.onSecondaryContainer }]}>
          Return Home
        </ThemedText>
      </AnimatedPressable>
    </Animated.View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────────

export default function CollectionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // Set default sort based on the collection type
  const [sort, setSort] = useState<SortOption>(
    id === 'newly-launched' || id === 'recommended' ? 'recent' : 'popular'
  );

  const { apps: allApps, syncRepositories } = useCatalog();

  const handleRefresh = async () => {
    setRefreshing(true);
    await syncRepositories();
    setRefreshing(false);
  };

  const collectionInfo = useMemo(() => {
    switch (id) {
      case 'trending':
        return { name: 'Trending', icon: 'fire', color: '#EF4444' };
      case 'newly-launched':
        return { name: 'Newly Launched', icon: 'rocket-launch', color: '#3B82F6' };
      case 'recommended':
        return { name: 'Recommended for You', icon: 'star-face', color: '#8B5CF6' };
      default:
        return { name: 'Apps', icon: 'application', color: colors.primary };
    }
  }, [id, colors]);

  const baseApps = useMemo(() => {
    let sortedApps = [...allApps];
    if (id === 'trending') {
      sortedApps.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));
    } else if (id === 'newly-launched') {
      sortedApps.sort((a, b) => b.added - a.added);
    } else if (id === 'recommended') {
      sortedApps.sort((a, b) => b.lastUpdated - a.lastUpdated);
    }
    return sortedApps;
  }, [allApps, id]);

  const [visibleLimit, setVisibleLimit] = useState(20);

  const loadMore = useCallback(() => {
    setVisibleLimit((prev) => prev + 20);
  }, []);

  const apps = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? baseApps.filter(
          (app) =>
            app.name.toLowerCase().includes(q) ||
            app.developer.toLowerCase().includes(q) ||
            (app.shortDescription && app.shortDescription.toLowerCase().includes(q))
        )
      : baseApps;
    return sortApps(list, sort);
  }, [baseApps, query, sort]);

  const visibleApps = apps.slice(0, visibleLimit);

  const topPad = 0;
  const bottomPad = Platform.OS === 'web' ? 34 + 40 : insets.bottom + 24;

  const openDetails = (appId: string) => router.push({ pathname: '/app-details/[id]', params: { id: appId } });
  const goBack = () => router.back();

  if (!collectionInfo) return null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: collectionInfo.name }} />
      <StatusBar translucent backgroundColor="transparent" barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

      <PremiumPullToRefresh refreshing={refreshing} onRefresh={handleRefresh}>
        {(scrollProps) => (
          <ScrollView
            {...scrollProps}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad, paddingTop: topPad }]}
            onScroll={(e) => {
              scrollProps.onScroll(e);
              const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
              const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 400;
              if (isCloseToBottom && visibleApps.length < apps.length) {
                loadMore();
              }
            }}
            scrollEventThrottle={16}
          >
            {/* ── Header ── */}
            <Animated.View
              entering={FadeIn.duration(520).easing(Easing.out(Easing.cubic))}
              style={styles.hero}
            >
              <LinearGradient
                colors={[collectionInfo.color, `${collectionInfo.color}CC`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.heroCard, { borderColor: colors.border }]}
              >
                <View style={styles.heroIconWrap}>
                  <MaterialCommunityIcons name={collectionInfo.icon as any} size={40} color="#fff" />
                </View>
                <ThemedText style={styles.heroName}>{collectionInfo.name}</ThemedText>
                <ThemedText style={styles.heroCount}>{apps.length} apps</ThemedText>
              </LinearGradient>
            </Animated.View>

            {/* ── Search bar ── */}
            <Animated.View
              entering={FadeInUp.delay(80).duration(520).springify().damping(22).stiffness(140)}
              style={styles.searchWrap}
            >
              <View
                style={[
                  styles.searchBar,
                  { backgroundColor: colors.surfaceContainer, borderColor: colors.border },
                ]}
              >
                <MaterialCommunityIcons name="magnify" size={22} color={colors.mutedForeground} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={`Search ${collectionInfo.name.toLowerCase()}...`}
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.searchInput, { color: colors.foreground }]}
                  returnKeyType="search"
                />
                {query.length > 0 && (
                  <AnimatedPressable onPress={() => setQuery('')} style={styles.clearBtn}>
                    <MaterialCommunityIcons name="close-circle" size={20} color={colors.mutedForeground} />
                  </AnimatedPressable>
                )}
              </View>
            </Animated.View>

            {/* ── Sort options ── */}
            <Animated.View
              entering={FadeInUp.delay(140).duration(520).springify().damping(22).stiffness(140)}
              style={styles.sortWrap}
            >
              <ThemedText style={[styles.sortTitle, { color: colors.foreground }]}>Sort by</ThemedText>
              <View style={styles.sortRow}>
                {SORTS.map((option) => {
                  const active = sort === option.id;
                  return (
                    <AnimatedPressable
                      key={option.id}
                      onPress={() => setSort(option.id)}
                      style={[
                        styles.sortChip,
                        active
                          ? { backgroundColor: colors.secondaryContainer }
                          : { backgroundColor: colors.surfaceContainer, borderColor: colors.border, borderWidth: 1 },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={option.icon}
                        size={14}
                        color={active ? colors.onSecondaryContainer : colors.onSurfaceVariant}
                      />
                      <ThemedText
                        style={[
                          styles.sortChipText,
                          { color: active ? colors.onSecondaryContainer : colors.onSurfaceVariant },
                        ]}
                      >
                        {option.label}
                      </ThemedText>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </Animated.View>

            {/* ── App list ── */}
            {apps.length === 0 ? (
              <EmptyState onReturn={goBack} />
            ) : (
              <Animated.View
                entering={FadeIn.delay(220).duration(520).easing(Easing.out(Easing.cubic))}
                style={styles.listWrap}
              >
                <ThemedText style={[styles.listTitle, { color: colors.foreground }]}>
                  {apps.length} {apps.length === 1 ? 'app' : 'apps'}
                </ThemedText>
                <View>
                  {visibleApps.map((item, index) => (
                    <CategoryAppCard
                      key={item.id}
                      app={item}
                      index={index}
                      onPress={openDetails}
                      onInstall={() => {}}
                    />
                  ))}
                </View>
              </Animated.View>
            )}
          </ScrollView>
        )}
      </PremiumPullToRefresh>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },

  hero: { marginTop: 8, marginBottom: 22 },
  heroCard: {
    borderRadius: 32,
    borderWidth: 1,
    padding: 26,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.4,
    lineHeight: 34,
    marginBottom: 6,
  },
  heroCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  searchWrap: { marginBottom: 18 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    letterSpacing: 0.1,
    paddingVertical: 0,
  },
  clearBtn: { padding: 2 },

  sortWrap: { marginBottom: 20 },
  sortTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 10,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
  },
  sortChipText: { fontSize: 13, fontWeight: '600', letterSpacing: 0.1 },

  listWrap: { marginTop: 4 },
  listTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 14,
  },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  illustration: {
    width: 156,
    height: 156,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  illoShelf: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  illoBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  illoSearch: {
    width: 70,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2, marginBottom: 6 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  returnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
  },
  returnBtnText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },
});
