import React, { useMemo, useState, useEffect } from 'react';
import { Platform, StatusBar, StyleSheet, View, Dimensions, ScrollView, Pressable } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const RNScrollView = ScrollView;
import Animated, { Easing, FadeIn, FadeInUp, FadeInDown, useAnimatedStyle, useSharedValue, withSpring, useAnimatedScrollHandler, interpolate, LinearTransition, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { App, VersionInfo } from '@/lib/types';
import { shareApp } from '@/lib/share';
import { useCatalog } from '@/contexts/CatalogContext';
import { useBasket } from '@/hooks/useBasket';
import { formatBytes, useDownloads } from '@/hooks/useDownloads';
import { useColors, useEffectiveColorScheme } from '@/hooks/useColors';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { ThemedText } from '@/components/ThemedText';
import { AppDownloadButton } from '@/components/downloads/AppDownloadButton';
import { proxyUrl } from '@/lib/services/Network';
import { VersionHistorySheet } from '@/components/updates/VersionHistorySheet';
import { AppIconWithRing } from '@/components/downloads/AppIconWithRing';
import { useAppDownload } from '@/hooks/useDownloads';
import { AppDetailsSkeleton } from '@/components/Skeleton';
import { SourceBadge } from '@/components/SourceBadge';
import { SmartImage } from '@/components/SmartImage';
import { AnimatedBasketButton } from "@/components/AnimatedBasketButton";
import { AnimatedPressable } from '@/components/settings/SettingsPrimitives';
import { signatureVerifierService } from '@/lib/services/SignatureVerifierService';
import { permissionAnalyzerService, PermissionAnalysisResult, AnalyzedPermission, CATEGORY_META } from '@/lib/services/PermissionAnalyzerService';
import { getInstalledApps } from '@/lib/services/UpdateManager';
import { analyzeUpdate } from '@/lib/services/UpdateIntelligence';
import { CategoryBadge, UpdateBadgesList } from '@/components/updates/IntelligenceBadges';
import { ChangelogRenderer } from '@/components/updates/ChangelogRenderer';
import { cleanHtml } from '@/lib/html';

const { width: windowWidth } = Dimensions.get('window');

function AppIconBubble({ letter, color, size = 48 }: { letter: string; color: string; size?: number }) {
  return (
    <View style={[styles.iconBubble, { width: size, height: size, borderRadius: size * 0.24, backgroundColor: color }]}>
      <ThemedText style={[styles.iconLetter, { fontSize: size * 0.4 }]}>{letter}</ThemedText>
    </View>
  );
}

function getFriendlyAndroidVersion(sdkInt?: number): string {
  if (!sdkInt) return 'Android 5.0+';
  const versions: Record<number, string> = {
    19: 'Android 4.4+',
    21: 'Android 5.0+',
    22: 'Android 5.1+',
    23: 'Android 6.0+',
    24: 'Android 7.0+',
    25: 'Android 7.1+',
    26: 'Android 8.0+',
    27: 'Android 8.1+',
    28: 'Android 9.0+',
    29: 'Android 10+',
    30: 'Android 11+',
    31: 'Android 12+',
    32: 'Android 12L+',
    33: 'Android 13+',
    34: 'Android 14+',
    35: 'Android 15+',
  };
  return versions[sdkInt] || `Android API ${sdkInt}+`;
}

function FeatureGraphic({ app, colors, topPad }: { app: App; colors: ReturnType<typeof useColors>; topPad: number }) {
  const accent = app.color ?? colors.primary;
  const firstScreenshot = app.screenshotUrls && app.screenshotUrls.length > 0 ? app.screenshotUrls[0] : null;

  return (
    <View style={[styles.featureGraphicContainer, { backgroundColor: `${accent}15` }]}>
      {firstScreenshot ? (
        <SmartImage
          source={{ uri: proxyUrl(firstScreenshot) }}
          style={styles.featureGraphicImage}
          contentFit="cover"
          cacheType="banner"
          appInfo={{ id: app.id, lastUpdated: app.lastUpdated || 0 }}
        />
      ) : (
        <View style={[styles.featureGraphicPlaceholder, { backgroundColor: `${accent}22` }]}>
          <MaterialCommunityIcons name="application-brackets-outline" size={60} color={`${accent}35`} />
        </View>
      )}
      <View style={styles.featureGraphicOverlay} />
    </View>
  );
}

function StatItem({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.statItem}>
      <MaterialCommunityIcons name={icon as any} size={24} color={colors.primary} style={{ marginBottom: 4 }} />
      <ThemedText style={[styles.statValue, { color: colors.foreground }]}>{value}</ThemedText>
      <ThemedText style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</ThemedText>
    </View>
  );
}

function InfoRow({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.infoRow]}>
      <View style={[styles.infoIconWrap, { backgroundColor: colors.surfaceContainer }]}>
        <MaterialCommunityIcons name={icon as any} size={20} color={colors.primary} />
      </View>
      <View style={styles.infoTextCol}>
        <ThemedText style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</ThemedText>
        <ThemedText style={[styles.infoValue, { color: colors.foreground }]}>{value}</ThemedText>
      </View>
    </View>
  );
}

function ShimmerPlaceholder({ colors, scheme }: { colors: any; scheme: 'light' | 'dark' }) {
  const shimmerVal = useSharedValue(-220);

  React.useEffect(() => {
    shimmerVal.value = withRepeat(
      withTiming(220, { duration: 1200, easing: Easing.bezier(0.4, 0, 0.6, 1) }),
      -1,
      false
    );
  }, [shimmerVal]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerVal.value }],
  }));

  const isDark = scheme === 'dark';
  const gradientColors = isDark 
    ? ['transparent', 'rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.05)', 'transparent']
    : ['transparent', 'rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.35)', 'transparent'];

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceContainer, overflow: 'hidden' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

function ErrorRetryCard({ colors, onRetry }: { colors: any; onRetry: () => void }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.screenshotErrorContainer, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
      <MaterialCommunityIcons name="image-off-outline" size={32} color={colors.mutedForeground} style={{ marginBottom: 8 }} />
      <ThemedText style={[styles.screenshotErrorText, { color: colors.mutedForeground }]}>Unable to load</ThemedText>
      
      <AnimatedPressable 
        onPress={onRetry}
        style={({ pressed }) => [
          styles.screenshotRetryBtn,
          { 
            backgroundColor: colors.primary,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.96 : 1 }]
          }
        ]}
      >
        <MaterialCommunityIcons name="refresh" size={16} color="#fff" style={{ marginRight: 4 }} />
        <ThemedText style={styles.screenshotRetryText}>Retry</ThemedText>
      </AnimatedPressable>
    </View>
  );
}


