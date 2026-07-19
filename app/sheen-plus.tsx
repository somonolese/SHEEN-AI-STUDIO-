import React from 'react';
import { View, StyleSheet, ScrollView, Platform, Share, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { Easing, FadeIn, FadeInUp } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';

import { useColors } from '@/hooks/useColors';
import { useTypography } from '@/hooks/useTypography';
import { ThemedText } from '@/components/ThemedText';
import { AnimatedPressable } from '@/components/settings/SettingsPrimitives';
import * as Haptics from 'expo-haptics';
import { SheenIcon } from '@/components/SheenIcon';

const UPI_ID = '6006029540@fam';

function BenefitRow({ icon, title, description, colors, fonts }: { icon: any; title: string; description: string; colors: ReturnType<typeof useColors>, fonts: ReturnType<typeof useTypography> }) {
  return (
    <View style={styles.benefitRow}>
      <View style={[styles.benefitIconWrap, { backgroundColor: colors.surfaceContainer }]}>
        <MaterialCommunityIcons name={icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.benefitTextWrap}>
        <ThemedText style={[styles.benefitTitle, { color: colors.foreground, fontFamily: fonts.medium }]}>{title}</ThemedText>
        <ThemedText style={[styles.benefitSub, { color: colors.mutedForeground, fontFamily: fonts.regular }]}>{description}</ThemedText>
      </View>
    </View>
  );
}

export default function SheenPlusScreen() {
  const colors = useColors();
  const fonts = useTypography();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const haptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 34 + 40 : insets.bottom + 24;

  const handleCopyUPI = async () => {
    try {
      await Clipboard.setStringAsync(UPI_ID);
      Alert.alert('Copied', 'UPI ID copied to clipboard.');
    } catch {
      Alert.alert('Copy failed', 'Please copy the UPI ID manually.');
    }
  };

  const handleShareUPI = async () => {
    try {
      await Share.share({
        message: `Support SHEEN by donating via UPI: ${UPI_ID}`,
      });
    } catch {
      // User cancelled or share failed; no action needed.
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style="auto" />
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView 
        contentContainerStyle={[styles.scroll, { paddingTop: topPad, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <AnimatedPressable 
            style={[styles.backButton, { backgroundColor: colors.surfaceContainer }]} 
            onPress={() => { haptic(); router.back(); }}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.foreground} />
          </AnimatedPressable>
        </View>

        {/* ── Hero title ── */}
        <Animated.View
          entering={FadeIn.duration(520).easing(Easing.out(Easing.cubic))}
          style={styles.hero}
        >
          <SheenIcon size={64} style={styles.heroIcon} />
          <ThemedText style={[styles.heroTitle, { color: colors.foreground, fontFamily: fonts.bold }]}>
            SHEEN+
          </ThemedText>
          <ThemedText
            style={[
              styles.heroSubtitle,
              { color: colors.mutedForeground, fontFamily: fonts.medium },
            ]}
          >
            Support the development of SHEEN
          </ThemedText>
        </Animated.View>

        {/* ── Benefits ── */}
        <Animated.View entering={FadeInUp.delay(80).duration(600).springify().damping(20)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <BenefitRow 
            colors={colors}
            fonts={fonts}
            icon="heart-outline" 
            title="Support Independent Development" 
            description="SHEEN is built by independent developers. Your support keeps the project alive and growing."
          />
          <BenefitRow 
            colors={colors}
            fonts={fonts}
            icon="server-network-outline" 
            title="Help Cover Server Costs" 
            description="Running metadata servers, caches, and APIs requires ongoing monthly resources."
          />
          <View style={styles.benefitRowLast}>
            <View style={[styles.benefitIconWrap, { backgroundColor: colors.surfaceContainer }]}>
              <MaterialCommunityIcons name="creation-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.benefitTextWrap}>
              <ThemedText style={[styles.benefitTitle, { color: colors.foreground, fontFamily: fonts.medium }]}>Future Supporter Perks</ThemedText>
              <ThemedText style={[styles.benefitSub, { color: colors.mutedForeground, fontFamily: fonts.regular }]}>We plan to add optional cosmetic perks for supporters (e.g., special profile badges, exclusive app icons). Essential features will always be free.</ThemedText>
            </View>
          </View>
        </Animated.View>

        {/* ── Donation UPI card ── */}
        <Animated.View
          entering={FadeInUp.delay(160).duration(520).springify().damping(22).stiffness(140)}
          style={styles.section}
        >
          <ThemedText style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fonts.bold }]}>
            Ways to Support
          </ThemedText>
          <View
            style={[
              styles.upiCard,
              { backgroundColor: colors.primaryContainer, borderColor: colors.border },
            ]}
          >
            <ThemedText
              style={[
                styles.upiLabel,
                { color: colors.onPrimaryContainer, fontFamily: fonts.semibold },
              ]}
            >
              {UPI_ID}
            </ThemedText>
            <ThemedText
              style={[
                styles.upiId,
                { color: colors.onPrimaryContainer, fontFamily: fonts.bold },
              ]}
            >
              Tap to support SHEEN
            </ThemedText>
            <View style={styles.upiActions}>
              <AnimatedPressable
                onPress={handleCopyUPI}
                style={[styles.upiBtn, { backgroundColor: colors.primary }]}
              >
                <MaterialCommunityIcons name="content-copy" size={18} color={colors.onPrimary} />
                <ThemedText
                  style={[
                    styles.upiBtnText,
                    { color: colors.onPrimary, fontFamily: fonts.semibold },
                  ]}
                >
                  Copy UPI
                </ThemedText>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={handleShareUPI}
                style={[styles.upiBtn, { backgroundColor: colors.secondaryContainer }]}
              >
                <MaterialCommunityIcons
                  name="share-variant"
                  size={18}
                  color={colors.onSecondaryContainer}
                />
                <ThemedText
                  style={[
                    styles.upiBtnText,
                    { color: colors.onSecondaryContainer, fontFamily: fonts.semibold },
                  ]}
                >
                  Share UPI
                </ThemedText>
              </AnimatedPressable>
            </View>
          </View>
        </Animated.View>

        {/* ── Thank you ── */}
        <Animated.View
          entering={FadeInUp.delay(240).duration(520).springify().damping(22).stiffness(140)}
          style={styles.messageCard}
        >
          <View style={[styles.messageCardInner, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
            <MaterialCommunityIcons
              name="heart-outline"
              size={28}
              color={colors.primary}
              style={styles.messageIcon}
            />
            <ThemedText
              style={[
                styles.messageText,
                { color: colors.mutedForeground, fontFamily: fonts.regular },
              ]}
            >
              SHEEN is built with ❤️ in Kashmir and will always remain free and open source. Your
              support helps improve the project, fix bugs, and add new features for everyone.
            </ThemedText>
          </View>
        </Animated.View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', marginTop: 8, marginBottom: 26, gap: 6 },
  heroIcon: { borderRadius: 18, overflow: 'hidden', marginBottom: 6 },
  heroTitle: { fontSize: 34, letterSpacing: -0.5, lineHeight: 40 },
  heroSubtitle: { fontSize: 15, letterSpacing: 0.1, textAlign: 'center' },
  card: { borderRadius: 24, padding: 20, borderWidth: 1, marginBottom: 32 },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  benefitRowLast: { flexDirection: 'row', alignItems: 'flex-start' },
  benefitIconWrap: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  benefitTextWrap: { flex: 1 },
  benefitTitle: { fontSize: 16, marginBottom: 4, letterSpacing: -0.1 },
  benefitSub: { fontSize: 14, lineHeight: 20 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, letterSpacing: -0.2, marginBottom: 14 },
  upiCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  upiLabel: { fontSize: 13, letterSpacing: 0.4, marginBottom: 6 },
  upiId: { fontSize: 22, letterSpacing: 0.4, marginBottom: 20 },
  upiActions: { flexDirection: 'row', gap: 12, width: '100%' },
  upiBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 20,
  },
  upiBtnText: { fontSize: 14, letterSpacing: 0.1 },
  messageCard: { marginBottom: 28 },
  messageCardInner: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
  },
  messageIcon: { marginBottom: 12 },
  messageText: { fontSize: 14, lineHeight: 22, textAlign: 'center', letterSpacing: 0.1 },
});
