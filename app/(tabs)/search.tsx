import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import {
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  
  useWindowDimensions,
} from 'react-native';
import { materialCardEnter } from "../../components/animations";
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp, FadeOut, useAnimatedStyle, useSharedValue, withSpring, withSequence, withTiming, LinearTransition } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { EmptyState } from '@/components/EmptyState';
import { useRouter } from 'expo-router';
import { useCatalog } from '@/contexts/CatalogContext';
import { sqliteService } from '@/lib/services/SQLiteService';
import { useColors } from '@/hooks/useColors';
import { useBasket } from '@/hooks/useBasket';
import { useTypography } from '@/hooks/useTypography';
import { App } from '@/lib/types';
import { ThemedText } from '@/components/ThemedText';
import { SheenIcon } from '@/components/SheenIcon';
import { ResultRowSkeleton } from '@/components/Skeleton';
import TabAnimationWrapper from '@/components/TabAnimationWrapper';
import { AppDownloadButton } from '@/components/downloads/AppDownloadButton';
import { AppIconWithRing } from '@/components/downloads/AppIconWithRing';
import { DownloadableApp, useAppDownload, useDownloads, formatBytes } from '@/hooks/useDownloads';
import { Audio } from 'expo-av';
import { PremiumPullToRefresh } from '@/components/PremiumPullToRefresh';
import { cleanHtml } from '@/lib/html';


type FilterId = 'all' | 'recently_updated' | 'small_apk' | 'games' | 'tools' | 'fdroid' | 'izzyondroid' | 'github';
type AppSource = App['source'];

const RECENT_KEY = 'sheen:recent_searches';
const MAX_RECENT = 6;

const FILTERS: { id: FilterId; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'recently_updated', label: 'Recently Updated', icon: 'clock-outline' },
  { id: 'small_apk', label: 'Small (< 10MB)', icon: 'download-circle-outline' },
  { id: 'games', label: 'Games', icon: 'gamepad-variant-outline' },
  { id: 'tools', label: 'Tools', icon: 'tools' },
  { id: 'fdroid', label: 'F-Droid', icon: 'android' },
  { id: 'izzyondroid', label: 'IzzyOnDroid', icon: 'tune' },
  { id: 'github', label: 'GitHub', icon: 'github' },
];

const POPULAR_SEARCHES = ['Signal', 'Bitwarden', 'Maps', 'Podcast', 'Browser', 'Notes', 'Gallery', 'Password', 'Download', 'Email', 'Flashcards', 'Chess'];

const SOURCE_CONFIG: Record<AppSource, { color: string; bg: string; darkBg: string }> = {
  'F-Droid': { color: '#1B5E20', bg: '#E8F5E9', darkBg: 'rgba(27,94,32,0.35)' },
  GitHub: { color: '#1565C0', bg: '#E3F2FD', darkBg: 'rgba(21,101,192,0.35)' },
  IzzyOnDroid: { color: '#BF360C', bg: '#FBE9E7', darkBg: 'rgba(191,54,12,0.35)' },
  Other: { color: '#455A64', bg: '#ECEFF1', darkBg: 'rgba(69,90,100,0.35)' },
};

function stopPropagation(handler?: () => void) {
  return (e?: any) => { e?.stopPropagation?.(); handler?.(); };
}

function AnimatedPressable({ children, onPress, style, disabled }: { children: React.ReactNode; onPress?: () => void; style?: any; disabled?: boolean; }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable onPress={onPress} disabled={disabled} onPressIn={() => { scale.value = withSpring(0.96, { damping: 18, stiffness: 260, mass: 0.4 }); }} onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 200, mass: 0.4 }); }}>
      <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>
    </Pressable>
  );
}

function AppIconBubble({ letter, color, size = 48 }: { letter: string; color: string; size?: number }) {
  return <View style={[styles.iconBubble, { width: size, height: size, borderRadius: size * 0.24, backgroundColor: color }]}><ThemedText style={[styles.iconLetter, { fontSize: size * 0.4 }]}>{letter}</ThemedText></View>;
}

