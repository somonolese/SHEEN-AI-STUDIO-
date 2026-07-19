/**
 * AppDownloadButton
 *
 * A shared, stateful download button that drives the full download flow:
 *   ⬇ Install → Preparing... / Queued → morphing ring + % → Paused/Resume → Installing... → Split Open/Uninstall Pill
 *
 * All callers pass an `appId` for tracking and an `onStartDownload` callback.
 * Designed with Material 3 Expressive Motion and continuous spring-driven morphing.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Modal, ScrollView, View, Pressable, AccessibilityInfo } from 'react-native';
import Animated, {
  FadeIn,
  FadeInLeft, FadeOut,
  FadeOutLeft,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAppDownload, useDownloads } from '@/hooks/useDownloads';
import { useCatalog } from '@/contexts/CatalogContext';
import { ThemedText } from '@/components/ThemedText';
import { ProgressRing } from './ProgressRing';
import { getInstalledVersion } from '@/lib/services/UpdateManager';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function triggerHaptic(style: 'medium' | 'success') {
  if (Platform.OS === 'web') return;
  if (style === 'medium') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  } else {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
}

interface AppDownloadButtonProps {
  appId: string;
  /** Called when the user presses the button in idle/retry state. Must enqueue the download. */
  onStartDownload: () => void;
  /** Called when the user presses the Open button after installation. */
  onOpen?: () => void;
}

