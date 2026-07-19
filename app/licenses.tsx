import { ThemedText } from "@/components/ThemedText";
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Stack } from 'expo-router';

const LICENSES = [
  { name: 'React Native', license: 'MIT', url: 'https://github.com/facebook/react-native' },
  { name: 'Expo', license: 'MIT', url: 'https://github.com/expo/expo' },
  { name: 'React Navigation', license: 'MIT', url: 'https://github.com/react-navigation/react-navigation' },
  { name: 'Zustand', license: 'MIT', url: 'https://github.com/pmndrs/zustand' },
  { name: 'Reanimated', license: 'MIT', url: 'https://github.com/software-mansion/react-native-reanimated' },
  { name: 'FlashList', license: 'MIT', url: 'https://github.com/Shopify/flash-list' },
  { name: 'Axios', license: 'MIT', url: 'https://github.com/axios/axios' },
];

export default function LicensesScreen() {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Open Source Licenses', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        {LICENSES.map((l, i) => (
          <View key={i} style={[styles.card, { backgroundColor: colors.surface }]}>
            <ThemedText style={[styles.name, { color: colors.onSurface }]}>{l.name}</ThemedText>
            <ThemedText style={[styles.license, { color: colors.onSurfaceVariant }]}>{l.license} License</ThemedText>
            <ThemedText style={[styles.url, { color: colors.primary }]}>{l.url}</ThemedText>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  card: { padding: 16, borderRadius: 12, marginBottom: 12 },
  name: { fontSize: 16, fontWeight: 'bold' },
  license: { fontSize: 14, marginTop: 4 },
  url: { fontSize: 12, marginTop: 8 },
});
