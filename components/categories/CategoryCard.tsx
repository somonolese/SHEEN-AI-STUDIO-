import React from 'react';
import { StyleSheet, View } from 'react-native';
import { materialCardEnter } from '../animations';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AnimatedPressable } from '@/components/AnimatedPressable';
import type { Category } from '@/lib/types';
import { ThemedText } from '@/components/ThemedText';

interface CategoryCardProps {
  category: Category;
  index: number;
  onPress: () => void;
  widthPercent?: `${number}%`;
}

export function CategoryCard({ category, index, onPress, widthPercent = '50%' }: CategoryCardProps) {
  return (
    <Animated.View
      entering={materialCardEnter(index, 0, 30)}
      style={[styles.container, { width: widthPercent }]}
    >
      <AnimatedPressable onPress={onPress} style={styles.pressable}>
        <LinearGradient
          colors={[category.color, `${category.color}CC`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient]}
        >
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name={(category.icon as any) || 'folder-outline'} size={28} color="#fff" />
          </View>
          <ThemedText style={styles.name} numberOfLines={1}>
            {category.name}
          </ThemedText>
          <View style={styles.badge}>
            <ThemedText style={styles.badgeText}>{category.appCount} apps</ThemedText>
          </View>
        </LinearGradient>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
    minWidth: 0,
  },
  pressable: {
    borderRadius: 28,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  gradient: {
    borderRadius: 28,
    padding: 18,
    minHeight: 164,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.1,
  },
});