function StarRating({ rating, colors }: { rating: number; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.starRow}><MaterialCommunityIcons name="star" size={12} color="#F59E0B" /><ThemedText style={[styles.ratingText, { color: colors.mutedForeground }]}>{rating.toFixed(1)}</ThemedText></View>;
}

function SourceBadge({ source }: { source: AppSource }) {
  const cfg = SOURCE_CONFIG[source];
  return <View style={[styles.sourceBadge, { backgroundColor: cfg.bg }]}><ThemedText style={[styles.sourceBadgeText, { color: cfg.color }]}>{source}</ThemedText></View>;
}

function CategoryBadge({ label, colors }: { label: string; colors: ReturnType<typeof useColors> }) {
  return <View style={[styles.categoryBadge, { backgroundColor: colors.secondaryContainer }]}><ThemedText style={[styles.categoryBadgeText, { color: colors.onSecondaryContainer }]}>{label}</ThemedText></View>;
}

function FilterChip({ item, active, onPress, colors }: { item: (typeof FILTERS)[number]; active: boolean; onPress: () => void; colors: ReturnType<typeof useColors>; }) {
  return (
    <AnimatedPressable onPress={onPress}>
      <Animated.View layout={LinearTransition.springify().damping(22).stiffness(150)} style={[styles.filterChip, active ? { backgroundColor: colors.primary, borderColor: colors.primary, borderWidth: 1 } : { backgroundColor: colors.surfaceContainer, borderColor: colors.border, borderWidth: 1 }]}>
        <MaterialCommunityIcons name={item.icon} size={15} color={active ? colors.onPrimary : colors.onSurfaceVariant} />
        <ThemedText style={[styles.filterChipLabel, { color: active ? colors.onPrimary : colors.onSurfaceVariant }]}>{item.label}</ThemedText>
      </Animated.View>
    </AnimatedPressable>
  );
}

function toDownloadableApp(app: App): DownloadableApp {
  return {
    appId: app.id,
    name: app.name,
    developer: app.developer,
    letter: app.letter ?? app.name.charAt(0).toUpperCase(),
    color: app.color ?? '#000',
    version: app.currentVersion?.versionName ?? '1.0.0',
    sizeBytes: app.currentVersion?.sizeBytes,
    apkUrl: app.currentVersion?.apkUrl,
    repositoryId: app.repositoryId,
    iconUrl: app.iconUrl,
  };
}


function HighlightedText({ text, query, style, highlightStyle, numberOfLines }: { text: string; query: string; style: any; highlightStyle: any; numberOfLines?: number; }) {
  if (!query) return <ThemedText style={style} numberOfLines={numberOfLines}>{text}</ThemedText>;
  
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <ThemedText style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() 
          ? <ThemedText key={i} style={[style, highlightStyle]}>{part}</ThemedText>
          : part
      )}
    </ThemedText>
  );
}