export function AppDownloadButton({ appId, onStartDownload, onOpen }: AppDownloadButtonProps) {
  const colors = useColors();
  const { tasks, retryDownload, forceInstallTask, pauseDownload, resumeDownload } = useDownloads();
  const download = useAppDownload(appId);
  const status = download?.status;
  const [showWarning, setShowWarning] = useState(false);
  
  const { getAppById, getAppByPackage } = useCatalog();

  // Find App from context or synthesize fallback from download task
  const app = useMemo(() => {
    return getAppById(appId) || getAppByPackage(appId) || (download ? {
      id: download.appId,
      packageName: download.packageName,
      name: download.name,
      developer: download.developer,
      source: 'Other',
      repositoryId: download.repositoryId,
      currentVersion: {
        versionName: download.versionName,
        versionCode: download.versionCode,
        added: Date.now(),
        sizeBytes: download.totalBytes,
        apkUrl: download.apkUrl,
      }
    } : undefined);
  }, [appId, download, getAppById, getAppByPackage]);

  // Track installed status reactively
  const [installedVersion, setInstalledVersion] = useState<any>(null);
  useEffect(() => {
    if (app?.packageName) {
      const v = getInstalledVersion(app.packageName);
      setInstalledVersion(v);
    }
  }, [app?.packageName, status]);

  const hasUpdate = useMemo(() => {
    return installedVersion && app && app.currentVersion.versionCode > installedVersion.versionCode;
  }, [installedVersion, app]);

  // Determine Queue Position and whether other downloads are running
  const otherDownloading = tasks.some((t) => t.appId !== appId && t.status === 'downloading');
  const queuedTasks = tasks.filter(t => t.status === 'queued');
  const queueIndex = queuedTasks.findIndex(t => t.appId === appId);
  const queuePosition = queueIndex !== -1 ? queueIndex + 1 : 1;

  // Determine current visual state
  type PillState =
    | 'idle'
    | 'queued'
    | 'preparing'
    | 'downloading'
    | 'paused'
    | 'verifying'
    | 'installing'
    | 'installed'
    | 'update_available'
    | 'failed'
    | 'warning';

  const btnState = useMemo<PillState>(() => {
    if (status === 'queued') {
      return otherDownloading ? 'queued' : 'preparing';
    } else if (status === 'downloading') {
      return 'downloading';
    } else if (status === 'paused') {
      return 'paused';
    } else if (status === 'verifying') {
      return 'verifying';
    } else if (status === 'installing' || status === 'completed') {
      return 'installing';
    } else if (status === 'installed') {
      return 'installed';
    } else if (status === 'failed') {
      return 'failed';
    } else if (status === 'signature_mismatch') {
      return 'warning';
    } else {
      if (installedVersion) {
        return hasUpdate ? 'update_available' : 'installed';
      }
      return 'idle';
    }
  }, [status, otherDownloading, installedVersion, hasUpdate]);
  const isCircular = ['queued', 'preparing', 'downloading', 'paused', 'verifying', 'installing'].includes(btnState);

  // Haptic on successful install
  const shakeOffset = useSharedValue(0);

  useEffect(() => {
    if (btnState === 'failed') {
      shakeOffset.value = withSequence(
        withTiming(8, { duration: 50 }),
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }
  }, [btnState]);

  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current !== 'installed' && status === 'installed') {
      triggerHaptic('success');
      scale.value = withSequence(withTiming(1.1, { duration: 100 }), withSpring(1, { damping: 15, stiffness: 150 }));
    }
    prevStatus.current = status;
  }, [status]);

  // Progress metrics
  const progress = download && download.totalBytes > 0 ? download.downloadedBytes / download.totalBytes : 0;
  const percent = Math.round(progress * 100);

  // Styling Configuration based on state
  const stateConfig = useMemo(() => {
    let bg = colors.primary;
    let fg = colors.onPrimary;
    let label = 'Install';
    let icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] | undefined = 'download';

    switch (btnState) {
      case 'idle':
        bg = colors.primary;
        fg = colors.onPrimary;
        label = 'Install';
        icon = 'download';
        break;
      case 'queued':
        bg = colors.surfaceContainer;
        fg = colors.mutedForeground;
        label = '';
        icon = 'clock-outline';
        break;
      case 'preparing':
        bg = colors.surfaceContainer;
        fg = colors.mutedForeground;
        label = '';
        icon = 'dots-horizontal';
        break;
      case 'downloading':
        bg = colors.surfaceContainer;
        fg = colors.primary;
        label = '';
        icon = 'pause';
        break;
      case 'paused':
        bg = colors.surfaceContainer;
        fg = colors.primary;
        label = '';
        icon = 'play';
        break;
      case 'verifying':
        bg = colors.surfaceContainer;
        fg = colors.mutedForeground;
        label = '';
        icon = 'shield-search';
        break;
      case 'installing':
        bg = colors.surfaceContainer;
        fg = colors.mutedForeground;
        label = '';
        icon = 'package-down';
        break;
      case 'installed':
        bg = colors.secondaryContainer;
        fg = colors.onSecondaryContainer;
        label = 'Open';
        icon = 'open-in-new';
        break;
      case 'update_available':
        bg = colors.primary;
        fg = colors.onPrimary;
        label = 'Update';
        icon = 'arrow-up-bold-box-outline';
        break;
      case 'failed':
        bg = `${colors.destructive}22`;
        fg = colors.destructive;
        label = 'Retry';
        icon = 'refresh';
        break;
      case 'warning':
        bg = colors.destructive;
        fg = '#ffffff';
        label = 'Blocked';
        icon = 'shield-alert-outline';
        break;
    }
    return { bg, fg, label, icon };
  }, [btnState, percent, queuePosition, colors]);

  // Spring press feedback
  const scale = useSharedValue(1);
  const animatedScaleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value },{ scale: scale.value }],
  }));

  // continuous style transitions for background and borders
  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: withTiming(stateConfig.bg, { duration: 250, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }),
      borderColor: withTiming(
        btnState === 'idle' || btnState === 'update_available' ? 'transparent' : colors.border,
        { duration: 250 }
      ),
      borderWidth: btnState === 'idle' || btnState === 'update_available' ? 0 : 1,
    };
  });

  // Crossfading state text and icons to eliminate harsh jumps
  const [currentLabel, setCurrentLabel] = useState(stateConfig.label);
  const [currentIcon, setCurrentIcon] = useState(stateConfig.icon);
  const [currentBtnState, setCurrentBtnState] = useState(btnState);
  const contentOpacity = useSharedValue(1);

  useEffect(() => {
    // Only fade when state or static icon changes
    contentOpacity.value = withTiming(0, { duration: 90, easing: Easing.linear }, (finished) => {
      if (finished) {
        setCurrentLabel(stateConfig.label);
        setCurrentIcon(stateConfig.icon);
        setCurrentBtnState(btnState);
        contentOpacity.value = withTiming(1, { duration: 130, easing: Easing.linear });
      }
    });
  }, [btnState, stateConfig.icon]);

  // Smooth rotation animation for active indicators (e.g. Installing)
  const rotation = useSharedValue(0);
  useEffect(() => {
    if (btnState === 'installing' || btnState === 'verifying' || btnState === 'preparing') {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1400, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      rotation.value = 0;
    }
  }, [btnState]);

  const rotatingIconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  const animatedContentStyle = useAnimatedStyle(() => {
    return {
      opacity: contentOpacity.value,
    };
  });

  // Action handlers
  const handlePress = (event: any) => {
    event.stopPropagation();
    scale.value = withSpring(0.93, { damping: 20, stiffness: 300, mass: 0.3 });
    setTimeout(() => { scale.value = withSpring(1, { damping: 14, stiffness: 200 }); }, 120);

    if (btnState === 'warning') {
      triggerHaptic('medium');
      setShowWarning(true);
      return;
    }

    if (btnState === 'installed') {
      if (onOpen) {
        onOpen();
      } else if (app?.packageName) {
        if (Platform.OS === 'android') {
          const IntentLauncher = require('expo-intent-launcher');
          IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
            category: 'android.intent.category.LAUNCHER',
            packageName: app.packageName,
          }).catch((e: any) => console.warn('[AppDownloadButton] Failed to launch package:', e));
        } else {
          alert(`Opening ${app.packageName} (Simulated - Launcher works on Android)`);
        }
      }
      return;
    }

    if (btnState === 'failed') {
      triggerHaptic('medium');
      if (download) retryDownload(download.id);
      return;
    }

    if (btnState === 'downloading') {
      triggerHaptic('medium');
      if (download) pauseDownload(download.id);
      return;
    }

    if (btnState === 'paused') {
      triggerHaptic('medium');
      if (download) resumeDownload(download.id);
      return;
    }

    if (btnState === 'queued') {
      triggerHaptic('medium');
      if (download) {
        const { DownloadManager } = require('@/lib/services/DownloadManager');
        DownloadManager.get().cancel(download.id);
      }
      return;
    }

    if (btnState === 'idle' || btnState === 'update_available') {
      triggerHaptic('medium');
      onStartDownload();
      return;
    }
  };

  const handleUninstall = async (event: any) => {
    event.stopPropagation();
    if (!app) return;
    triggerHaptic('medium');

    const { recordUninstalled } = require('@/lib/services/UpdateManager');
    recordUninstalled(app.packageName);

    if (download) {
      const { DownloadManager } = require('@/lib/services/DownloadManager');
      DownloadManager.get().cancel(download.id);
    }

    setInstalledVersion(null);
  };

  // Live label & icon resolution for downloading
  const displayedLabel = btnState === 'downloading' ? stateConfig.label : currentLabel;
  const isShowRing = btnState === 'downloading';

  // Disabled states
  const isDisabled = btnState === 'verifying' || btnState === 'preparing';

  const mismatch = download?.signatureMismatch;

  return (
    <>
      <Animated.View style={styles.container} layout={LinearTransition.springify().damping(22).stiffness(150)}>
        {/* Split Pill: Uninstall button rendered only when installed */}
        {btnState === 'installed' && (
          <AnimatedPressable
            entering={FadeInLeft.springify().damping(20).stiffness(150)}
            exiting={FadeOutLeft.springify().damping(20).stiffness(150)}
            layout={LinearTransition.springify().damping(22).stiffness(150)}
            style={[
              styles.splitBtn,
              styles.uninstallBtn,
              {
                backgroundColor: colors.surfaceContainer,
                borderColor: colors.border,
                borderWidth: 1,
              }
            ]}
            onPress={handleUninstall}
            accessibilityLabel="Uninstall application"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="trash-can-outline" size={15} color={colors.destructive} />
            <ThemedText style={[styles.label, { color: colors.destructive }]}>Uninstall</ThemedText>
          </AnimatedPressable>
        )}

        {/* Primary/Morphing Pill Action Button */}
        <AnimatedPressable
          disabled={isDisabled}
          onPress={handlePress}
          layout={LinearTransition.springify().damping(22).stiffness(150)}
          style={[
            styles.splitBtn,
            animatedContainerStyle,
            animatedScaleStyle,
            { flex: isCircular ? 0 : (btnState === 'installed' ? 1.25 : 1), width: isCircular ? 44 : undefined, height: 44, paddingHorizontal: isCircular ? 0 : 16, justifyContent: 'center' },
          ]}
          accessibilityLabel={displayedLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: isDisabled }}
        >
          {/* Progress Ring for Downloading state */}
          {isCircular ? (
            <Animated.View key="ring" entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={{ alignItems: 'center', justifyContent: 'center' }}>
              <ProgressRing
                progress={progress}
                size={44}
                strokeWidth={3.5}
                color={stateConfig.fg}
                trackColor={`${stateConfig.fg}33`}
                icon={currentIcon}
                indeterminate={btnState === 'preparing' || btnState === 'queued' || btnState === 'verifying' || btnState === 'installing'}
              />
            </Animated.View>
          ) : (
            <Animated.View key="text" entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[styles.innerRow, animatedContentStyle]}>
              {currentIcon && (
                <Animated.View style={rotatingIconStyle}>
                  <MaterialCommunityIcons name={currentIcon as any} size={18} color={stateConfig.fg} />
                </Animated.View>
              )}
              <ThemedText style={[styles.label, { color: stateConfig.fg }]} numberOfLines={1}>
                {currentLabel}
              </ThemedText>
              
              {/* Optional queue position badge */}
              {btnState === 'queued' && queuePosition > 1 && (
                <View style={[styles.badge, { backgroundColor: `${stateConfig.fg}22` }]}>
                  <ThemedText style={[styles.badgeText, { color: stateConfig.fg }]}>#{queuePosition}</ThemedText>
                </View>
              )}
            </Animated.View>
          )}
        </AnimatedPressable>
      </Animated.View>

      {/* Security Warning Modal */}
      {showWarning && download && mismatch && (
        <Modal
          transparent
          animationType="fade"
          visible={showWarning}
          onRequestClose={() => setShowWarning(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.warnHeader}>
                  <MaterialCommunityIcons name="shield-alert-outline" size={44} color={colors.destructive} />
                  <ThemedText style={[styles.warnTitle, { color: colors.foreground }]}>
                    Security Warning
                  </ThemedText>
                </View>

                {/* Description */}
                <ThemedText style={[styles.warnDesc, { color: colors.foreground }]}>
                  This update is signed with a different certificate than the version currently installed.
                </ThemedText>

                {/* Possible Reasons */}
                <View style={[styles.reasonsContainer, { backgroundColor: colors.surfaceContainer }]}>
                  <ThemedText style={[styles.reasonsHeader, { color: colors.foreground }]}>
                    Possible reasons:
                  </ThemedText>
                  <View style={styles.reasonBullet}>
                    <ThemedText style={{ color: colors.destructive, marginRight: 8 }}>•</ThemedText>
                    <ThemedText style={[styles.reasonText, { color: colors.foreground }]}>
                      The developer changed signing keys.
                    </ThemedText>
                  </View>
                  <View style={styles.reasonBullet}>
                    <ThemedText style={{ color: colors.destructive, marginRight: 8 }}>•</ThemedText>
                    <ThemedText style={[styles.reasonText, { color: colors.foreground }]}>
                      The app comes from a different repository (e.g. source-built F-Droid keys vs developer keys).
                    </ThemedText>
                  </View>
                  <View style={styles.reasonBullet}>
                    <ThemedText style={{ color: colors.destructive, marginRight: 8 }}>•</ThemedText>
                    <ThemedText style={[styles.reasonText, { color: colors.foreground }]}>
                      The APK may have been modified or tampered with.
                    </ThemedText>
                  </View>
                </View>

                {/* Technical Details */}
                <ThemedText style={[styles.detailsTitle, { color: colors.mutedForeground }]}>
                  CERTIFICATE COMPARISON
                </ThemedText>

                <View style={[styles.detailsBox, { borderColor: colors.border }]}>
                  {/* Sources */}
                  <View style={styles.detailRow}>
                    <ThemedText style={[styles.detailLabel, { color: colors.mutedForeground }]}>
                      Repositories
                    </ThemedText>
                    <ThemedText style={[styles.detailValue, { color: colors.foreground }]}>
                      {mismatch.oldSource || 'Unknown'} ➔ {mismatch.newSource || 'Unknown'}
                    </ThemedText>
                  </View>

                  {/* Installed Cert */}
                  <View style={styles.certSection}>
                    <ThemedText style={[styles.certTitle, { color: colors.mutedForeground }]}>
                      Installed Signature (Trusted)
                    </ThemedText>
                    <ThemedText style={[styles.certFingerprint, { color: colors.foreground, backgroundColor: colors.surfaceContainer }]}>
                      {mismatch.oldFingerprint}
                    </ThemedText>
                  </View>

                  {/* Update Cert */}
                  <View style={styles.certSection}>
                    <ThemedText style={[styles.certTitle, { color: colors.destructive }]}>
                      Update Signature (Mismatch)
                    </ThemedText>
                    <ThemedText style={[styles.certFingerprint, { color: colors.foreground, backgroundColor: `${colors.destructive}11` }]}>
                      {mismatch.newFingerprint}
                    </ThemedText>
                  </View>
                </View>
              </ScrollView>

              {/* Action Footer */}
              <View style={[styles.footer, { borderTopColor: colors.border }]}>
                <Pressable
                  style={[styles.actionBtn, styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={() => setShowWarning(false)}
                >
                  <ThemedText style={[styles.btnText, { color: colors.foreground }]}>
                    Cancel (Safe)
                  </ThemedText>
                </Pressable>

                <Pressable
                  style={[styles.actionBtn, styles.proceedBtn, { backgroundColor: colors.destructive }]}
                  onPress={async () => {
                    setShowWarning(false);
                    await forceInstallTask(download.id);
                  }}
                >
                  <ThemedText style={[styles.btnText, { color: '#ffffff' }]}>
                    Trust & Install
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  splitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 24,
    minHeight: 44,
  },
  uninstallBtn: {
    borderColor: 'transparent',
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
    marginLeft: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 28,
    borderWidth: 1,
    paddingTop: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  warnHeader: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  warnTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  warnDesc: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  reasonsContainer: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginBottom: 20,
  },
  reasonsHeader: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  reasonBullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  reasonText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  detailsTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  detailsBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  certSection: {
    gap: 6,
  },
  certTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  certFingerprint: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    padding: 10,
    borderRadius: 8,
    lineHeight: 15,
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    padding: 16,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
  },
  proceedBtn: {
    elevation: 2,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
