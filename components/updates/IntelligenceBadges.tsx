import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffectiveColorScheme } from '@/hooks/useColors';
import { UpdateCategory, UpdateBadge } from '@/lib/services/UpdateIntelligence';

interface CategoryBadgeProps {
  category: UpdateCategory;
  compact?: boolean;
}

export function CategoryBadge({ category, compact = false }: CategoryBadgeProps) {
  const scheme = useEffectiveColorScheme();
  const isDark = scheme === 'dark';

  let label = 'General Update';
  let iconName: any = 'update';
  let bgColor = isDark ? '#2A292D' : '#F5F5F5';
  let textColor = isDark ? '#E5E4E8' : '#1C1B1F';
  let borderColor = isDark ? '#49454F' : '#D1D0D4';

  switch (category) {
    case 'Security':
      label = 'Security Update';
      iconName = 'shield-lock-outline';
      bgColor = isDark ? '#143821' : '#E8F5E9';
      textColor = isDark ? '#A3E2B9' : '#1B5E20';
      borderColor = isDark ? '#1C4F2E' : '#C8E6C9';
      break;
    case 'Feature':
      label = 'Feature Update';
      iconName = 'star-outline';
      bgColor = isDark ? '#112D55' : '#E3F2FD';
      textColor = isDark ? '#8EC5FC' : '#0D47A1';
      borderColor = isDark ? '#1A3F74' : '#BBDEFB';
      break;
    case 'BugFix':
      label = 'Bug Fix Update';
      iconName = 'bug-outline';
      bgColor = isDark ? '#4E3A10' : '#FFFDE7';
      textColor = isDark ? '#FFD066' : '#B25900';
      borderColor = isDark ? '#6E5218' : '#FFE082';
      break;
    case 'Maintenance':
      label = 'Maintenance';
      iconName = 'wrench-outline';
      bgColor = isDark ? '#2C323D' : '#F5F5F5';
      textColor = isDark ? '#CBD5E0' : '#4A5568';
      borderColor = isDark ? '#3D4554' : '#E2E8F0';
      break;
  }

  return (
    <View style={[
      styles.badgeContainer, 
      { backgroundColor: bgColor, borderColor: borderColor, paddingVertical: compact ? 2 : 4, paddingHorizontal: compact ? 8 : 12 }
    ]}>
      <MaterialCommunityIcons name={iconName} size={compact ? 12 : 16} color={textColor} />
      <ThemedText style={[styles.badgeText, { color: textColor, fontSize: compact ? 11 : 12.5 }]}>
        {label}
      </ThemedText>
    </View>
  );
}

interface UpdateBadgesListProps {
  badges: UpdateBadge[];
  compact?: boolean;
}

export function UpdateBadgesList({ badges, compact = false }: UpdateBadgesListProps) {
  const scheme = useEffectiveColorScheme();
  const isDark = scheme === 'dark';

  if (!badges || badges.length === 0) return null;

  return (
    <View style={styles.listContainer}>
      {badges.map((badge) => {
        let iconName: any = 'tag-outline';
        let bgColor = isDark ? '#22252A' : '#F1F3F5';
        let textColor = isDark ? '#E2E8F0' : '#495057';
        let borderColor = isDark ? '#2F343F' : '#DEE2E6';

        switch (badge) {
          case 'Security':
            iconName = 'shield-outline';
            bgColor = isDark ? '#122D1E' : '#E6F4EA';
            textColor = isDark ? '#81C784' : '#137333';
            borderColor = isDark ? '#1A422B' : '#CEEAD6';
            break;
          case 'Bug Fix':
            iconName = 'bug-outline';
            bgColor = isDark ? '#3A1E1E' : '#FCE8E6';
            textColor = isDark ? '#E57373' : '#C5221F';
            borderColor = isDark ? '#532B2B' : '#FAD2CF';
            break;
          case 'Features':
            iconName = 'plus';
            bgColor = isDark ? '#0D2B45' : '#E8F0FE';
            textColor = isDark ? '#64B5F6' : '#174EA6';
            borderColor = isDark ? '#143E62' : '#D2E3FC';
            break;
          case 'Performance':
            iconName = 'flash-outline';
            bgColor = isDark ? '#2D164D' : '#F3E5F5';
            textColor = isDark ? '#BA68C8' : '#7B1FA2';
            borderColor = isDark ? '#41206D' : '#E1BEE7';
            break;
          case 'UI Improvements':
            iconName = 'palette-outline';
            bgColor = isDark ? '#00332C' : '#E0F2F1';
            textColor = isDark ? '#4DB6AC' : '#00796B';
            borderColor = isDark ? '#004D43' : '#B2DFDB';
            break;
        }

        return (
          <View key={badge} style={[
            styles.chipContainer, 
            { backgroundColor: bgColor, borderColor: borderColor, paddingVertical: compact ? 1 : 3, paddingHorizontal: compact ? 6 : 10 }
          ]}>
            <MaterialCommunityIcons name={iconName} size={compact ? 11 : 13} color={textColor} />
            <ThemedText style={[styles.chipText, { color: textColor, fontSize: compact ? 10 : 11.5 }]}>
              {badge}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontWeight: '700',
  },
  listContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  chipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipText: {
    fontWeight: '600',
  },
});