function VoiceSearchDialog({ visible, onClose, colors, fonts }: { visible: boolean; onClose: () => void; colors: any; fonts: any; }) {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.5);

  useEffect(() => {
    if (visible) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.5, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      pulseScale.value = 1;
      pulseOpacity.value = 0.5;
    }
  }, [visible]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={[styles.dialogOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]} onPress={onClose}>
        <Animated.View entering={FadeInUp.duration(300).springify().damping(22)} style={[styles.dialogCard, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center', paddingVertical: 40 }]}>
          <View style={{ position: 'relative', width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <Animated.View style={[pulseStyle, { position: 'absolute', width: '100%', height: '100%', borderRadius: 48, backgroundColor: colors.primary }]} />
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="microphone" size={32} color={colors.onPrimary} />
            </View>
          </View>
          <ThemedText style={[styles.dialogTitle, { color: colors.foreground, fontFamily: fonts.bold }]}>Listening...</ThemedText>
          <ThemedText style={[styles.dialogBody, { color: colors.mutedForeground, fontFamily: fonts.regular, textAlign: 'center', marginTop: 8 }]}>
            {Platform.OS === 'web' && typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) ? 'Speak now to search apps.' : 'Simulating voice search...'}
          </ThemedText>
          <Pressable onPress={onClose} style={[styles.dialogButton, { backgroundColor: colors.surfaceContainerHigh, marginTop: 24 }]}>
            <ThemedText style={[styles.dialogButtonText, { color: colors.onSurface, fontFamily: fonts.medium }]}>Cancel</ThemedText>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
function ResultCard({ app, index, favorited, onToggleFavorite, onPress, colors, query = "" }: { app: App; index: number; favorited: boolean; onToggleFavorite: () => void; onPress?: () => void; colors: ReturnType<typeof useColors>; query?: string; }) {
  const { startDownload } = useDownloads();
  const download = useAppDownload(app.id);
  const sizeText = app.currentVersion?.sizeBytes ? formatBytes(app.currentVersion.sizeBytes) : 'Unknown size';
  const versionText = app.currentVersion?.versionName || '1.0.0';

  return (
    <Animated.View entering={materialCardEnter(index, 0, 40)}>
      <AnimatedPressable onPress={onPress} style={[styles.resultCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.border, borderWidth: 1 }]}>
        <View style={styles.resultTopRow}>
          <AppIconWithRing 
            app={app}
            letter={app.letter ?? app.name.charAt(0).toUpperCase()} 
            color={app.color ?? '#4F46E5'} 
            size={52} 
            download={download} 
            iconUrl={app.iconUrl} 
          />
          <View style={styles.resultBody}>
            <HighlightedText text={app.name} query={query} style={[styles.resultName, { color: colors.foreground }]} highlightStyle={{ color: colors.primary, backgroundColor: `${colors.primary}33` }} numberOfLines={1} />
            <ThemedText style={[{ fontSize: 13, color: colors.foreground, marginTop: 4 }]} numberOfLines={3}>{cleanHtml(app.shortDescription || app.description)}</ThemedText>
            <ThemedText style={[styles.resultDev, { color: colors.mutedForeground, marginTop: 6, fontSize: 11, fontWeight: '500' }]} numberOfLines={1}>{app.developer} • {app.source} • v{versionText}</ThemedText>
          </View>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
            <CategoryBadge label={app.category ?? 'App'} colors={colors} />
            <StarRating rating={app.rating ?? 0} colors={colors} />
            <ThemedText style={{ fontSize: 11, color: colors.mutedForeground }}>{sizeText}</ThemedText>
          </View>
          <View style={{ width: 110 }}>
            <AppDownloadButton
              appId={app.id}
              onStartDownload={() => startDownload(toDownloadableApp(app))}
            />
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

function DiscoverRow({ app, index, colors, onPress }: { app: App; index: number; colors: ReturnType<typeof useColors>; onPress?: () => void; }) {
  return (
    <Animated.View entering={materialCardEnter(index, 160, 40)}>
      <AnimatedPressable style={styles.discoverRow} onPress={onPress}>
        <AppIconBubble letter={app.letter ?? app.name.charAt(0).toUpperCase()} color={app.color ?? '#4F46E5'} size={44} />
        <View style={styles.discoverBody}>
          <ThemedText style={[styles.discoverName, { color: colors.foreground }]} numberOfLines={1}>{app.name}</ThemedText>
          <ThemedText style={[{ fontSize: 12, color: colors.foreground, marginTop: 4 }]} numberOfLines={3}>{cleanHtml(app.shortDescription || app.description)}</ThemedText>
          <ThemedText style={[styles.discoverDev, { color: colors.mutedForeground, marginTop: 6, fontSize: 11, fontWeight: '500' }]} numberOfLines={1}>{app.developer} • {app.source} • v{app.currentVersion?.versionName || '1.0.0'}</ThemedText>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

function PopularChip({ label, onPress, colors, index }: { label: string; onPress: () => void; colors: ReturnType<typeof useColors>; index: number; }) {
  return (
    <Animated.View entering={FadeInUp.delay(index * 40).springify().damping(22).stiffness(150)}>
      <AnimatedPressable onPress={onPress}>
        <View style={[styles.popularChip, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="fire" size={16} color={colors.primary} />
          <ThemedText style={[styles.popularChipText, { color: colors.foreground, fontWeight: '500' }]}>{label}</ThemedText>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

function RecentRow({ term, onPress, onRemove, index, colors }: { term: string; onPress: () => void; onRemove: () => void; index: number; colors: ReturnType<typeof useColors>; }) {
  return (
    <Animated.View entering={FadeInUp.delay(index * 40).duration(360).springify().damping(24).stiffness(180)}>
      <AnimatedPressable style={[styles.recentRow, { backgroundColor: 'transparent', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 0, paddingHorizontal: 20, marginHorizontal: 0 }]} onPress={onPress}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="history" size={16} color={colors.mutedForeground} />
        </View>
        <ThemedText style={[styles.recentText, { color: colors.foreground, fontWeight: '500' }]} numberOfLines={1}>{term}</ThemedText>
        <Pressable onPress={stopPropagation(onRemove)} hitSlop={12} style={styles.recentRemoveBtn}>
          <MaterialCommunityIcons name="close" size={18} color={colors.mutedForeground} />
        </Pressable>
      </AnimatedPressable>
    </Animated.View>
  );
}

function NoResultsState({ query, colors, onClear }: { query: string; colors: ReturnType<typeof useColors>; onClear: () => void; }) {
  const router = useRouter();
  return (
    <Animated.View entering={FadeInUp.duration(400).springify().damping(22).stiffness(150)} style={[styles.emptyWrap, { flex: 1, paddingBottom: 100 }]}>
      <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceContainerHighest, marginBottom: 24, width: 110, height: 110, borderRadius: 55 }]}>
        <MaterialCommunityIcons name="magnify-close" size={48} color={colors.primary} />
      </View>
      <ThemedText style={[styles.emptyTitle, { color: colors.foreground, fontSize: 24, fontWeight: '700', marginBottom: 12, textAlign: 'center' }]}>No results found</ThemedText>
      <ThemedText style={[styles.emptySub, { color: colors.mutedForeground, fontSize: 15, marginBottom: 32, paddingHorizontal: 20 }]}>
        We couldn't find anything for "{query}". Check the spelling or try a different search term.
      </ThemedText>
      <AnimatedPressable onPress={onClear}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, backgroundColor: colors.primary, borderRadius: 20 }}>
          <MaterialCommunityIcons name="backspace-outline" size={20} color={colors.onPrimary} />
          <ThemedText style={{ color: colors.onPrimary, fontSize: 15, fontWeight: '600' }}>Clear Search</ThemedText>
        </View>
      </AnimatedPressable>
      <AnimatedPressable onPress={() => router.push('/categories')} style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, backgroundColor: 'transparent' }}>
          <ThemedText style={{ color: colors.primary, fontSize: 15, fontWeight: '600' }}>Browse Categories</ThemedText>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

function PreSearchState({ scrollProps, colors, recentSearches, onSelectSearch, onRemoveRecent, onClearAllRecent, onPressDiscover, bottomPad, discoverApps }: { scrollProps?: any; colors: ReturnType<typeof useColors>; recentSearches: string[]; onSelectSearch: (term: string) => void; onRemoveRecent: (term: string) => void; onClearAllRecent: () => void; onPressDiscover: () => void; bottomPad: number; discoverApps: App[]; }) {
  return <Animated.View entering={FadeIn.springify().damping(22).stiffness(150)} exiting={FadeOut.duration(160).easing(Easing.in(Easing.cubic))} style={{ flex: 1 }}><ScrollView {...scrollProps} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.preSearchScroll, { paddingBottom: bottomPad }]}>{recentSearches.length > 0 && <View style={styles.section}><View style={styles.sectionHeader}><ThemedText style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Searches</ThemedText><AnimatedPressable onPress={onClearAllRecent}><ThemedText style={[styles.sectionAction, { color: colors.primary }]}>Clear all</ThemedText></AnimatedPressable></View><View style={{ marginTop: -8 }}>{recentSearches.map((term, i) => <RecentRow key={term} term={term} index={i} colors={colors} onPress={() => onSelectSearch(term)} onRemove={() => onRemoveRecent(term)} />)}</View></View>}<View style={styles.section}><Animated.View entering={FadeInUp.delay(60).duration(460).springify().damping(22).stiffness(140)}><View style={styles.sectionHeader}><ThemedText style={[styles.sectionTitle, { color: colors.foreground }]}>Trending Searches</ThemedText></View></Animated.View><Animated.View entering={FadeInUp.delay(100).duration(460).springify().damping(22).stiffness(140)} style={styles.popularGrid}>{POPULAR_SEARCHES.map((term, idx) => <PopularChip key={term} label={term} index={idx} colors={colors} onPress={() => onSelectSearch(term)} />)}</Animated.View></View><View style={styles.section}><Animated.View entering={FadeInUp.delay(120).duration(460).springify().damping(22).stiffness(140)}><View style={styles.sectionHeader}><ThemedText style={[styles.sectionTitle, { color: colors.foreground }]}>Discover</ThemedText></View></Animated.View>{discoverApps.map((app, i) => <DiscoverRow key={app.id} app={app} index={i} colors={colors} onPress={() => onPressDiscover()} />)}</View></ScrollView></Animated.View>;
}

export default function SearchScreen() {
  const colors = useColors();
  const fonts = useTypography();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { apps, isLoading: catalogLoading, syncRepositories } = useCatalog();
  const { add, remove, isInBasket } = useBasket();
  const inputRef = useRef<TextInput>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await syncRepositories();
    setRefreshing(false);
  };


  const [voiceDialogVisible, setVoiceDialogVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [sortOrder, setSortOrder] = useState<'relevance' | 'name'>('relevance');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const { width: windowWidth } = useWindowDimensions();
  const isRailMode = windowWidth >= 600;
  const topPad = Platform.OS === 'web' ? 4 : 0;
  const bottomPad = isRailMode 
    ? (insets.bottom + 16) 
    : (Platform.OS === 'web' ? 34 + 88 : insets.bottom + 76);
  useEffect(() => { AsyncStorage.getItem(RECENT_KEY).then((raw) => { if (raw) setRecentSearches(JSON.parse(raw) as string[]); }).catch(() => {}); }, []);
  const persistRecent = useCallback((list: string[]) => { AsyncStorage.setItem(RECENT_KEY, JSON.stringify(list)).catch(() => {}); }, []);
  const saveToRecent = useCallback((term: string) => { const trimmed = term.trim(); if (!trimmed) return; setRecentSearches((prev) => { const next = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, MAX_RECENT); persistRecent(next); return next; }); }, [persistRecent]);
  const removeRecent = useCallback((term: string) => { setRecentSearches((prev) => { const next = prev.filter((s) => s !== term); persistRecent(next); return next; }); }, [persistRecent]);
  const clearAllRecent = useCallback(() => { setRecentSearches([]); AsyncStorage.removeItem(RECENT_KEY).catch(() => {}); }, []);
  const selectSearch = useCallback((term: string) => { setQuery(term); setActiveFilter('all'); saveToRecent(term); inputRef.current?.blur(); }, [saveToRecent]);
  const onSubmitSearch = useCallback(() => { const trimmed = query.trim(); if (trimmed) saveToRecent(trimmed); }, [query, saveToRecent]);
  const openDetails = useCallback((id: string) => router.push({ pathname: '/app-details/[id]', params: { id } }), [router]);
  
  const handleVoiceSearch = useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      
      setVoiceDialogVisible(true);
      
      recognition.start();

      recognition.onresult = (event: any) => {
        const speechResult = event.results[0][0].transcript;
        setQuery(speechResult);
        setVoiceDialogVisible(false);
        saveToRecent(speechResult);
      };

      recognition.onerror = () => {
        setVoiceDialogVisible(false);
      };
      
      recognition.onspeechend = () => {
        recognition.stop();
      };
    } else {
      // Simulate voice search on native
      setVoiceDialogVisible(true);
      setTimeout(() => {
        const mockTerm = POPULAR_SEARCHES[Math.floor(Math.random() * POPULAR_SEARCHES.length)];
        setQuery(mockTerm);
        setVoiceDialogVisible(false);
        saveToRecent(mockTerm);
      }, 2000);
    }
  }, [saveToRecent]);

  const openVoiceDialog = handleVoiceSearch;

  const closeVoiceDialog = useCallback(() => setVoiceDialogVisible(false), []);
  
  const [results, setResults] = useState<App[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }

    let isCurrent = true;
    setSearching(true);

    const delayDebounce = setTimeout(async () => {
      try {
        const searchResults = await sqliteService.getApps({
          query: q,
          categoryId: activeFilter !== 'all' && !['recently_updated', 'small_apk', 'fdroid', 'izzyondroid', 'github'].includes(activeFilter) ? activeFilter : undefined,
          repositoryId: activeFilter === 'fdroid' ? 'fdroid-official' : activeFilter === 'izzyondroid' ? 'izzyondroid' : undefined,
          limit: 100,
        });

        let filtered = searchResults;
        if (activeFilter === 'recently_updated') {
          const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          filtered = filtered.filter(app => app.lastUpdated > weekAgo);
        } else if (activeFilter === 'small_apk') {
          filtered = filtered.filter(app => (app.currentVersion?.sizeBytes || Infinity) < 10 * 1024 * 1024);
        } else if (activeFilter === 'github') {
          filtered = filtered.filter(app => app.source === 'GitHub');
        }

        if (sortOrder === 'name') {
          filtered.sort((a, b) => a.name.localeCompare(b.name));
        }

        if (isCurrent) {
          setResults(filtered);
        }
      } catch (e) {
        console.error('Error querying search results from SQLite:', e);
      } finally {
        if (isCurrent) setSearching(false);
      }
    }, 150);

    return () => {
      isCurrent = false;
      clearTimeout(delayDebounce);
    };
  }, [query, activeFilter, sortOrder]);

  const hasQuery = query.trim().length > 0;
  const suggestions = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    const names = results.map(r => r.name);
    return Array.from(new Set(names)).filter(n => n.toLowerCase().startsWith(q) && n.toLowerCase() !== q).slice(0, 4);
  }, [results, query]);
  const resultLabel = useMemo(() => !hasQuery ? '' : (results.length === 0 ? 'No results' : `${results.length} app${results.length !== 1 ? 's' : ''}`), [hasQuery, results.length]);
  const toggleFavorite = useCallback(async (app: App) => { if (isInBasket(app.id)) await remove(app.id); else await add(app); }, [add, remove, isInBasket]);
  const discoverApps = useMemo(() => apps.slice(0, 6), [apps]);
  return (
    <TabAnimationWrapper>
      <View style={[styles.root, { backgroundColor: 'transparent' }]}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={[styles.headerArea, { paddingTop: topPad }]}>
          <Animated.View entering={FadeInUp.delay(80).duration(500).springify().damping(22).stiffness(130)} style={styles.searchWrap}>
            <View style={[styles.searchBar, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="magnify" size={22} color={colors.mutedForeground} style={styles.searchIcon} />
              <TextInput 
                ref={inputRef} 
                value={query} 
                onChangeText={(text) => { setQuery(text); if (activeFilter !== 'all') setActiveFilter('all'); }} 
                onSubmitEditing={onSubmitSearch} 
                placeholder="Search apps, developers..." 
                placeholderTextColor={colors.mutedForeground} 
                style={[styles.searchInput, { color: colors.foreground }]} 
                autoCorrect={false} 
                autoCapitalize="none" 
                returnKeyType="search" 
                clearButtonMode="never" 
              />
              <View style={styles.searchActions}>
                {hasQuery ? (
                  <AnimatedPressable onPress={() => { setQuery(''); setActiveFilter('all'); }} style={[styles.searchActionBtn, { backgroundColor: colors.secondaryContainer }]}>
                    <MaterialCommunityIcons name="close" size={16} color={colors.onSecondaryContainer} />
                  </AnimatedPressable>
                ) : (
                  <AnimatedPressable onPress={stopPropagation(openVoiceDialog)} style={[styles.searchActionBtn, { backgroundColor: colors.secondaryContainer }]}>
                    <MaterialCommunityIcons name="microphone-outline" size={16} color={colors.onSecondaryContainer} />
                  </AnimatedPressable>
                )}
              </View>
            </View>
          </Animated.View>
          {hasQuery && (
            <Animated.View entering={FadeInDown.springify().damping(18).stiffness(160).mass(0.8)} exiting={FadeOut.duration(180)}>
              {suggestions.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterRow, { paddingBottom: 12 }]}>
                  {suggestions.map((s, idx) => (
                    <Animated.View key={s} entering={FadeInDown.delay(idx * 30).springify().damping(20).stiffness(150)}>
                      <AnimatedPressable onPress={() => { setQuery(s); inputRef.current?.blur(); }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, backgroundColor: colors.surfaceContainerHighest }}>
                          <MaterialCommunityIcons name="magnify" size={14} color={colors.primary} />
                          <ThemedText style={{ fontSize: 13, color: colors.foreground, fontWeight: '500' }}>{s}</ThemedText>
                        </View>
                      </AnimatedPressable>
                    </Animated.View>
                  ))}
                </ScrollView>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {FILTERS.map((f) => <FilterChip key={f.id} item={f} active={activeFilter === f.id} onPress={() => setActiveFilter(f.id)} colors={colors} />)}
              </ScrollView>
              <Animated.View entering={FadeIn.springify().damping(22).stiffness(150)} style={[styles.resultCountRow, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <ThemedText style={[styles.resultCount, { color: colors.mutedForeground }]}>{resultLabel}</ThemedText>
                <Pressable onPress={() => setSortOrder(prev => prev === 'relevance' ? 'name' : 'relevance')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MaterialCommunityIcons name="sort" size={14} color={colors.primary} />
                  <ThemedText style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>Sort: {sortOrder === 'relevance' ? 'Relevance' : 'Name'}</ThemedText>
                </Pressable>
              </Animated.View>
            </Animated.View>
          )}
        </View>

        <PremiumPullToRefresh refreshing={refreshing} onRefresh={handleRefresh}>
          {(scrollProps) => (
            <View style={{ flex: 1 }}>
              {catalogLoading && apps.length === 0 ? (
                <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 10 }}>
                  <ResultRowSkeleton />
                  <ResultRowSkeleton />
                  <ResultRowSkeleton />
                  <ResultRowSkeleton />
                </View>
              ) : !hasQuery ? (
                <PreSearchState
                  scrollProps={scrollProps}
                  colors={colors}
                  recentSearches={recentSearches}
                  onSelectSearch={selectSearch}
                  onRemoveRecent={removeRecent}
                  onClearAllRecent={clearAllRecent}
                  onPressDiscover={() => {}}
                  bottomPad={bottomPad}
                  discoverApps={discoverApps}
                />
              ) : results.length === 0 ? (
                <Animated.View key="empty" entering={FadeIn.springify().damping(22).stiffness(150)} style={{ flex: 1 }}>
                  <NoResultsState query={query.trim()} colors={colors} onClear={() => { setQuery(''); setActiveFilter('all'); }} />
                </Animated.View>
              ) : (
                <Animated.View key="results" entering={FadeIn.springify().damping(22).stiffness(150)} style={{ flex: 1 }}>
                  <FlashList
                    {...scrollProps}
                    data={results}
                    keyExtractor={(item: App) => item.id}
                    contentContainerStyle={{ ...styles.resultList, paddingBottom: bottomPad }}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item, index }: { item: App; index: number }) => (
                      <ResultCard
                        app={item}
                        index={index}
                        favorited={isInBasket(item.id)}
                        onToggleFavorite={() => toggleFavorite(item)}
                        onPress={() => openDetails(item.id)}
                        colors={colors}
                        query={query.trim()}
                      />
                    )}
                    {...({ estimatedItemSize: 92 } as any)}
                  />
                </Animated.View>
              )}
            </View>
          )}
        </PremiumPullToRefresh>

        
        <VoiceSearchDialog visible={voiceDialogVisible} onClose={closeVoiceDialog} colors={colors} fonts={fonts} />

      </View>
    </TabAnimationWrapper>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerArea: { paddingHorizontal: 20, paddingBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  titleIcon: { borderRadius: 7, overflow: 'hidden' },
  screenTitle: { fontSize: 28, letterSpacing: -0.4, lineHeight: 34 },
  searchWrap: { marginBottom: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 30, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 13 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, letterSpacing: 0.1, padding: 0 },
  searchActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchActionBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  filterRow: { gap: 8, paddingBottom: 10 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24 },
  filterChipLabel: { fontSize: 13, letterSpacing: 0.1 },
  resultCountRow: { paddingBottom: 4 },
  resultCount: { fontSize: 12, letterSpacing: 0.2 },
  resultList: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  resultCard: { borderRadius: 24, borderWidth: 1, padding: 14, gap: 12 },
  resultTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  resultBody: { flex: 1, minWidth: 0 },
  resultName: { fontSize: 16, marginBottom: 2, lineHeight: 20, letterSpacing: -0.1 },
  resultDev: { fontSize: 13, lineHeight: 17, marginBottom: 6 },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  favoriteBtn: { padding: 4 },
  iconBubble: { alignItems: 'center', justifyContent: 'center' },
  iconLetter: { fontWeight: '800' },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 12, fontWeight: '700' },
  sourceBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  sourceBadgeText: { fontSize: 10, fontWeight: '700' },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  categoryBadgeText: { fontSize: 10, fontWeight: '700' },
  discoverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginHorizontal: 20, marginBottom: 10, borderRadius: 22, backgroundColor: 'transparent' },
  discoverBody: { flex: 1, minWidth: 0 },
  discoverName: { fontSize: 15, lineHeight: 19, fontWeight: '700' },
  discoverDev: { fontSize: 12, lineHeight: 16 },
  popularChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  popularChipText: { fontSize: 13, letterSpacing: 0.1 },
  popularGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, marginHorizontal: 20, marginBottom: 10, borderRadius: 22, borderWidth: 1 },
  recentText: { flex: 1, fontSize: 14 },
  recentRemoveBtn: { padding: 2 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  emptyIconCircle: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle: { fontSize: 22, marginBottom: 8 },
  emptySub: { textAlign: 'center', lineHeight: 20 },
  clearBtn: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16 },
  clearBtnText: { fontSize: 13, fontWeight: '700' },
  section: { marginTop: 36 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 22, letterSpacing: -0.3, lineHeight: 28 },
  sectionAction: { fontSize: 14, letterSpacing: 0.1 },
  preSearchScroll: { paddingBottom: 24 },
  dialogOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialogCard: { width: '100%', maxWidth: 360, borderRadius: 24, borderWidth: 1, padding: 20, gap: 14 },
  dialogTitle: { fontSize: 20 },
  dialogBody: { fontSize: 14, lineHeight: 20 },
  dialogButton: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  dialogButtonText: { fontSize: 13 },
});