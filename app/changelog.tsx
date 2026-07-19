import React from 'react';
import { Platform, StatusBar, StyleSheet, View, useColorScheme, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import Animated, { Easing, FadeIn, FadeInUp } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useTypography } from '@/hooks/useTypography';
import { AnimatedPressable } from '@/components/settings/SettingsPrimitives';
import { ThemedText } from '@/components/ThemedText';

const CHANGELOG = [
  {
    version: '1.1.0',
    date: 'August 2026',
    added: ['Refined settings surfaces for a smoother in-app experience.', 'Improved changelog and contributors pages.'],
    changed: ['Polished typography and spacing across secondary screens.', 'Updated visual hierarchy for better readability.'],
    fixed: ['Resolved minor layout inconsistencies on smaller devices.'],
  },
  {
    version: '1.0.0',
    date: 'July 2026',
    added: ['Initial release of SHEEN with core app flows.', 'Launch of app details, notifications, and support pages.'],
    changed: ['Established the initial visual language and navigation patterns.'],
    fixed: ['N/A'],
  },
] as const;

export default function ChangelogScreen() {
  const colors = useColors();
  const fonts = useTypography();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();

  const topPad = 0;
  const bottomPad = Platform.OS === 'web' ? 34 + 40 : insets.bottom + 24;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad, paddingTop: topPad }]} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(420).easing(Easing.out(Easing.cubic))} style={styles.hero}>
          <ThemedText style={[styles.eyebrow, { color: colors.primary, fontFamily: fonts.semibold }]}>What&apos;s new</ThemedText>
          <ThemedText style={[styles.title, { color: colors.foreground, fontFamily: fonts.bold }]}>Changelog</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: fonts.regular }]}>
            A running record of changes, improvements, and fixes.
          </ThemedText>
        </Animated.View>

        {CHANGELOG.map((entry, index) => (
          <Animated.View
            key={entry.version}
            entering={FadeInUp.delay(index * 90).duration(420).springify().damping(22).stiffness(140)}
            style={[styles.versionCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}
          >
            <View style={styles.versionHeader}>
              <View>
                <ThemedText style={[styles.version, { color: colors.foreground, fontFamily: fonts.bold }]}>{entry.version}</ThemedText>
                <ThemedText style={[styles.date, { color: colors.mutedForeground, fontFamily: fonts.medium }]}>{entry.date}</ThemedText>
              </View>
              <MaterialCommunityIcons name="source-commit" size={24} color={colors.primary} />
            </View>

            {renderSection('Added', entry.added, colors, fonts)}
            {renderSection('Changed', entry.changed, colors, fonts)}
            {renderSection('Fixed', entry.fixed, colors, fonts)}
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

function renderSection(title: string, items: readonly string[], colors: ReturnType<typeof useColors>, fonts: ReturnType<typeof useTypography>) {
  return (
    <View style={styles.section}>
      <ThemedText style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fonts.semibold }]}>{title}</ThemedText>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
          <ThemedText style={[styles.bulletText, { color: colors.mutedForeground, fontFamily: fonts.regular }]}>{item}</ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20 },
  hero: { marginTop: 18, marginBottom: 24, gap: 6 },
  eyebrow: { fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 34, letterSpacing: -0.6, lineHeight: 40 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  versionCard: { borderRadius: 24, borderWidth: 1, padding: 22, marginBottom: 16 },
  versionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  version: { fontSize: 24, letterSpacing: -0.3 },
  date: { marginTop: 4, fontSize: 13 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, marginBottom: 10 },
  bulletRow: { flexDirection: 'row', gap: 10, marginBottom: 8, paddingRight: 4 },
  bullet: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 21 },
});