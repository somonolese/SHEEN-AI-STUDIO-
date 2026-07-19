import React from 'react';
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ScrollView,
} from 'react-native';
import Animated, { Easing, FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { CategoryCard } from '@/components/categories/CategoryCard';
import { POPULAR_CATEGORIES } from '@/constants/categories';
import { ThemedText } from '@/components/ThemedText';
import { SheenIcon } from '@/components/SheenIcon';
import { useCatalog } from '@/contexts/CatalogContext';
import { PremiumPullToRefresh } from '@/components/PremiumPullToRefresh';

import TabAnimationWrapper from '@/components/TabAnimationWrapper';
export default function CategoriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const { categories, syncRepositories } = useCatalog();
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await syncRepositories();
    setRefreshing(false);
  };

  const isTablet = width >= 768;
  const cardWidth = isTablet ? '33.333%' : '50%';
  const popular = categories.filter((c) => POPULAR_CATEGORIES.includes(c.id));
  // If popular is empty, let's just pick top 4 by appCount
  const effectivePopular = popular.length > 0 ? popular : categories.slice(0, 4);

  const isRailMode = width >= 600;
  const topPad = Platform.OS === 'web' ? 16 : insets.top + 16;
  const bottomPad = isRailMode 
    ? (insets.bottom + 16) 
    : (Platform.OS === 'web' ? 34 + 88 : insets.bottom + 76);

  const openCategory = (id: string) => router.push(`/category/${id}` as const);

  return (
    <TabAnimationWrapper>
      <View style={[styles.root, { backgroundColor: 'transparent' }]}>
        <StatusBar translucent backgroundColor="transparent" barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

        <PremiumPullToRefresh refreshing={refreshing} onRefresh={handleRefresh}>
          {(scrollProps) => (
            <ScrollView
              {...scrollProps}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.scroll, { paddingTop: topPad, paddingBottom: bottomPad }]}
            >
              {/* ── Popular categories ── */}
              {effectivePopular.length > 0 && (
                <Animated.View
                  entering={FadeInUp.delay(80).duration(520).springify().damping(22).stiffness(140)}
                  style={styles.section}
                >
                  <View style={styles.sectionHeader}>
                    <ThemedText style={[styles.sectionTitle, { color: colors.foreground }]}>Popular</ThemedText>
                  </View>
                  <View style={styles.grid}>
                    {effectivePopular.map((category, index) => (
                      <CategoryCard
                        key={category.id}
                        category={category}
                        index={index}
                        widthPercent={cardWidth}
                        onPress={() => openCategory(category.id)}
                      />
                    ))}
                  </View>
                </Animated.View>
              )}

              {/* ── All categories ── */}
              <Animated.View
                entering={FadeInUp.delay(140).duration(520).springify().damping(22).stiffness(140)}
                style={styles.section}
              >
                <View style={styles.sectionHeader}>
                  <ThemedText style={[styles.sectionTitle, { color: colors.foreground }]}>All Categories</ThemedText>
                  <ThemedText style={[styles.count, { color: colors.mutedForeground }]}>
                    {categories.length} total
                  </ThemedText>
                </View>

                <View style={styles.grid}>
                  {categories.map((category, index) => (
                    <CategoryCard
                      key={category.id}
                      category={category}
                      index={index}
                      widthPercent={cardWidth}
                      onPress={() => openCategory(category.id)}
                    />
                  ))}
                </View>
              </Animated.View>
            </ScrollView>
          )}
        </PremiumPullToRefresh>
      </View>
    </TabAnimationWrapper>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 12 },

  header: {
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleIcon: {
    borderRadius: 7,
    overflow: 'hidden',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 4,
    lineHeight: 22,
    letterSpacing: 0.1,
  },

  section: { marginBottom: 32 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  count: { fontSize: 13, fontWeight: '500' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
