import os

file_path = '/app/applet/app/(tabs)/search.tsx'
with open(file_path, 'r') as f:
    content = f.read()

import re
old_filter = 'function FilterChip({ item, active, onPress, colors }: { item: (typeof FILTERS)[number]; active: boolean; onPress: () => void; colors: ReturnType<typeof useColors>; }) {\n  return <AnimatedPressable onPress={onPress}><View style={[styles.filterChip, active ? { backgroundColor: colors.secondaryContainer } : { backgroundColor: colors.surfaceContainer, borderColor: colors.border, borderWidth: 1 }]}><MaterialCommunityIcons name={item.icon} size={15} color={active ? colors.onSecondaryContainer : colors.onSurfaceVariant} /><ThemedText style={[styles.filterChipLabel, { color: active ? colors.onSecondaryContainer : colors.onSurfaceVariant }]}>{item.label}</ThemedText></View></AnimatedPressable>;\n}'

new_filter = '''import { LinearTransition } from 'react-native-reanimated';

function FilterChip({ item, active, onPress, colors }: { item: (typeof FILTERS)[number]; active: boolean; onPress: () => void; colors: ReturnType<typeof useColors>; }) {
  return (
    <AnimatedPressable onPress={onPress}>
      <Animated.View layout={LinearTransition.springify().damping(22).stiffness(150)} style={[styles.filterChip, active ? { backgroundColor: colors.primary, borderColor: colors.primary, borderWidth: 1 } : { backgroundColor: colors.surfaceContainer, borderColor: colors.border, borderWidth: 1 }]}>
        <MaterialCommunityIcons name={item.icon} size={15} color={active ? colors.onPrimary : colors.onSurfaceVariant} />
        <ThemedText style={[styles.filterChipLabel, { color: active ? colors.onPrimary : colors.onSurfaceVariant }]}>{item.label}</ThemedText>
      </Animated.View>
    </AnimatedPressable>
  );
}'''
content = content.replace(old_filter, new_filter)

with open(file_path, 'w') as f:
    f.write(content)
print("Updated filter chip")
