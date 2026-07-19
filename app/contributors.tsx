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

const CONTRIBUTORS = [
  {
    section: 'Developer',
    icon: 'account-wrench' as const,
    people: [{ name: 'Core maintainer', contribution: 'Built and shipped the app experience.' }],
  },
  {
    section: 'Feature Suggestions',
    icon: 'lightbulb-on-outline' as const,
    people: [{ name: 'Community ideas', contribution: 'Shaped useful workflows and polish ideas.' }],
  },
  {
    section: 'Design Inspiration',
    icon: 'palette-outline' as const,
    people: [{ name: 'Modern Android UI', contribution: 'Inspired the clean cards, spacing, and motion.' }],
  },
  {
    section: 'Testers',
    icon: 'check-decagram-outline' as const,
    people: [{ name: 'Early adopters', contribution: 'Helped validate navigation and readability.' }],
  },
  {
    section: 'Special Thanks',
    icon: 'heart-outline' as const,
    people: [{ name: 'Everyone supporting SHEEN', contribution: 'Thank you for the encouragement and feedback.' }],
  },
] as const;

export default function ContributorsScreen() {
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
          <ThemedText style={[styles.eyebrow, { color: colors.primary, fontFamily: fonts.semibold }]}>Community</ThemedText>
          <ThemedText style={[styles.title, { color: colors.foreground, fontFamily: fonts.bold }]}>Contributors &amp; Special Thanks</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: fonts.regular }]}>
            Appreciation for the people and ideas that helped shape the app.
          </ThemedText>
        </Animated.View>

        {CONTRIBUTORS.map((group, index) => (
          <Animated.View
            key={group.section}
            entering={FadeInUp.delay(index * 90).duration(420).springify().damping(22).stiffness(140)}
            style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primary }]}>
                <MaterialCommunityIcons name={group.icon} size={22} color={colors.onPrimary} />
              </View>
              <ThemedText style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fonts.bold }]}>{group.section}</ThemedText>
            </View>

            {group.people.map((person) => (
              <View key={person.name} style={styles.personRow}>
                <ThemedText style={[styles.personName, { color: colors.foreground, fontFamily: fonts.semibold }]}>{person.name}</ThemedText>
                {person.contribution ? (
                  <ThemedText style={[styles.personContribution, { color: colors.mutedForeground, fontFamily: fonts.regular }]}>
                    {person.contribution}
                  </ThemedText>
                ) : null}
              </View>
            ))}
          </Animated.View>
        ))}
      </ScrollView>
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
  title: { fontSize: 32, letterSpacing: -0.6, lineHeight: 38 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  card: { borderRadius: 24, borderWidth: 1, padding: 20, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 18, letterSpacing: -0.2 },
  personRow: { paddingVertical: 10 },
  personName: { fontSize: 15, marginBottom: 3 },
  personContribution: { fontSize: 13, lineHeight: 19 },
});