function CollapsibleSection({ 
  title, 
  icon, 
  colors, 
  defaultExpanded = false, 
  children,
  action
}: { 
  title: string; 
  icon?: any; 
  colors: any; 
  defaultExpanded?: boolean; 
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  return (
    <View style={styles.collapsibleSection}>
      <View style={styles.collapsibleHeader}>
        <Pressable onPress={() => setExpanded(!expanded)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          {icon && <MaterialCommunityIcons name={icon} size={22} color={colors.foreground} style={{ marginRight: 12 }} />}
          <ThemedText style={[styles.sectionTitle, { color: colors.foreground, paddingHorizontal: 0, marginBottom: 0 }]}>{title}</ThemedText>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {action}
          <Pressable onPress={() => setExpanded(!expanded)} hitSlop={12} style={{ marginLeft: action ? 12 : 0 }}>
            <MaterialCommunityIcons 
              name={expanded ? "chevron-up" : "chevron-down"} 
              size={24} 
              color={colors.mutedForeground} 
            />
          </Pressable>
        </View>
      </View>
      
      {expanded && (
        <Animated.View entering={FadeInUp.duration(300).springify()} style={styles.collapsibleContent}>
          {children}
        </Animated.View>
      )}
    </View>
  );
}

function ScreenshotCard({ uri, index, onPress }: { uri: string; index: number; onPress: () => void }) {
  const colors = useColors();
  const scheme = useEffectiveColorScheme();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [retries, setRetries] = useState(0);
  const [cacheKey, setCacheKey] = useState(0);

  const imageOpacity = useSharedValue(0);

  const imageStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
  }));

  const handleLoad = () => {
    setStatus('success');
    imageOpacity.value = withSpring(1, { damping: 18, stiffness: 120 });
  };

  const handleError = () => {
    if (retries < 1) {
      setRetries(prev => prev + 1);
      setCacheKey(prev => prev + 1);
    } else {
      setStatus('error');
    }
  };

  const handleRetryPress = () => {
    setStatus('loading');
    setRetries(0);
    setCacheKey(prev => prev + 1);
    imageOpacity.value = 0;
  };

  return (
    <Animated.View entering={FadeInUp.delay(100 + index * 60).duration(500).springify().damping(22).stiffness(150)}>
      <AnimatedPressable onPress={status === 'success' ? onPress : undefined} disabled={status !== 'success'}>
        {/* @ts-ignore */}
        <Animated.View sharedTransitionTag={`image-${uri}`} style={[styles.screenshot, { backgroundColor: colors.surfaceContainer, overflow: 'hidden', position: 'relative' }]}>
          
          {/* Skeleton placeholder */}
          {status !== 'success' && (
            <ShimmerPlaceholder colors={colors} scheme={scheme} />
          )}

          {/* Real image */}
          {status !== 'error' && (
            <Animated.View style={[StyleSheet.absoluteFill, imageStyle]}>
              <SmartImage 
                key={cacheKey}
                source={{ uri: proxyUrl(uri) }} 
                style={StyleSheet.absoluteFill} 
                contentFit="cover"
                onLoad={handleLoad}
                onError={handleError}
                cacheType="screenshot"
              />
            </Animated.View>
          )}

          {/* Error fallback retry card */}
          {status === 'error' && (
            <ErrorRetryCard colors={colors} onRetry={handleRetryPress} />
          )}

        </Animated.View>
      </AnimatedPressable>
    </Animated.View>
  );
}

