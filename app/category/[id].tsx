import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
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
import { BrowseAppCardSkeleton } from '@/components/Skeleton';
import { ThemedText } from '@/components/ThemedText';
import { useCatalog } from '@/contexts/CatalogContext';
import { useBasket } from '@/hooks/useBasket';
import { App } from '@/lib/types';
import { sqliteService } from '@/lib/services/SQLiteService';

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
      return list.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0) || a.name.localeCompare(b.name));
    case 'recent':
      return list.sort((a, b) => b.lastUpdated - a.lastUpdated);
    case 'az':
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case 'rating':
      return list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    default:
      return list;
  }
}

import { EmptyState as GlobalEmptyState } from '@/components/EmptyState';

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onReturn }: { onReturn: () => void }) {
  return (
    <GlobalEmptyState
      type="category"
      onPrimaryPress={onReturn}
      primaryLabel="Return to Categories"
    />
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────────

export default function CategoryDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOption>('popular');

  const { categories, syncState, syncRepositories } = useCatalog();
  const { add } = useBasket();
  const category = useMemo(() => categories.find((c) => c.id === id) ?? categories[0], [categories, id]);

  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    if (!category?.id) return;

    setLoading(true);
    sqliteService.getApps({
      categoryId: category.id,
      query: query || undefined,
      limit: 100,
    }).then((res) => {
      const sorted = sortApps(res, sort);
      if (isCurrent) {
        setApps(sorted);
        setLoading(false);
      }
    }).catch((err) => {
      console.error('[CategoryDetailsScreen] Error loading from SQLite:', err);
      if (isCurrent) setLoading(false);
    });

    return () => { isCurrent = false; };
  }, [category?.id, query, sort]);

  const topPad = 0;
  const bottomPad = Platform.OS === 'web' ? 34 + 40 : insets.bottom + 24;

  const openDetails = (appId: string) => router.push({ pathname: '/app-details/[id]', params: { id: appId } });
  const goBack = () => router.back();
  const handleAddToBasket = async (app: App) => {
    await add(app);
  };

  if (!category) return null;

  const renderHeader = useCallback(() => (
    <>
      {/* ── Header ── */}
      <Animated.View
        entering={FadeIn.duration(520).easing(Easing.out(Easing.cubic))}
        style={styles.hero}
      >
        <LinearGradient
          colors={[category.color || colors.primary, `${category.color || colors.primary}CC`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroCard, { borderColor: colors.border }]}
        >
          <View style={styles.heroIconWrap}>
            <MaterialCommunityIcons name={(category.icon as any) || 'folder-outline'} size={40} color="#fff" />
          </View>
          <ThemedText style={styles.heroName}>{category.name}</ThemedText>
          <ThemedText style={styles.heroCount}>{category.appCount} apps</ThemedText>
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
            placeholder={`Search ${category.name.toLowerCase()} apps...`}
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
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
        </ScrollView>
      </Animated.View>

      {apps.length > 0 && (
        <Animated.View
          entering={FadeIn.delay(220).duration(520).easing(Easing.out(Easing.cubic))}
          style={styles.listWrap}
        >
          <ThemedText style={[styles.listTitle, { color: colors.foreground }]}>
            {apps.length} {apps.length === 1 ? 'app' : 'apps'}
          </ThemedText>
        </Animated.View>
      )}
    </>
  ), [category, colors, query, sort, apps.length]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: category.name }} />
      <StatusBar translucent backgroundColor="transparent" barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

      <FlatList
        data={apps}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad, paddingTop: topPad }]}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={loading ? <View style={{ gap: 12 }}><BrowseAppCardSkeleton /><BrowseAppCardSkeleton /><BrowseAppCardSkeleton /></View> : <EmptyState onReturn={goBack} />}
        refreshControl={
          <RefreshControl
            refreshing={syncState === 'syncing'}
            onRefresh={syncRepositories}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item, index }) => (
          <CategoryAppCard
            app={item}
            index={index}
            onPress={openDetails}
            onLongPress={handleAddToBasket}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },

  topBar: { paddingHorizontal: 20, paddingBottom: 4 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  heroDesc: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.84)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
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
