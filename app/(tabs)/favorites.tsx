import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { useColors } from '@/hooks/useColors';
import { useBasket } from '@/hooks/useBasket';
import { useDownloads } from '@/hooks/useDownloads';
import { App } from '@/lib/types';
import { shareApp, shareBasket } from '@/lib/share';

import { CategoryAppCard } from '@/components/categories/CategoryAppCard';
import { ActionRow } from '@/components/settings/SettingsPrimitives';
import { EmptyState } from '@/components/EmptyState';
import TabAnimationWrapper from '@/components/TabAnimationWrapper';

export default function FavoritesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const basket = useBasket();
  const { startBatch, getBatchProgress } = useDownloads();

  const { width: windowWidth } = useWindowDimensions();
  const isRailMode = windowWidth >= 600;
  const bottomPad = isRailMode 
    ? (insets.bottom + 16) 
    : (insets.bottom + (Platform.OS === 'web' ? 88 : 88));
  const { appsById } = require('@/contexts/CatalogContext').useCatalog();
  const items = useMemo(() => {
    return Object.values(basket.items).map(i => appsById.get(i.appId)).filter(Boolean) as App[];
  }, [basket.items, appsById]);

  const handleDownloadAll = useCallback(() => {
  }, [items, startBatch]);

  const handleClearBasket = useCallback(() => {
    basket.clear();
  }, [basket]);

  const renderItem = useCallback(({ item }: { item: App }) => {
    return (
      <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
        <CategoryAppCard index={0}
          app={item}
          onPress={() => router.push(`/app-details/${encodeURIComponent(item.id)}`)}
        />
      </View>
    );
  }, [router]);

  return (
    <TabAnimationWrapper>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <StatusBar style="auto" />
        <View style={[styles.header, { backgroundColor: colors.surfaceContainer, paddingTop: insets.top + 20 }]}>
          <ThemedText style={[styles.title, { color: colors.foreground }]}>Basket</ThemedText>
          <View style={styles.statsRow}>
            <ThemedText style={{ color: colors.mutedForeground }}>
              {items.length} {items.length === 1 ? 'favourite app' : 'favourite apps'}
            </ThemedText>
          </View>
        </View>
        
        {items.length > 0 && (
          <View style={[styles.actionBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ActionRow
              icon="download-multiple"
              title="Download All"
              subtitle="Install all apps in your basket"
              onPress={handleDownloadAll}
            />
            <ActionRow
              icon="share-variant-outline"
              title="Share Basket"
              onPress={() => shareBasket(items)}
            />
            <ActionRow
              icon="delete-sweep-outline"
              title="Clear Basket"
              onPress={handleClearBasket}
            />
          </View>
        )}

        <View style={{ flex: 1 }}>
          {items.length === 0 ? (
            <EmptyState
              type="basket"
              onPrimaryPress={() => router.push('/')}
            />
          ) : (
            <FlashList<App>
              {...({ estimatedItemSize: 120 } as any)}
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              
              contentContainerStyle={{ paddingBottom: bottomPad, paddingTop: 16 }}
            />
          )}
        </View>
      </View>
    </TabAnimationWrapper>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  actionBar: { marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  emptySub: { fontSize: 15, textAlign: 'center' },
  illustration: { width: 140, height: 140, borderRadius: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 24, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
});