function PermissionsCard({
  permissions,
  packageName,
  versionCode,
  colors,
}: {
  permissions: string[];
  packageName: string;
  versionCode: number;
  colors: ReturnType<typeof useColors>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [analysis, setAnalysis] = useState<PermissionAnalysisResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRisk, setSelectedRisk] = useState<'all' | 'high' | 'sensitive' | 'normal'>('all');

  useEffect(() => {
    let active = true;
    async function performAnalysis() {
      if (permissions.length === 0) return;
      try {
        const result = await permissionAnalyzerService.analyzePermissions(
          packageName,
          versionCode,
          permissions
        );
        if (active) {
          setAnalysis(result);
        }
      } catch (e) {
        console.error('[PermissionsCard] Analysis failed:', e);
      }
    }
    performAnalysis();
    return () => {
      active = false;
    };
  }, [permissions, packageName, versionCode]);

  if (permissions.length === 0) return null;

  const totalCount = analysis ? analysis.totalCount : permissions.length;

  const filteredPermissions = useMemo(() => {
    if (!analysis) return [];
    return analysis.allPermissions.filter((p) => {
      const categoryMatch =
        selectedCategory === 'all' ||
        p.category === selectedCategory ||
        analysis.categories.find((c) => c.id === selectedCategory)?.name === p.category;
      const riskMatch = selectedRisk === 'all' || p.riskLevel === selectedRisk;
      return categoryMatch && riskMatch;
    });
  }, [analysis, selectedCategory, selectedRisk]);

  return (
    <View style={styles.collapsibleSection}>
      <AnimatedPressable
        style={styles.collapsibleHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <MaterialCommunityIcons name="shield-lock-outline" size={22} color={colors.foreground} style={{ marginRight: 12 }} />
          <ThemedText style={[styles.sectionTitle, { color: colors.foreground }]}>
            Permissions
          </ThemedText>
          <View style={[styles.totalCountBadge, { backgroundColor: colors.surfaceContainer, marginLeft: 12 }]}>
            <ThemedText style={[styles.totalCountText, { color: colors.primary }]}>
              {totalCount}
            </ThemedText>
          </View>
        </View>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={colors.mutedForeground}
        />
      </AnimatedPressable>

      {!expanded && analysis && (
        <Animated.View entering={FadeInUp.springify().damping(20).stiffness(150)} style={styles.permissionsContainer}>
          <View style={styles.permissionsSummaryPills}>
            {analysis.highRiskCount > 0 && (
              <View style={[styles.permissionsPill, { backgroundColor: '#FDE2E1', borderColor: '#FDE2E1' }]}>
                <ThemedText style={[styles.permissionsPillText, { color: '#B3261E' }]}>
                  🔴 {analysis.highRiskCount} High Risk
                </ThemedText>
              </View>
            )}
            {analysis.sensitiveCount > 0 && (
              <View style={[styles.permissionsPill, { backgroundColor: '#FFF3D6', borderColor: '#FFF3D6' }]}>
                <ThemedText style={[styles.permissionsPillText, { color: '#8A5A00' }]}>
                  🟡 {analysis.sensitiveCount} Sensitive
                </ThemedText>
              </View>
            )}
            {analysis.normalCount > 0 && (
              <View style={[styles.permissionsPill, { backgroundColor: '#E4F5E7', borderColor: '#E4F5E7' }]}>
                <ThemedText style={[styles.permissionsPillText, { color: '#1B5E20' }]}>
                  🟢 {analysis.normalCount} Normal
                </ThemedText>
              </View>
            )}
            {analysis.categories.slice(0, 2).map((cat) => (
              <View key={cat.id} style={[styles.permissionsPill, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
                <MaterialCommunityIcons name={cat.icon as any} size={12} color={colors.mutedForeground} />
                <ThemedText style={[styles.permissionsPillText, { color: colors.mutedForeground }]}>
                  {cat.name}
                </ThemedText>
              </View>
            ))}
            {analysis.categories.length > 2 && (
              <View style={[styles.permissionsPill, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
                <ThemedText style={[styles.permissionsPillText, { color: colors.mutedForeground }]}>
                  +{analysis.categories.length - 2} more
                </ThemedText>
              </View>
            )}
          </View>
        </Animated.View>
      )}

      <Animated.View layout={LinearTransition.springify()}>
        {expanded && analysis && (
          <View style={{ marginTop: 8 }}>
            {analysis.hasRiskWarning && (
              <Animated.View entering={FadeInDown.springify().damping(16).stiffness(150)} style={[styles.warningNoticeCard, { backgroundColor: '#FDE2E1', borderColor: '#FDE2E1' }]}>
                <MaterialCommunityIcons name="shield-alert-outline" size={24} color="#B3261E" />
                <ThemedText style={[styles.warningNoticeText, { color: '#B3261E' }]}>
                  This app requests multiple sensitive permissions. Review them before installing.
                </ThemedText>
              </Animated.View>
            )}

            <View style={{ marginBottom: 12 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
                contentContainerStyle={{ paddingRight: 40 }}
              >
                <Pressable
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selectedCategory === 'all' ? colors.primary : colors.surfaceContainer,
                      borderColor: selectedCategory === 'all' ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedCategory('all')}
                >
                  <ThemedText
                    style={[
                      styles.filterChipText,
                      { color: selectedCategory === 'all' ? '#ffffff' : colors.foreground },
                    ]}
                  >
                    All Categories
                  </ThemedText>
                </Pressable>

                {analysis.categories.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surfaceContainer,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setSelectedCategory(cat.id)}
                    >
                      <MaterialCommunityIcons
                        name={cat.icon as any}
                        size={16}
                        color={isSelected ? '#ffffff' : colors.mutedForeground}
                      />
                      <ThemedText
                        style={[
                          styles.filterChipText,
                          { color: isSelected ? '#ffffff' : colors.foreground },
                        ]}
                      >
                        {cat.name} ({cat.permissions.length})
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.riskFilterBar}>
              <Pressable
                style={[
                  styles.riskChip,
                  {
                    backgroundColor: selectedRisk === 'all' ? colors.primary : colors.surfaceContainer,
                    borderColor: selectedRisk === 'all' ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelectedRisk('all')}
              >
                <ThemedText
                  style={[
                    styles.riskChipText,
                    { color: selectedRisk === 'all' ? '#ffffff' : colors.foreground },
                  ]}
                >
                  All Risks
                </ThemedText>
              </Pressable>

              <Pressable
                style={[
                  styles.riskChip,
                  {
                    backgroundColor: selectedRisk === 'high' ? '#FDE2E1' : colors.surfaceContainer,
                    borderColor: selectedRisk === 'high' ? '#FDE2E1' : colors.border,
                  },
                ]}
                onPress={() => setSelectedRisk('high')}
              >
                <View style={[styles.riskDot, { backgroundColor: '#B3261E' }]} />
                <ThemedText
                  style={[
                    styles.riskChipText,
                    { color: selectedRisk === 'high' ? '#B3261E' : colors.foreground },
                  ]}
                >
                  High Risk ({analysis.highRiskCount})
                </ThemedText>
              </Pressable>

              <Pressable
                style={[
                  styles.riskChip,
                  {
                    backgroundColor: selectedRisk === 'sensitive' ? '#FFF3D6' : colors.surfaceContainer,
                    borderColor: selectedRisk === 'sensitive' ? '#FFF3D6' : colors.border,
                  },
                ]}
                onPress={() => setSelectedRisk('sensitive')}
              >
                <View style={[styles.riskDot, { backgroundColor: '#8A5A00' }]} />
                <ThemedText
                  style={[
                    styles.riskChipText,
                    { color: selectedRisk === 'sensitive' ? '#8A5A00' : colors.foreground },
                  ]}
                >
                  Sensitive ({analysis.sensitiveCount})
                </ThemedText>
              </Pressable>

              <Pressable
                style={[
                  styles.riskChip,
                  {
                    backgroundColor: selectedRisk === 'normal' ? '#E4F5E7' : colors.surfaceContainer,
                    borderColor: selectedRisk === 'normal' ? '#E4F5E7' : colors.border,
                  },
                ]}
                onPress={() => setSelectedRisk('normal')}
              >
                <View style={[styles.riskDot, { backgroundColor: '#1B5E20' }]} />
                <ThemedText
                  style={[
                    styles.riskChipText,
                    { color: selectedRisk === 'normal' ? '#1B5E20' : colors.foreground },
                  ]}
                >
                  Normal ({analysis.normalCount})
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.permissionDetailsList}>
              {filteredPermissions.length === 0 ? (
                <View style={styles.emptyFilteredState}>
                  <ThemedText style={[styles.emptyFilteredText, { color: colors.mutedForeground }]}>
                    No permissions match the selected filters.
                  </ThemedText>
                </View>
              ) : (
                filteredPermissions.map((p, index) => {
                  let badgeBg = '#E4F5E7';
                  let badgeFg = '#1B5E20';
                  let badgeLabel = 'Normal';

                  if (p.riskLevel === 'high') {
                    badgeBg = '#FDE2E1';
                    badgeFg = '#B3261E';
                    badgeLabel = 'High Risk';
                  } else if (p.riskLevel === 'sensitive') {
                    badgeBg = '#FFF3D6';
                    badgeFg = '#8A5A00';
                    badgeLabel = 'Sensitive';
                  }

                  const catId = Object.keys(CATEGORY_META).find((k) => CATEGORY_META[k].name === p.category) || 'other';
                  const catColor = CATEGORY_META[catId]?.color || colors.primary;

                  return (
                    <Animated.View
                      entering={FadeInUp.delay(index * 30).springify().damping(22).stiffness(160)}
                      key={p.key}
                      style={[styles.permissionDetailCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}
                    >
                      <View style={styles.permissionCardHeader}>
                        <View style={styles.permissionIconAndMeta}>
                          <View style={[styles.permissionDetailIconBg, { backgroundColor: `${catColor}15` }]}>
                            <MaterialCommunityIcons name={p.categoryIcon as any} size={20} color={catColor} />
                          </View>
                          <View style={styles.permissionNameAndCategory}>
                            <ThemedText style={[styles.permissionDetailName, { color: colors.foreground }]}>
                              {p.name}
                            </ThemedText>
                            <ThemedText style={[styles.permissionDetailCategory, { color: colors.mutedForeground }]}>
                              {p.category}
                            </ThemedText>
                          </View>
                        </View>

                        <View style={[styles.riskBadge, { backgroundColor: badgeBg }]}>
                          <ThemedText style={[styles.riskBadgeText, { color: badgeFg }]}>
                            {badgeLabel}
                          </ThemedText>
                        </View>
                      </View>

                      <ThemedText style={[styles.permissionDetailDesc, { color: colors.foreground }]}>
                        {cleanHtml(p.description)}
                      </ThemedText>
                    </Animated.View>
                  );
                })
              )}
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

function SimilarCard({ app, index, colors }: { app: App; index: number; colors: ReturnType<typeof useColors> }) {
  const router = useRouter();
  const { startDownload } = useDownloads();

  const handleInstallPress = () => {
    startDownload({
      appId: app.id,
      name: app.name,
      developer: app.developer,
      letter: app.letter ?? app.name[0],
      color: app.color ?? colors.primary,
      version: app.currentVersion.versionName,
      sizeBytes: app.currentVersion.sizeBytes,
      apkUrl: app.currentVersion.apkUrl,
      repositoryId: app.repositoryId,
      iconUrl: app.iconUrl,
    });
  };

  return (
    <Animated.View entering={FadeInUp.delay(index * 60).duration(460).springify().damping(24).stiffness(160)}>
      <View style={[styles.similarCard, { backgroundColor: colors.card, borderColor: colors.border, overflow: 'hidden' }]}>
        <Pressable 
          onPress={() => router.push({ pathname: '/app-details/[id]', params: { id: app.id } })}
          style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
        />
        <View style={{ zIndex: 1 }} pointerEvents="none">
          <AppIconBubble letter={app.letter ?? app.name[0]} color={app.color ?? colors.primary} size={56} />
          <View style={{ flex: 1, gap: 2, marginTop: 14 }}>
            <ThemedText style={[styles.similarName, { color: colors.foreground }]} numberOfLines={1}>{app.name}</ThemedText>
            <ThemedText style={[{ fontSize: 13, color: colors.foreground, marginTop: 4 }]} numberOfLines={3}>{cleanHtml(app.shortDescription || app.description)}</ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <ThemedText style={[styles.similarDesc, { color: colors.mutedForeground, fontSize: 11, fontWeight: '500' }]} numberOfLines={1}>{app.developer} • {app.source} • v{app.currentVersion?.versionName || '1.0.0'}</ThemedText>
            </View>
          </View>
        </View>
        <View style={{ marginTop: 16, zIndex: 2 }}>
          <AppDownloadButton appId={app.id} onStartDownload={handleInstallPress} />
        </View>
      </View>
    </Animated.View>
  );
}

function TrustCard({
  signatureState,
  colors,
}: {
  signatureState: {
    status: 'verified' | 'changed' | 'unverified';
    fingerprint: string;
    source: string;
    lastVerifiedAt?: number;
  } | null;
  colors: any;
}) {
  if (!signatureState) return null;

  const CONFIG = {
    verified: {
      icon: 'shield-check-outline' as const,
      color: colors.primary,
      bg: `${colors.primary}11`,
      title: 'Signature Verified',
      desc: 'The certificate signature matches the installed version and is secure.',
    },
    changed: {
      icon: 'shield-alert-outline' as const,
      color: colors.destructive,
      bg: `${colors.destructive}11`,
      title: 'Certificate Mismatch',
      desc: 'Warning: Stored fingerprint differs from the repository signature. Updates will be blocked.',
    },
    unverified: {
      icon: 'shield-outline' as const,
      color: colors.mutedForeground,
      bg: colors.surfaceContainer,
      title: 'Not yet verified',
      desc: 'No local signature recorded yet. Signature trust will be established upon first installation.',
    },
  };

  const { icon, color, bg, title, desc } = CONFIG[signatureState.status];
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.collapsibleSection}>
      <AnimatedPressable style={styles.collapsibleHeader} onPress={() => setExpanded(!expanded)}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="shield-check-outline" size={22} color={colors.foreground} style={{ marginRight: 12 }} />
          <ThemedText style={[styles.sectionTitle, { color: colors.foreground }]}>Security & Trust</ThemedText>
        </View>
        <MaterialCommunityIcons name={expanded ? "chevron-up" : "chevron-down"} size={24} color={colors.mutedForeground} />
      </AnimatedPressable>
      {expanded && (
        <Animated.View entering={FadeInUp.duration(300).springify()} style={styles.collapsibleContent}>

      <View style={[styles.trustCard, { backgroundColor: bg, borderColor: colors.border }]}>
        <View style={styles.trustCardHeader}>
          <MaterialCommunityIcons name={icon} size={32} color={color} />
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.trustCardTitle, { color: colors.foreground }]}>{title}</ThemedText>
            <ThemedText style={[styles.trustCardDesc, { color: colors.mutedForeground }]}>{desc}</ThemedText>
          </View>
        </View>

        <View style={[styles.dividerFull, { backgroundColor: colors.border, marginVertical: 14 }]} />

        {/* Technical details list */}
        <View style={styles.trustDetails}>
          <View style={styles.trustDetailRow}>
            <ThemedText style={[styles.trustDetailLabel, { color: colors.mutedForeground }]}>Fingerprint</ThemedText>
            <ThemedText 
              style={[styles.trustDetailValue, { color: colors.foreground, backgroundColor: colors.surfaceContainer, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 11, maxWidth: '60%' }]} 
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {signatureState.fingerprint}
            </ThemedText>
          </View>

          <View style={styles.trustDetailRow}>
            <ThemedText style={[styles.trustDetailLabel, { color: colors.mutedForeground }]}>Trusted Source</ThemedText>
            <ThemedText style={[styles.trustDetailValue, { color: colors.foreground }]}>{signatureState.source}</ThemedText>
          </View>

          {signatureState.lastVerifiedAt && (
            <View style={styles.trustDetailRow}>
              <ThemedText style={[styles.trustDetailLabel, { color: colors.mutedForeground }]}>Last Verified</ThemedText>
              <ThemedText style={[styles.trustDetailValue, { color: colors.foreground }]}>
                {new Date(signatureState.lastVerifiedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </ThemedText>
            </View>
          )}
        </View>
      </View>
        </Animated.View>
      )}
    </View>
  );
}

function RelatedAppCard({ app, colors, onPress }: { app: any; colors: any; onPress: () => void }) {
  const download = useAppDownload(app.id);
  return (
    <AnimatedPressable onPress={onPress} style={[styles.similarCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.border, marginRight: 12 }]}>
      <AppIconWithRing
        app={app}
        letter={app.letter ?? app.name.charAt(0)}
        color={app.color ?? colors.primary}
        size={48}
        download={download}
        iconUrl={app.iconUrl}
      />
      <View style={{ marginTop: 12 }}>
        <ThemedText style={[styles.similarName, { color: colors.foreground }]} numberOfLines={1}>{app.name}</ThemedText>
        <ThemedText style={[styles.similarDesc, { color: colors.foreground, marginTop: 4 }]} numberOfLines={3}>
          {app.shortDescription?.replace(/<[^>]*>?/gm, '') || app.description.replace(/<[^>]*>?/gm, '')}
        </ThemedText>
        <ThemedText style={[{ color: colors.mutedForeground, fontSize: 11, fontWeight: '500', marginTop: 6 }]} numberOfLines={1}>
          {app.developer} • {app.source} • v{app.currentVersion?.versionName ?? '1.0.0'}
        </ThemedText>
      </View>
    </AnimatedPressable>
  );
}

export default function AppDetailsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getAppById, getFullAppById, apps, repositories, isLoading: catalogLoading } = useCatalog();
  const { add, remove, isInBasket } = useBasket();
  const { startDownload } = useDownloads();
  const [historyVisible, setHistoryVisible] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; }
  });
  
  const stickyActionStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(scrollY.value, [250, 350], [0, 1], 'clamp'),
      transform: [{ translateY: interpolate(scrollY.value, [250, 350], [50, 0], 'clamp') }],
      pointerEvents: scrollY.value > 300 ? 'auto' : 'none',
    };
  });
  
  const headerStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: `rgba(${colors.background}, ${interpolate(scrollY.value, [0, 50], [0, 0.95], 'clamp')})`,
      borderBottomWidth: interpolate(scrollY.value, [0, 50], [0, 1], 'clamp'),
      borderBottomColor: colors.border,
    };
  });

  const catalogApp = useMemo(() => getAppById(Array.isArray(id) ? id[0] : id), [getAppById, id]);
  const [fullApp, setFullApp] = useState(catalogApp);
  useEffect(() => {
    if (catalogApp) {
      setFullApp(catalogApp); // Show partial first
      getFullAppById(catalogApp.id).then(a => {
        if (a) setFullApp(a);
      });
    }
  }, [catalogApp, getFullAppById]);
  const app = fullApp;
  
  if (catalogLoading && !app) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <AppDetailsSkeleton />
      </View>
    );
  }

  const inBasket = app ? isInBasket(app.id) : false;

  const repo = app ? repositories.find(r => r.id === app.repositoryId) : null;
  const lastSync = 'Recently';

  
  
  const moreByDev = useMemo(
    () => (app ? apps.filter((a) => a.id !== app.id && a.developer === app.developer).slice(0, 10) : []),
    [app, apps]
  );

  const similarApps = useMemo(
    () => (app ? apps.filter((a) => a.id !== app.id && (a.categoryId === app.categoryId || a.source === app.source)).slice(0, 10) : []),
    [app, apps],
  );

  const topPad = insets.top;
  const bottomPad = Platform.OS === 'web' ? 74 : insets.bottom + 24;
  const iconLetter = app?.letter ?? app?.name?.[0] ?? '?';
  const accent = app?.color ?? colors.primary;
  const currentVersion = app?.currentVersion;

  const download = useAppDownload(app?.id ?? '');

  const [installedVersion, setInstalledVersion] = useState<{
    packageName: string;
    versionName: string;
    versionCode: number;
    installedAt: number;
  } | null>(null);

  useEffect(() => {
    async function checkInstalled() {
      if (!app) return;
      try {
        const installed = await getInstalledApps();
        const found = installed.find(a => a.packageName === app.packageName);
        setInstalledVersion(found || null);
      } catch (err) {
        console.error('[AppDetails] Error getting installed apps:', err);
      }
    }
    checkInstalled();
  }, [app, download?.status]);

  const analysis = useMemo(() => {
    if (!app) return null;
    return analyzeUpdate(app, installedVersion?.versionCode, installedVersion?.versionName);
  }, [app, installedVersion]);

  const hasUpdate = useMemo(() => {
    if (!app || !installedVersion) return false;
    return app.currentVersion.versionCode > installedVersion.versionCode;
  }, [app, installedVersion]);

  const [signatureState, setSignatureState] = useState<{
    status: 'verified' | 'changed' | 'unverified';
    fingerprint: string;
    source: string;
    lastVerifiedAt?: number;
  } | null>(null);

  useEffect(() => {
    let active = true;
    async function loadSignature() {
      if (!app) return;
      try {
        const stored = await signatureVerifierService.getInstalledSignature(app.packageName);
        if (!stored) {
          const expectedFingerprint = signatureVerifierService.getFingerprint(app.packageName, app.repositoryId);
          if (active) {
            setSignatureState({
              status: 'unverified',
              fingerprint: expectedFingerprint,
              source: app.source,
            });
          }
        } else {
          const expectedFingerprint = signatureVerifierService.getFingerprint(app.packageName, app.repositoryId);
          const matches = stored.certificateFingerprint === expectedFingerprint;
          if (active) {
            setSignatureState({
              status: matches ? 'verified' : 'changed',
              fingerprint: stored.certificateFingerprint,
              source: stored.repositorySource === app.repositoryId ? app.source : stored.repositorySource,
              lastVerifiedAt: stored.lastVerifiedAt,
            });
          }
        }
      } catch (e) {
        console.error('[AppDetails] Error loading signature:', e);
      }
    }
    loadSignature();
    return () => {
      active = false;
    };
  }, [app, download?.status]);

  if (!app || !currentVersion) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.notFoundWrap}>
          <ThemedText style={[styles.emptyTitle, { color: colors.foreground }]}>App not found</ThemedText>
          <ThemedText style={[styles.emptySub, { color: colors.mutedForeground }]}>
            The app you requested is not available in the catalog.
          </ThemedText>
          <AnimatedPressable onPress={() => router.back()} style={[styles.returnBtn, { backgroundColor: colors.secondaryContainer }]}>
            <MaterialCommunityIcons name="arrow-left" size={16} color={colors.onSecondaryContainer} />
            <ThemedText style={[styles.returnBtnText, { color: colors.onSecondaryContainer }]}>Go Back</ThemedText>
          </AnimatedPressable>
        </View>
      </View>
    );
  }

  const handleInstallPress = () => {
    startDownload({
      appId: app.id,
      name: app.name,
      developer: app.developer,
      letter: app.letter ?? iconLetter,
      color: app.color ?? accent,
      version: currentVersion.versionName,
      sizeBytes: currentVersion.sizeBytes,
      apkUrl: currentVersion.apkUrl,
      repositoryId: app.repositoryId,
      iconUrl: app.iconUrl,
    });
  };


  const versionHistory = app.versions.map((v) => ({
    ...v,
    releaseDate: new Date(v.added).toLocaleDateString(),
  }));

  const formatDownloads = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  const permissions = currentVersion.permissions || ['android.permission.INTERNET'];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* ── Custom Header ── */}
      <Animated.View style={[styles.header, headerStyle, { paddingTop: topPad, height: topPad + 60 }]}>
         <AnimatedPressable onPress={() => router.back()} style={[styles.headerBtn, { backgroundColor: colors.surfaceContainer }]}>
           <MaterialCommunityIcons name="arrow-left" size={24} color={colors.foreground} />
         </AnimatedPressable>
         <View style={{ flexDirection: 'row', gap: 12 }}>
           <AnimatedPressable onPress={() => shareApp(app)} style={[styles.headerBtn, { backgroundColor: colors.surfaceContainer }]}>
             <MaterialCommunityIcons name="share-variant-outline" size={24} color={colors.foreground} />
           </AnimatedPressable>
         </View>
      </Animated.View>

      <Animated.ScrollView 
        onScroll={scrollHandler} 
        scrollEventThrottle={16} 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 80, paddingTop: 0 }]}
      >
        {/* ── Feature Graphic Banner ── */}
        <FeatureGraphic app={app} colors={colors} topPad={topPad} />

        {/* ── Hero Header ── */}
        <Animated.View entering={FadeInDown.delay(100).duration(600).springify()} style={[styles.heroRow, { marginTop: 24, paddingHorizontal: 24 }]}>
          <View style={[styles.heroIconContainer, { shadowColor: accent }]}>
            <AppIconWithRing
              app={app}
              letter={iconLetter}
              color={accent}
              size={100}
              download={download}
              iconUrl={app.iconUrl}
            />
          </View>
          <View style={styles.heroInfo}>
            <ThemedText style={[styles.appName, { color: colors.foreground }]}>{app.name}</ThemedText>
            <ThemedText style={[styles.appDeveloper, { color: colors.primary }]}>{app.developer}</ThemedText>
            <View style={styles.heroMetaRow}>
              <SourceBadge source={app.source} />
              <View style={[styles.categoryBadge, { backgroundColor: colors.surfaceContainer }]}>
                <ThemedText style={[styles.categoryBadgeText, { color: colors.mutedForeground }]}>{app.category ?? 'App'}</ThemedText>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Stats Row ── */}
        <Animated.View entering={FadeInUp.delay(150).duration(600).springify()} style={[styles.statsContainer, { paddingHorizontal: 24, marginTop: 16 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.statsScroll, { paddingHorizontal: 0 }]}>
            <StatItem icon="tag-outline" label="Version" value={currentVersion.versionName} colors={colors} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <StatItem icon="content-save-outline" label="Size" value={formatBytes(currentVersion.sizeBytes ?? 0)} colors={colors} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <StatItem icon="script-text-outline" label="License" value={app.license ? app.license.split('/').pop() || app.license : 'FOSS'} colors={colors} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <StatItem icon="android" label="Min OS" value={getFriendlyAndroidVersion(currentVersion.minSdk)} colors={colors} />
          </ScrollView>
        </Animated.View>

        {/* ── Main Action ── */}
        <Animated.View entering={FadeInUp.delay(200).duration(600).springify()} style={[styles.mainActionWrap, { paddingHorizontal: 24, marginTop: 24 }]}>
          <AppDownloadButton appId={app.id} onStartDownload={handleInstallPress} />
          <AnimatedBasketButton
            inBasket={inBasket}
            onPress={() => inBasket ? remove(app.id) : add(app)}
            style={[styles.basketBtnFull, { marginTop: 12 }]}
            textStyle={styles.basketBtnTextFull}
            colors={colors}
            iconSize={20}
          />
        </Animated.View>

        {/* ── Screenshots (Hero Element) ── */}
        {(app.screenshotUrls ?? []).length > 0 && (
          <Animated.View entering={FadeIn.delay(250).duration(600)} style={{ marginTop: 24 }}>
            <RNScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.screenshotsScroll} snapToInterval={180 + 16} decelerationRate="fast">
              {app.screenshotUrls!.map((uri, index) => <ScreenshotCard key={uri} uri={uri} index={index} onPress={() => router.push(`/gallery/${app.id}?index=${index}`)} />)}
            </RNScrollView>
          </Animated.View>
        )}

        {/* ── Description Section ── */}
        <Animated.View entering={FadeInUp.delay(300).duration(600).springify()} style={{ marginTop: 24, paddingHorizontal: 24 }}>
          <AnimatedPressable onPress={() => setDescExpanded(!descExpanded)}>
            <ThemedText 
              style={[styles.aboutText, { color: colors.mutedForeground, fontSize: 15, lineHeight: 24 }]}
              numberOfLines={descExpanded ? undefined : 4}
            >
              {cleanHtml(app.description)}
            </ThemedText>
            {!descExpanded && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <ThemedText style={[styles.expandText, { color: colors.primary, fontSize: 14, fontWeight: '600' }]}>Read more</ThemedText>
                <MaterialCommunityIcons name="chevron-down" size={18} color={colors.primary} style={{ marginLeft: 2 }} />
              </View>
            )}
          </AnimatedPressable>
        </Animated.View>

        {/* ── Update Information Section ── */}
        {hasUpdate && analysis && installedVersion && (
          <CollapsibleSection title="Update Available" icon="alert-decagram-outline" colors={colors} defaultExpanded>
            <View style={[styles.updateInfoCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.border, marginTop: 0 }]}>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                  <CategoryBadge category={analysis.category} compact />
                  <UpdateBadgesList badges={analysis.badges} compact />
                </View>
                <View style={[styles.updateInfoGrid, { borderColor: colors.border || 'rgba(0,0,0,0.08)' }]}>
                  <View style={styles.updateGridItem}>
                    <ThemedText style={[styles.updateGridLabel, { color: colors.mutedForeground }]}>Installed</ThemedText>
                    <ThemedText style={[styles.updateGridValue, { color: colors.foreground }]}>v{installedVersion.versionName}</ThemedText>
                  </View>
                  <View style={styles.updateGridItem}>
                    <ThemedText style={[styles.updateGridLabel, { color: colors.mutedForeground }]}>Latest</ThemedText>
                    <ThemedText style={[styles.updateGridValue, { color: colors.foreground }]}>v{app.currentVersion.versionName}</ThemedText>
                  </View>
                  <View style={styles.updateGridItem}>
                    <ThemedText style={[styles.updateGridLabel, { color: colors.mutedForeground }]}>Date</ThemedText>
                    <ThemedText style={[styles.updateGridValue, { color: colors.foreground }]}>
                      {new Date(app.currentVersion.added).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </ThemedText>
                  </View>
                  <View style={styles.updateGridItem}>
                    <ThemedText style={[styles.updateGridLabel, { color: colors.mutedForeground }]}>Size</ThemedText>
                    <ThemedText style={[styles.updateGridValue, { color: colors.foreground }]}>
                      {analysis.sizeDiffBytes !== undefined ? (
                        <ThemedText style={{ fontWeight: 'bold', color: analysis.sizeDiffBytes < 0 ? '#1B5E20' : analysis.sizeDiffBytes > 0 ? '#B3261E' : colors.foreground }}>
                          {analysis.sizeDiffBytes > 0 ? `+${formatBytes(analysis.sizeDiffBytes)}` : analysis.sizeDiffBytes < 0 ? `-${formatBytes(Math.abs(analysis.sizeDiffBytes))}` : 'No change'}
                        </ThemedText>
                      ) : '—'}
                    </ThemedText>
                  </View>
                </View>
                
                <ThemedText style={[styles.changelogHeading, { color: colors.foreground }]}>Release Notes</ThemedText>
                <ChangelogRenderer changelog={app.currentVersion.changelog} colors={colors} />
              </View>
            </View>
          </CollapsibleSection>
        )}

        {/* ── What's New Section ── */}
        {!hasUpdate && currentVersion.changelog && (
          <CollapsibleSection title="What's New" icon="history" colors={colors}>
            <View style={[styles.changelogCard, { backgroundColor: colors.surfaceContainer, marginTop: 0 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={[styles.changelogVersion, { color: colors.foreground }]}>Version {currentVersion.versionName}</ThemedText>
                <ThemedText style={[styles.changelogDate, { color: colors.mutedForeground }]}>{new Date(currentVersion.added).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</ThemedText>
              </View>
              <View style={[styles.dividerFull, { backgroundColor: colors.border, marginVertical: 12 }]} />
              <ThemedText style={[styles.changelogText, { color: colors.mutedForeground }]}>{currentVersion.changelog}</ThemedText>
            </View>
          </CollapsibleSection>
        )}

        {/* ── Information Section ── */}
        <CollapsibleSection title="Information" icon="information-outline" colors={colors}>
          <View style={styles.infoList}>
            <InfoRow colors={colors} icon="account-outline" label="Developer" value={app.developer} />
            {app.developer.toLowerCase().includes('github') && <InfoRow colors={colors} icon="github" label="GitHub" value="Available" />}
            <InfoRow colors={colors} icon="package-variant" label="Package" value={app.packageName} />
            <InfoRow colors={colors} icon="source-repository" label="Repository" value={app.source} />
            <InfoRow colors={colors} icon="sync" label="Last Sync" value={lastSync} />
            {app.license && <InfoRow colors={colors} icon="script-text-outline" label="License" value={app.license} />}
            <InfoRow colors={colors} icon="android" label="Target SDK" value={(currentVersion.targetSdk ?? 34).toString()} />
            <InfoRow colors={colors} icon="hammer-outline" label="Build Type" value={app.source === 'F-Droid' || app.source === 'IzzyOnDroid' ? 'Built from source' : 'Official Release'} />
            {currentVersion.signingKeyId && (
              <InfoRow colors={colors} icon="key-outline" label="Signing Key" value={currentVersion.signingKeyId.substring(0, 12).toUpperCase() + '...'} />
            )}
            
            <AnimatedPressable onPress={() => router.push({ pathname: '/timeline/[id]', params: { id: app.id } })} style={[styles.versionLink, { backgroundColor: colors.surfaceContainer, marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={[styles.infoIconWrap, { backgroundColor: colors.background }]}> 
                  <MaterialCommunityIcons name="chart-timeline-variant" size={20} color={accent} />
                </View>
                <ThemedText style={[styles.versionLinkText, { color: colors.foreground }]}>Version History</ThemedText>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.mutedForeground} />
            </AnimatedPressable>
          </View>
        </CollapsibleSection>

        {/* ── App Security & Trust Section ── */}
        <TrustCard signatureState={signatureState} colors={colors} />

        {/* ── Permissions Section ── */}
        <PermissionsCard
          permissions={permissions}
          packageName={app.packageName}
          versionCode={currentVersion.versionCode}
          colors={colors}
        />

        {/* ── Similar Apps ── */}
        {similarApps.length > 0 && (
          <CollapsibleSection title="Similar Apps" icon="apps" colors={colors} defaultExpanded action={
            <AnimatedPressable onPress={() => router.push(`/similar-apps/${app.id}`)}>
              <ThemedText style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>See all</ThemedText>
            </AnimatedPressable>
          }>
            <View style={{ marginLeft: -24 }}>
              <RNScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedScroll}>
                {similarApps.map(a => <RelatedAppCard key={a.id} app={a} colors={colors} onPress={() => router.push(`/app-details/${a.id}`)} />)}
              </RNScrollView>
            </View>
          </CollapsibleSection>
        )}

        {/* ── More from Developer ── */}
        {moreByDev.length > 0 && (
          <CollapsibleSection title="More by Developer" icon="account-circle-outline" colors={colors} defaultExpanded action={
            <AnimatedPressable onPress={() => router.push(`/developer/${encodeURIComponent(app.developer)}`)}>
              <ThemedText style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>See all</ThemedText>
            </AnimatedPressable>
          }>
            <View style={{ marginLeft: -24 }}>
              <RNScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedScroll}>
                {moreByDev.map(a => <RelatedAppCard key={a.id} app={a} colors={colors} onPress={() => router.push(`/app-details/${a.id}`)} />)}
              </RNScrollView>
            </View>
          </CollapsibleSection>
        )}

      </Animated.ScrollView>

      {/* ── Sticky Download Button ── */}
      <Animated.View style={[styles.stickyActionContainer, stickyActionStyle, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.background, borderTopColor: colors.border }]}>
         <AnimatedBasketButton
           inBasket={inBasket}
           onPress={() => inBasket ? remove(app.id) : add(app)}
           style={styles.basketBtnFull}
           textStyle={styles.basketBtnTextFull}
           colors={colors}
           iconSize={20}
         />
         <AppDownloadButton appId={app.id} onStartDownload={handleInstallPress} />
      </Animated.View>



      {/* ── Version History ── */}
      {historyVisible && (
        <VersionHistorySheet
          appName={app.name}
          currentVersionCode={currentVersion.versionCode}
          history={versionHistory as any}
          bottomInset={insets.bottom}
          onClose={() => setHistoryVisible(false)}
          onRollback={(entry) => {
            setHistoryVisible(false);
            startDownload({
              appId: app.id,
              name: app.name,
              developer: app.developer,
              letter: app.letter ?? iconLetter,
              color: app.color ?? accent,
              version: entry.versionName,
              sizeBytes: entry.sizeBytes,
              apkUrl: entry.apkUrl,
              repositoryId: app.repositoryId,
              iconUrl: app.iconUrl,
            });
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  updateInfoCard: { marginHorizontal: 24, padding: 18, borderRadius: 24, borderWidth: 1, marginTop: 24 },
  updateInfoHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)', paddingBottom: 10, marginBottom: 8 },
  updateInfoTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  updateInfoGrid: { borderWidth: 1, borderRadius: 16, padding: 14, marginVertical: 10, flexDirection: 'row', flexWrap: 'wrap' },
  updateGridItem: { width: '50%', paddingVertical: 8, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  updateGridLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2, letterSpacing: 0.3 },
  updateGridValue: { fontSize: 13, fontWeight: '600' },
  changelogHeading: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 12, marginBottom: 8 },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20
  },
  headerBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4
  },
  scroll: { paddingBottom: 40 },
  featureGraphicContainer: {
    height: 190,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  featureGraphicImage: {
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },
  featureGraphicPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureGraphicOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  
  heroRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 24, alignItems: 'center', marginTop: -40, zIndex: 10 },
  heroIconContainer: { borderRadius: 32, padding: 4, elevation: 8, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 16 },
  heroIcon: { width: 110, height: 110, borderRadius: 28 },
  heroInfo: { flex: 1, gap: 6 },
  appName: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, lineHeight: 32 },
  appDeveloper: { fontSize: 16, fontWeight: '700' },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  categoryBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  categoryBadgeText: { fontSize: 13, fontWeight: '700' },
  
  statsContainer: { marginTop: 28 },
  statsScroll: { paddingHorizontal: 24, alignItems: 'center', gap: 20 },
  statItem: { alignItems: 'center', minWidth: 64 },
  statValue: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  divider: { width: 1, height: 40, opacity: 0.3 },
  dividerFull: { height: 1, width: '100%', opacity: 0.5 },
  
  mainActionWrap: { paddingHorizontal: 24, marginTop: 32 },
  basketBtnFull: { flexDirection: "row", alignSelf: "stretch", alignItems: "center", justifyContent: "center", paddingVertical: 11, borderRadius: 24, borderWidth: 1.5, minHeight: 44, marginBottom: 12 },
  basketBtnTextFull: { fontSize: 15, fontWeight: "700" },
  
  stickyActionContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16, borderTopWidth: 1, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12 },

  section: { marginTop: 48 },
  collapsibleSection: { marginTop: 24, paddingHorizontal: 24 },
  collapsibleHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  collapsibleContent: { paddingTop: 16, paddingBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '700', paddingHorizontal: 0, marginBottom: 0, letterSpacing: -0.3 },
  screenshotsScroll: { paddingHorizontal: 24, gap: 16 },
  screenshot: { width: 180, height: 360, borderRadius: 24 },
  screenshotFallback: { width: 220, height: 440, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  screenshotErrorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 28,
  },
  screenshotErrorText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  screenshotRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  screenshotRetryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  
  aboutText: { fontSize: 16, lineHeight: 26, paddingHorizontal: 24 },
  expandText: { fontSize: 15, fontWeight: '700' },
  
  changelogCard: { marginHorizontal: 24, padding: 20, borderRadius: 24 },
  changelogVersion: { fontSize: 17, fontWeight: '800' },
  changelogDate: { fontSize: 14, fontWeight: '600' },
  changelogText: { fontSize: 15, lineHeight: 24 },
  
  permissionsWrap: { paddingHorizontal: 24, marginTop: 16, gap: 12 },
  permissionChip: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20 },
  permissionIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  // Permission Analyzer Section Styles
  permissionsContainer: { marginHorizontal: 24, gap: 14 },
  permissionsSummaryPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  permissionsPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, gap: 6 },
  permissionsPillText: { fontSize: 12, fontWeight: '700' },
  warningNoticeCard: { marginHorizontal: 24, padding: 16, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  warningNoticeText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  filterScroll: { paddingHorizontal: 24, marginBottom: 12 },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8, gap: 6 },
  filterChipText: { fontSize: 13, fontWeight: '700' },
  riskFilterBar: { flexDirection: 'row', paddingHorizontal: 24, gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  riskChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, gap: 6 },
  riskChipText: { fontSize: 12, fontWeight: '700' },
  riskDot: { width: 8, height: 8, borderRadius: 4 },
  permissionDetailsList: { paddingHorizontal: 24, gap: 12, marginTop: 4 },
  permissionDetailCard: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  permissionCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  permissionIconAndMeta: { flexDirection: 'row', flex: 1, gap: 12 },
  permissionDetailIconBg: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  permissionNameAndCategory: { flex: 1, gap: 2 },
  permissionDetailName: { fontSize: 15, fontWeight: '800' },
  permissionDetailCategory: { fontSize: 12, fontWeight: '600' },
  riskBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  riskBadgeText: { fontSize: 10, fontWeight: '800' },
  permissionDetailDesc: { fontSize: 13, lineHeight: 18 },
  emptyFilteredState: { paddingVertical: 32, alignItems: 'center', justifyContent: 'center' },
  emptyFilteredText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  totalCountBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 8 },
  totalCountText: { fontSize: 11, fontWeight: '800' },

  infoList: { marginHorizontal: 24, gap: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  infoIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  infoTextCol: { flex: 1, marginLeft: 16, gap: 2 },
  infoLabel: { fontSize: 14, fontWeight: '600' },
  infoValue: { fontSize: 15, fontWeight: '700' },
  versionLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 24, marginTop: 12 },
  versionLinkText: { fontSize: 16, fontWeight: '800' },
  
  similarRow: { paddingHorizontal: 24, gap: 14 },
  similarCard: { width: 170, borderRadius: 28, borderWidth: 1, padding: 16 },
  similarName: { fontSize: 16, fontWeight: '800' },
  similarDesc: { fontSize: 13, lineHeight: 18 },
  
  iconBubble: { alignItems: 'center', justifyContent: 'center' },
  iconLetter: { color: '#fff', fontWeight: '900' },
  notFoundWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 14 },
  emptyTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginBottom: 6 },
  emptySub: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  returnBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 24 },
  returnBtnText: { fontSize: 15, fontWeight: '700', letterSpacing: 0.1 },

  // App Security & Trust Card Styles
  trustCard: { marginHorizontal: 24, padding: 20, borderRadius: 24, borderWidth: 1 },
  trustCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  trustCardTitle: { fontSize: 17, fontWeight: '800' },
  trustCardDesc: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  trustDetails: { gap: 10 },
  trustDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trustDetailLabel: { fontSize: 13, fontWeight: '600' },
  trustDetailValue: { fontSize: 13, fontWeight: '700' },
});
