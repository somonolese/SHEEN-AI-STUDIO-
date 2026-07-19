import React, { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View, ScrollView } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ThemedText } from '@/components/ThemedText';
import { AnimatedPressable } from '@/components/settings/SettingsPrimitives';
import { formatBytes } from '@/hooks/useDownloads';
import { VersionHistoryEntry } from '@/constants/updates';

/**
 * Bottom sheet for browsing an app's version history and rolling back to an
 * older release. Reused from both the App Details screen and the Updates
 * screen. Rollback always requires an explicit confirmation dialog that
 * calls out compatibility risk, per SHEEN's rollback safety requirements.
 */
export function VersionHistorySheet({
  appName,
  currentVersionCode,
  history,
  onClose,
  onRollback,
  bottomInset,
}: {
  appName: string;
  currentVersionCode: number;
  history: VersionHistoryEntry[];
  onClose: () => void;
  onRollback: (entry: VersionHistoryEntry) => void;
  bottomInset: number;
}) {
  const colors = useColors();
  const [confirming, setConfirming] = useState<VersionHistoryEntry | null>(null);

  const requestRollback = (entry: VersionHistoryEntry) => {
    if (Platform.OS === 'web') {
      setConfirming(entry);
      return;
    }
    Alert.alert(
      `Install version ${entry.versionName}?`,
      `This will roll ${appName} back to an older version. Older versions may be incompatible with your data, may not receive security fixes, and some features may not work as expected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Install Anyway', style: 'destructive', onPress: () => onRollback(entry) },
      ],
    );
  };

  return (
    <View style={styles.overlay}>
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={styles.backdrop}
      >
        <AnimatedPressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.springify().damping(22).stiffness(160).mass(0.9)}
        exiting={SlideOutDown.springify().damping(28).stiffness(220).mass(0.8).overshootClamping(true)}
        style={[styles.sheet, { backgroundColor: colors.surfaceContainerHigh, paddingBottom: Math.max(bottomInset, 20) }]}
      >
        <View style={[styles.handle, { backgroundColor: colors.outline }]} />
        <ThemedText style={[styles.title, { color: colors.foreground }]}>Version History</ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.mutedForeground }]}>{appName}</ThemedText>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {history.map((entry) => {
            const isCurrent = entry.versionCode === currentVersionCode;
            return (
              <View
                key={entry.versionCode}
                style={[styles.entry, { borderColor: colors.border }]}
              >
                <View style={styles.entryHeader}>
                  <ThemedText style={[styles.entryVersion, { color: colors.foreground }]}>
                    v{entry.versionName}
                  </ThemedText>
                  {isCurrent && (
                    <View style={[styles.currentPill, { backgroundColor: colors.secondaryContainer }]}>
                      <ThemedText style={[styles.currentPillText, { color: colors.onSecondaryContainer }]}>
                        Installed
                      </ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText style={[styles.entryMeta, { color: colors.mutedForeground }]}>
                  {entry.releaseDate} · {formatBytes(entry.sizeBytes)}
                </ThemedText>
                <ThemedText style={[styles.entryChangelog, { color: colors.onSurfaceVariant }]}>
                  {entry.changelog}
                </ThemedText>

                {!isCurrent && (
                  confirming?.versionCode === entry.versionCode ? (
                    <View style={[styles.confirmBox, { backgroundColor: `${colors.destructive}14`, borderColor: colors.destructive }]}>
                      <MaterialCommunityIcons name="alert-outline" size={16} color={colors.destructive} />
                      <ThemedText style={[styles.confirmText, { color: colors.destructive }]}>
                        Older versions may be incompatible with your data and won't receive security fixes.
                      </ThemedText>
                      <View style={styles.confirmActions}>
                        <AnimatedPressable onPress={() => setConfirming(null)} style={styles.confirmCancel}>
                          <ThemedText style={{ color: colors.mutedForeground, fontWeight: '600' }}>Cancel</ThemedText>
                        </AnimatedPressable>
                        <AnimatedPressable
                          onPress={() => { setConfirming(null); onRollback(entry); }}
                          style={[styles.confirmInstall, { backgroundColor: colors.destructive }]}
                        >
                          <ThemedText style={{ color: colors.destructiveForeground, fontWeight: '700' }}>
                            Install Anyway
                          </ThemedText>
                        </AnimatedPressable>
                      </View>
                    </View>
                  ) : (
                    <AnimatedPressable
                      onPress={() => requestRollback(entry)}
                      style={[styles.rollbackBtn, { borderColor: colors.border }]}
                    >
                      <MaterialCommunityIcons name="history" size={16} color={colors.primary} />
                      <ThemedText style={[styles.rollbackText, { color: colors.primary }]}>
                        Install this version
                      </ThemedText>
                    </AnimatedPressable>
                  )
                )}
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, paddingHorizontal: 24, maxHeight: '80%' },
  handle: { width: 32, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  subtitle: { fontSize: 13, marginBottom: 14 },
  list: { marginBottom: 8 },
  entry: { borderTopWidth: 1, paddingVertical: 16, gap: 4 },
  entryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryVersion: { fontSize: 15, fontWeight: '700' },
  currentPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  currentPillText: { fontSize: 11, fontWeight: '700' },
  entryMeta: { fontSize: 12 },
  entryChangelog: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  rollbackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1, alignSelf: 'flex-start',
  },
  rollbackText: { fontSize: 13, fontWeight: '700' },
  confirmBox: { marginTop: 10, padding: 12, borderRadius: 14, borderWidth: 1, gap: 8 },
  confirmText: { fontSize: 12.5, lineHeight: 17 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 2 },
  confirmCancel: { paddingVertical: 8, paddingHorizontal: 4 },
  confirmInstall: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
});
