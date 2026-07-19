import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from './ThemedText';

const SOURCE_CONFIG: Record<string, { color: string; bg: string }> = {
  'F-Droid':     { color: '#1B5E20', bg: '#E8F5E9' },
  'GitHub':      { color: '#1565C0', bg: '#E3F2FD' },
  'IzzyOnDroid': { color: '#BF360C', bg: '#FBE9E7' },
};

export function SourceBadge({ source, dark }: { source: string; dark?: boolean }) {
  const cfg = SOURCE_CONFIG[source] || { color: '#455A64', bg: '#ECEFF1' };
  
  return (
    <View style={[
      styles.sourceBadge, 
      { backgroundColor: dark ? 'rgba(0,0,0,0.5)' : cfg.bg },
      dark && { borderColor: 'rgba(255,255,255,0.2)', borderWidth: 1 }
    ]}>
      <ThemedText style={[
        styles.sourceBadgeText, 
        { color: dark ? '#fff' : cfg.color }
      ]}>
        {source}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  sourceBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  sourceBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
});
