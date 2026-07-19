import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface ChangelogRendererProps {
  changelog?: string;
  colors: any;
}

export function parseInlineStyles(text: string, baseStyle: any, colors: any) {
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const parts = text.split(regex);
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const content = part.slice(2, -2);
      return (
        <ThemedText key={index} style={[baseStyle, { fontWeight: '700' }]}>
          {content}
        </ThemedText>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      const content = part.slice(1, -1);
      return (
        <ThemedText key={index} style={[baseStyle, { fontStyle: 'italic' }]}>
          {content}
        </ThemedText>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      const content = part.slice(1, -1);
      return (
        <ThemedText 
          key={index} 
          style={[
            baseStyle, 
            { 
              fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
              backgroundColor: colors.surfaceVariant || 'rgba(150, 150, 150, 0.15)',
              paddingHorizontal: 4,
              borderRadius: 4,
              fontSize: (baseStyle.fontSize || 13) - 1,
            }
          ]}
        >
          {content}
        </ThemedText>
      );
    }
    return (
      <ThemedText key={index} style={baseStyle}>
        {part}
      </ThemedText>
    );
  });
}

export function ChangelogRenderer({ changelog, colors }: ChangelogRendererProps) {
  if (!changelog || changelog.trim() === '') {
    return (
      <View style={[styles.card, { backgroundColor: colors.surfaceContainer || colors.surfaceVariant, borderColor: colors.border }]}>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="text-box-remove-outline" size={20} color={colors.mutedForeground} />
          <ThemedText style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No release notes provided by the developer.
          </ThemedText>
        </View>
      </View>
    );
  }

  const lines = changelog.split('\n');

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainer || colors.surfaceVariant, borderColor: colors.border }]}>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (trimmed === '') {
          return <View key={index} style={styles.spacer} />;
        }

        // Check if list item
        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ') || trimmed.startsWith('+ ');
        if (isBullet) {
          const content = trimmed.slice(2).trim();
          return (
            <View key={index} style={styles.bulletRow}>
              <ThemedText style={[styles.bulletSign, { color: colors.primary }]}>•</ThemedText>
              <View style={styles.bulletTextWrap}>
                <ThemedText style={styles.bulletText}>
                  {parseInlineStyles(content, { fontSize: 13, lineHeight: 18, color: colors.foreground }, colors)}
                </ThemedText>
              </View>
            </View>
          );
        }

        // Check if header (starts with #)
        const isHeader = trimmed.startsWith('#');
        if (isHeader) {
          // Count #
          let depth = 0;
          while (depth < trimmed.length && trimmed[depth] === '#') {
            depth++;
          }
          const content = trimmed.slice(depth).trim();
          const fontSize = depth === 1 ? 16 : depth === 2 ? 15 : 14;
          return (
            <ThemedText key={index} style={[styles.headerText, { fontSize, color: colors.foreground, marginTop: index > 0 ? 10 : 0, marginBottom: 4 }]}>
              {content}
            </ThemedText>
          );
        }

        // Regular paragraph line
        return (
          <ThemedText key={index} style={styles.paragraphText}>
            {parseInlineStyles(trimmed, { fontSize: 13, lineHeight: 18, color: colors.foreground }, colors)}
          </ThemedText>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  emptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  spacer: {
    height: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingLeft: 4,
    marginBottom: 2,
  },
  bulletSign: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  bulletTextWrap: {
    flex: 1,
  },
  bulletText: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  headerText: {
    fontWeight: '700',
  },
  paragraphText: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
});
