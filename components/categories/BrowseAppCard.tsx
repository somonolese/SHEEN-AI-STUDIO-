import { shareApp } from '@/lib/share';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { materialCardEnter } from "../animations";
import Animated, { FadeInUp, LinearTransition } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { App } from '@/lib/types';
import { useColors } from '@/hooks/useColors';
import { ThemedText } from '@/components/ThemedText';
import { AppIconWithRing } from '@/components/downloads/AppIconWithRing';
import { AppDownloadButton } from '@/components/downloads/AppDownloadButton';
import { useAppDownload, useDownloads } from '@/hooks/useDownloads';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { useBasket } from '@/hooks/useBasket';

import { AnimatedBasketButton } from '@/components/AnimatedBasketButton';
import { cleanHtml } from '@/lib/html';

interface Props {
  app: App;
  index: number;
  onPress: () => void;
  hasUpdate?: boolean;
}

export function BrowseAppCard({ app, index, onPress, hasUpdate }: Props) {
  const colors = useColors();
  const { startDownload } = useDownloads();
  const download = useAppDownload(app.id);
  const { add: addToBasket, remove: removeFromBasket, isInBasket } = useBasket();
  const inBasket = isInBasket(app.id);

  const sizeMB = app.currentVersion?.sizeBytes ? (app.currentVersion.sizeBytes / 1024 / 1024).toFixed(1) : '?';
  const versionName = app.currentVersion?.versionName || '1.0.0';

  return (
    <Animated.View 
      entering={materialCardEnter(index, 50, 40)}
      layout={LinearTransition.springify().stiffness(90).damping(12)}
    >
      <AnimatedPressable accessibilityRole="none" onPress={onPress} style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.topSection}>
          <View style={styles.iconWrap}>
            <AppIconWithRing 
              app={app}
              letter={app.letter ?? app.name.charAt(0)} 
              color={app.color ?? colors.primary} 
              size={60} 
              download={download} 
              hasUpdate={hasUpdate} 
              iconUrl={app.iconUrl} 
            />
          </View>
          <View style={styles.infoWrap}>
            <ThemedText style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{app.name}</ThemedText>
            <ThemedText style={[styles.description, { color: colors.foreground, marginTop: 4 }]} numberOfLines={3}>
              {cleanHtml(app.shortDescription || app.description)}
            </ThemedText>
            <ThemedText style={[styles.metadata, { color: colors.mutedForeground, marginTop: 6 }]} numberOfLines={1}>
              {app.developer} • {app.source} • v{versionName}
            </ThemedText>
          </View>
        </View>

        <View style={styles.buttonsSection}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <AnimatedBasketButton
              inBasket={inBasket}
              onPress={(e: any) => {
                e.stopPropagation();
                inBasket ? removeFromBasket(app.id) : addToBasket(app);
              }}
              style={[
                styles.basketBtn,
                { flex: 1, borderWidth: 1.5 }
              ]}
              textStyle={styles.basketBtnText}
              colors={colors}
              iconSize={18}
            />

            <TouchableOpacity 
              style={[
                styles.basketBtn, 
                { 
                  borderColor: colors.border,
                  backgroundColor: 'transparent',
                  width: 50
                }
              ]}
              onPress={(e) => {
                e.stopPropagation();
                shareApp(app);
              }}
            >
              <MaterialCommunityIcons name="share-variant-outline" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <AppDownloadButton
            appId={app.id}
            onStartDownload={() =>
              startDownload({
                appId: app.id,
                name: app.name,
                developer: app.developer,
                letter: app.letter ?? app.name.charAt(0).toUpperCase(),
                color: app.color ?? '#4F46E5',
                version: versionName,
                sizeBytes: app.currentVersion?.sizeBytes ?? 0,
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

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 28,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconWrap: {
    marginRight: 16,
  },
  infoWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  metadata: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.8,
    marginBottom: 2,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.6,
  },
  buttonsSection: {
    gap: 12,
  },
  basketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
    width: '100%',
  },
  basketBtnText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
