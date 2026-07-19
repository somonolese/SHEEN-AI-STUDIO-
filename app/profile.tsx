import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Platform, Image, TextInput, TouchableOpacity, Modal, PanResponder, Linking, Alert, Share, ToastAndroid } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { Easing, FadeIn, FadeInUp, FadeInDown } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

import { useColors } from '@/hooks/useColors';
import { useTypography } from '@/hooks/useTypography';
import { ThemedText } from '@/components/ThemedText';
import { SkeletonButton } from '@/components/Skeleton';
import { useSettings } from '@/hooks/useSettings';
import { AnimatedPressable, SettingsCard, ActionRow } from '@/components/settings/SettingsPrimitives';
import { SheenIcon } from '@/components/SheenIcon';
import { useTranslation } from '@/lib/i18n';
import { useBasket } from '@/hooks/useBasket';
import { useDownloads } from '@/hooks/useDownloads';
import { shareBasket } from '@/lib/share';
import { useCatalog } from '@/contexts/CatalogContext';
import { CategoryAppCard } from '@/components/categories/CategoryAppCard';
import { App } from '@/lib/types';

export default function ProfileScreen() {
  const colors = useColors();
  const fonts = useTypography();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings, update } = useSettings();
  const { t } = useTranslation();

  const openExternal = (url: string) => {
    haptic();
    Linking.openURL(url).catch(() => {
      Alert.alert('Unable to open link', 'Please check your connection and try again.');
    });
  };

  const handleShare = async () => {
    haptic();
    try {
      await Share.share({
        message: 'Discover, download, and update premium open-source Android apps with SHEEN!',
        url: 'https://github.com',
      });
    } catch (error) {
    }
  };

  const [name, setName] = useState(settings.userName || '');
  const [email, setEmail] = useState(settings.userEmail || '');
  const [logoTaps, setLogoTaps] = useState(0);
  
  // Throttle updates
  const handleNameChange = (t: string) => { setName(t); update('userName', t); };
  const handleEmailChange = (t: string) => { setEmail(t); update('userEmail', t); };

  const haptic = () => {
    if (Platform.OS !== 'web' && settings.hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handleLogoTap = useCallback(() => {
    if (settings.developerUnlocked) {
      if (Platform.OS === 'android') {
        ToastAndroid.show('Developer options are already enabled.', ToastAndroid.SHORT);
      }
      return;
    }
    
    const nextTaps = logoTaps + 1;
    setLogoTaps(nextTaps);
    
    if (nextTaps === 5) {
      update('developerUnlocked', true);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Developer options unlocked!', ToastAndroid.SHORT);
      }
      haptic();
      setLogoTaps(0);
    }
  }, [settings.developerUnlocked, logoTaps, update]);

  // Photo Editor state
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorType, setEditorType] = useState<'profile' | 'cover'>('profile');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [imageWidth, setImageWidth] = useState(800);
  const [imageHeight, setImageHeight] = useState(600);
  
  const [zoom, setZoom] = useState(1.0);
  const [rotate, setRotate] = useState(0); // 0, 90, 180, 270
  const [flipped, setFlipped] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  const [isCropping, setIsCropping] = useState(false);

  const pickImage = async (type: 'cover' | 'profile') => {
    haptic();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false, // Let our custom premium editor handle the crop!
      quality: 1.0,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setSelectedImageUri(asset.uri);
      setImageWidth(asset.width || 800);
      setImageHeight(asset.height || 600);
      setEditorType(type);
      
      // Reset editor parameters to default
      setZoom(1.0);
      setRotate(0);
      setFlipped(false);
      setOffset({ x: 0, y: 0 });
      setEditorVisible(true);
    }
  };

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 34 + 40 : insets.bottom + 24;

  const basket = useBasket();
  const { startBatch } = useDownloads();
  const { appsById } = useCatalog();

  const basketApps = useMemo(() => {
    return Object.values(basket.items)
      .map((i) => appsById.get(i.appId))
      .filter(Boolean) as App[];
  }, [basket.items, appsById]);

  const downloadableApps = useMemo(() => {
    return basketApps.map((app) => ({
      appId: app.id,
      name: app.name,
      developer: app.developer,
      letter: app.letter ?? app.name.charAt(0).toUpperCase(),
      color: app.color ?? '#000000',
      version: app.currentVersion?.versionName ?? '1.0.0',
      sizeBytes: app.currentVersion?.sizeBytes ?? 0,
      apkUrl: app.currentVersion?.apkUrl ?? '',
      repositoryId: app.repositoryId,
      iconUrl: app.iconUrl,
    }));
  }, [basketApps]);

  const handleDownloadAll = useCallback(() => {
    haptic();
    if (downloadableApps.length > 0) {
      startBatch(downloadableApps);
    }
  }, [downloadableApps, startBatch]);

  const handleClearBasket = useCallback(() => {
    haptic();
    basket.clear();
  }, [basket]);

  const handleShareBasket = useCallback(() => {
    haptic();
    shareBasket(basketApps);
  }, [basketApps]);

  // Dynamic Editor layout metrics
  const cropWidth = editorType === 'profile' ? 250 : 320;
  const cropHeight = editorType === 'profile' ? 250 : 180;
  const prevSize = editorType === 'profile' ? 100 : 160;
  const rPrev = prevSize / cropWidth;

  const isRotated90 = rotate === 90 || rotate === 270;
  const W_base = isRotated90 ? imageHeight : imageWidth;
  const H_base = isRotated90 ? imageWidth : imageHeight;

  const s = Math.max(cropWidth / W_base, cropHeight / H_base);
  const W_disp = W_base * s;
  const H_disp = H_base * s;

  const maxOffsetX = Math.max(0, (W_disp * zoom - cropWidth) / 2);
  const maxOffsetY = Math.max(0, (H_disp * zoom - cropHeight) / 2);

  const boundedX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offset.x));
  const boundedY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offset.y));

  // Sync state values with refs to avoid stale closures inside PanResponder
  const zoomRef = React.useRef(zoom);
  zoomRef.current = zoom;

  const offsetRef = React.useRef(offset);
  offsetRef.current = offset;

  const panStartRef = React.useRef({ x: 0, y: 0 });
  const startDistRef = React.useRef(0);
  const startZoomRef = React.useRef(1.0);

  const getDistance = (touch1: any, touch2: any) => {
    const dx = (touch1.pageX ?? 0) - (touch2.pageX ?? 0);
    const dy = (touch1.pageY ?? 0) - (touch2.pageY ?? 0);
    return Math.sqrt(dx * dx + dy * dy);
  };

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        panStartRef.current = { x: offsetRef.current.x, y: offsetRef.current.y };
        
        const touches = evt.nativeEvent.touches || [];
        if (touches.length === 2) {
          const dist = getDistance(touches[0], touches[1]);
          startDistRef.current = dist;
          startZoomRef.current = zoomRef.current;
        } else {
          startDistRef.current = 0;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches || [];
        if (touches.length === 2) {
          if (startDistRef.current > 0) {
            const dist = getDistance(touches[0], touches[1]);
            const newZoom = Math.max(1.0, Math.min(4.0, startZoomRef.current * (dist / startDistRef.current)));
            setZoom(newZoom);
          } else {
            const dist = getDistance(touches[0], touches[1]);
            startDistRef.current = dist;
            startZoomRef.current = zoomRef.current;
          }
        } else {
          setOffset({
            x: panStartRef.current.x + gestureState.dx,
            y: panStartRef.current.y + gestureState.dy,
          });
        }
      },
      onPanResponderRelease: () => {
        startDistRef.current = 0;
      },
      onPanResponderTerminate: () => {
        startDistRef.current = 0;
      },
    })
  ).current;

  const handleSliderTouch = (e: any) => {
    const { locationX } = e.nativeEvent;
    const width = 200; // width of slider track
    const percentage = Math.max(0, Math.min(1, locationX / width));
    setZoom(1.0 + percentage * 3.0); // 1.0 to 4.0
  };

  // Map to original image space
  const Dx = (-cropWidth / 2) - (boundedX - (W_disp * zoom) / 2);
  const Dy = (-cropHeight / 2) - (boundedY - (H_disp * zoom) / 2);
  const totalScaleFactor = (W_disp * zoom) / W_base;
  
  const rawCropX = Dx / totalScaleFactor;
  const rawCropY = Dy / totalScaleFactor;
  const rawCropW = cropWidth / totalScaleFactor;
  const rawCropH = cropHeight / totalScaleFactor;

  const cropX = Math.max(0, Math.min(W_base - rawCropW, rawCropX));
  const cropY = Math.max(0, Math.min(H_base - rawCropH, rawCropY));
  const cropW_bounded = Math.min(W_base - cropX, rawCropW);
  const cropH_bounded = Math.min(H_base - cropY, rawCropH);

  const saveCroppedImage = async () => {
    if (!selectedImageUri) return;
    haptic();
    setIsCropping(true);
    try {
      const actions: any[] = [];

      // 1. Rotation first
      if (rotate !== 0) {
        actions.push({ rotate });
      }

      // 2. Flip horizontal if applied
      if (flipped) {
        actions.push({ flip: 'horizontal' as any });
      }

      // 3. Crop
      actions.push({
        crop: {
          originX: Math.round(cropX),
          originY: Math.round(cropY),
          width: Math.round(cropW_bounded),
          height: Math.round(cropH_bounded),
        },
      });

      const result = await manipulateAsync(selectedImageUri, actions, {
        compress: 0.9,
        format: SaveFormat.JPEG,
        base64: true,
      });

      let finalUri = result.uri;
      if (Platform.OS === 'web' && result.base64) {
        finalUri = `data:image/jpeg;base64,${result.base64}`;
      } else {
        const documentDirectory = FileSystem.documentDirectory;
        if (!documentDirectory) {
          throw new Error('FileSystem.documentDirectory is null');
        }
        const permanentDir = `${documentDirectory}${editorType}s/`;
        await FileSystem.makeDirectoryAsync(permanentDir, { intermediates: true });
        finalUri = `${permanentDir}${Date.now()}.jpg`;
        await FileSystem.copyAsync({
          from: result.uri,
          to: finalUri,
        });
      }

      if (editorType === 'cover') {
        update('coverPhoto', finalUri);
      } else {
        update('profilePicture', finalUri);
      }

      setEditorVisible(false);
    } catch (error) {
      if (error instanceof Error) {
        console.error('Failed to crop image (Error):', error.message, error.stack);
      } else {
        console.error('Failed to crop image (Unknown):', error);
      }
    } finally {
      setIsCropping(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style="auto" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Premium Material 3 Photo Editor Modal (WhatsApp style) */}
      <Modal
        visible={editorVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setEditorVisible(false)}
      >
        <View style={[styles.editorRoot, { backgroundColor: '#000' }]}>
          {/* Viewport Area */}
          <View 
            style={styles.viewportContainer}
            {...panResponder.panHandlers}
          >
            {/* The Image under crop frame */}
            {selectedImageUri && (
              <Animated.Image 
                source={{ uri: selectedImageUri }} 
                style={[
                  styles.editorImage,
                  {
                    width: W_disp,
                    height: H_disp,
                    transform: [
                      { translateX: boundedX },
                      { translateY: boundedY },
                      { scale: zoom },
                      { rotate: `${rotate}deg` },
                      { scaleX: flipped ? -1 : 1 },
                    ],
                  }
                ]} 
              />
            )}

            {/* Custom Grid / Mask Overlay */}
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)' }} />
              <View style={{ flexDirection: 'row', height: cropHeight }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)' }} />
                <View 
                  style={{ 
                    width: cropWidth, 
                    height: cropHeight, 
                    backgroundColor: 'transparent', 
                    borderColor: 'rgba(255, 255, 255, 0.45)', 
                    borderWidth: 1, 
                    borderRadius: editorType === 'profile' ? cropWidth / 2 : 0,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {/* Grid overlay for professional feel */}
                  <View style={styles.gridOverlay}>
                    <View style={styles.gridRow}>
                      <View style={styles.gridCell} />
                      <View style={[styles.gridCell, styles.borderLeftRight]} />
                      <View style={styles.gridCell} />
                    </View>
                    <View style={[styles.gridRow, styles.borderTopBottom]}>
                      <View style={styles.gridCell} />
                      <View style={[styles.gridCell, styles.borderLeftRight]} />
                      <View style={styles.gridCell} />
                    </View>
                    <View style={styles.gridRow}>
                      <View style={styles.gridCell} />
                      <View style={[styles.gridCell, styles.borderLeftRight]} />
                      <View style={styles.gridCell} />
                    </View>
                  </View>

                  {/* Corner and Edge Anchors - WhatsApp style (only for non-profile rectangular crops, or optionally both) */}
                  {editorType !== 'profile' && (
                    <>
                      <View style={styles.cornerTL} />
                      <View style={styles.cornerTR} />
                      <View style={styles.cornerBL} />
                      <View style={styles.cornerBR} />
                      <View style={styles.edgeT} />
                      <View style={styles.edgeB} />
                      <View style={styles.edgeL} />
                      <View style={styles.edgeR} />
                    </>
                  )}
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)' }} />
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)' }} />
            </View>
          </View>

          {/* Simple Bottom Bar matching WhatsApp */}
          <View style={[styles.editorFooter, { paddingBottom: Math.max(24, insets.bottom) }]}>
            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={() => setEditorVisible(false)}
              style={styles.footerBtn}
            >
              <ThemedText style={[styles.footerBtnText, { color: '#ff3b5c', fontFamily: fonts.semibold }]}>
                Cancel
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={() => {
                haptic();
                setRotate(prev => (prev + 90) % 360);
              }}
              style={styles.rotateBtn}
            >
              <MaterialCommunityIcons name="crop-rotate" size={28} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={saveCroppedImage}
              disabled={isCropping}
              style={styles.footerBtn}
            >
              {isCropping ? (
                <SkeletonButton width={48} height={20} style={{ borderRadius: 10 }} />
              ) : (
                <ThemedText style={[styles.footerBtnText, { color: '#ff3b5c', fontFamily: fonts.semibold }]}>
                  Done
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      <ScrollView 
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover Photo */}
        <Animated.View entering={FadeIn.duration(400)} style={[styles.coverWrap, { marginTop: topPad }]}>
          <View style={[styles.coverInner, { backgroundColor: colors.surfaceContainerHigh }]}>
            {settings.coverPhoto ? (
              <Image source={{ uri: settings.coverPhoto }} style={styles.coverImage} />
            ) : (
              <View style={[styles.coverFallback, { backgroundColor: colors.surfaceContainerHigh }]} />
            )}
            
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => pickImage('cover')} 
              style={[styles.changeCoverBtn, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
            >
              <ThemedText style={[styles.changeCoverText, { fontFamily: fonts.medium }]}>Change Cover</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => { haptic(); router.back(); }}
              style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => pickImage('profile')}>
              <View style={[styles.avatarWrap, { borderColor: colors.background }]}>
                {settings.profilePicture ? (
                  <Image source={{ uri: settings.profilePicture }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
                    <ThemedText style={[styles.avatarInitials, { color: colors.onPrimary, fontFamily: fonts.bold }]}>
                      {name ? name.charAt(0).toUpperCase() : 'S'}
                    </ThemedText>
                  </View>
                )}
                <View style={[styles.editAvatarBadge, { backgroundColor: '#ef4444', borderColor: colors.background }]}>
                  <MaterialCommunityIcons name="pencil" size={12} color="#fff" />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Inputs */}
        <Animated.View entering={FadeInUp.delay(100).duration(500).springify().damping(22)} style={styles.inputsSection}>
          <View style={[styles.inputGroup, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="account-outline" size={22} color={colors.mutedForeground} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.foreground, fontFamily: fonts.medium }]}
              placeholder="Display Name"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={handleNameChange}
            />
          </View>
          
          <View style={[styles.inputGroup, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="email-outline" size={22} color={colors.mutedForeground} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.foreground, fontFamily: fonts.medium }]}
              placeholder="Email address"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={handleEmailChange}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </Animated.View>

        {/* Basket Section */}
        <Animated.View 
          entering={FadeInUp.delay(150).duration(500).springify().damping(22)} 
          style={styles.section}
        >
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="basket-outline" size={22} color={colors.primary} />
              <ThemedText style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fonts.bold }]}>
                {t('tabs.basket') || 'Basket'}
              </ThemedText>
            </View>
            <ThemedText style={{ color: colors.mutedForeground, fontSize: 14 }}>
              {basketApps.length} {basketApps.length === 1 ? 'item' : 'items'}
            </ThemedText>
          </View>

          {basketApps.length > 0 ? (
            <View style={{ gap: 12 }}>
              <View style={[styles.actionBar, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
                <ActionRow
                  icon="download-multiple"
                  title="Download All"
                  subtitle="Install all apps in your basket"
                  onPress={handleDownloadAll}
                />
                <ActionRow
                  icon="share-variant-outline"
                  title="Share Basket"
                  onPress={handleShareBasket}
                />
                <ActionRow
                  icon="delete-sweep-outline"
                  title="Clear Basket"
                  onPress={handleClearBasket}
                />
              </View>

              <View style={{ marginTop: 8 }}>
                {basketApps.map((app, idx) => (
                  <CategoryAppCard 
                    key={app.id}
                    index={idx}
                    app={app}
                    onPress={() => router.push(`/app-details/${encodeURIComponent(app.id)}`)}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View style={[styles.emptyBasketCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="basket-off-outline" size={32} color={colors.mutedForeground} style={{ marginBottom: 8 }} />
              <ThemedText style={{ color: colors.foreground, fontSize: 16, fontFamily: fonts.semibold }}>
                Your basket is empty
              </ThemedText>
              <ThemedText style={{ color: colors.mutedForeground, fontSize: 13, textAlign: 'center', marginTop: 4, paddingHorizontal: 16 }}>
                Explore open source apps and add them to your basket for batch downloads.
              </ThemedText>
            </View>
          )}
        </Animated.View>

        {/* Get Involved */}
        <Animated.View 
          entering={FadeInUp.delay(200).duration(500).springify().damping(22)} 
          style={styles.section}
        >
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fonts.bold }]}>
              {t('settings.involved')}
            </ThemedText>
          </View>
          
          <SettingsCard index={2}>
            <ActionRow
              icon="github"
              title="GitHub Repository"
              subtitle="View the source code and contribute to the project"
              onPress={() => openExternal('https://github.com')}
            />
            <ActionRow
              icon="bug-outline"
              title="Report a Bug"
              subtitle="Let us know about any issues or unexpected crashes"
              onPress={() => openExternal('https://github.com/issues/new')}
            />
            <ActionRow
              icon="lightbulb-on-outline"
              title="Request a Feature"
              subtitle="Suggest new features or user interface improvements"
              onPress={() => openExternal('https://github.com/issues/new')}
            />
            <ActionRow
              icon="cellphone"
              title="Contact Developer"
              subtitle="Reach out directly to the developers of SHEEN"
              onPress={() => openExternal('mailto:backupratherjazu88@gmail.com')}
            />
            <ActionRow
              icon="share-variant-outline"
              title="Share SHEEN"
              subtitle="Spread the word and share this app store with others"
              onPress={handleShare}
            />
          </SettingsCard>
        </Animated.View>

        {/* ── About footer with official SHEEN branding ── */}
        <View style={styles.aboutFooter}>
          <AnimatedPressable onPress={handleLogoTap} style={styles.aboutFooterIconWrapper}>
            <SheenIcon size={72} style={styles.aboutFooterIcon} />
          </AnimatedPressable>
          <ThemedText style={[styles.aboutFooterTitle, { color: colors.foreground }]}>SHEEN</ThemedText>
          <ThemedText style={[styles.aboutFooterTagline, { color: colors.mutedForeground }]}>
            Open Source Android App Store
          </ThemedText>
          <ThemedText style={[styles.footer, { color: colors.mutedForeground }]}>
            Made with ❤️ in Kashmir.
          </ThemedText>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  
  coverWrap: {
    height: 180,
    marginBottom: 60,
    position: 'relative',
  },
  coverInner: {
    height: 180,
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
  },
  coverImage: { width: '100%', height: '100%' },
  coverFallback: { width: '100%', height: '100%' },
  
  changeCoverBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  changeCoverText: {
    color: '#fff',
    fontSize: 12,
  },
  
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  avatarContainer: {
    position: 'absolute',
    bottom: -40,
    left: 24,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 36,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  inputsSection: {
    gap: 12,
    marginBottom: 32,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
  },
  
  // Editor Styles
  editorRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  viewportContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  editorImage: {
    position: 'absolute',
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
  },
  gridCell: {
    flex: 1,
  },
  borderLeftRight: {
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  borderTopBottom: {
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  cornerTL: {
    position: 'absolute',
    top: -3,
    left: -3,
    width: 24,
    height: 24,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#fff',
  },
  cornerTR: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 24,
    height: 24,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#fff',
  },
  cornerBL: {
    position: 'absolute',
    bottom: -3,
    left: -3,
    width: 24,
    height: 24,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#fff',
  },
  cornerBR: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 24,
    height: 24,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#fff',
  },
  edgeT: {
    position: 'absolute',
    top: -3,
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 4,
    backgroundColor: '#fff',
  },
  edgeB: {
    position: 'absolute',
    bottom: -3,
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 4,
    backgroundColor: '#fff',
  },
  edgeL: {
    position: 'absolute',
    left: -3,
    top: '50%',
    marginTop: -12,
    width: 4,
    height: 24,
    backgroundColor: '#fff',
  },
  edgeR: {
    position: 'absolute',
    right: -3,
    top: '50%',
    marginTop: -12,
    width: 4,
    height: 24,
    backgroundColor: '#fff',
  },
  editorFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#000',
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  footerBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 80,
    justifyContent: 'center',
  },
  footerBtnText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  rotateBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1f1f1f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutFooterIconWrapper: {
    marginBottom: 10,
  },
  aboutFooter: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    gap: 4,
  },
  aboutFooterIcon: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
  },
  aboutFooterTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  aboutFooterTagline: {
    fontSize: 13,
    letterSpacing: 0.1,
    marginBottom: 6,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  actionBar: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  emptyBasketCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
