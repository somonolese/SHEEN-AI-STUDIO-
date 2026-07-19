import os

file_path = '/app/applet/app/(tabs)/search.tsx'
with open(file_path, 'r') as f:
    content = f.read()

import re

# 1. Add suggestions hook
old_hasquery = 'const hasQuery = query.trim().length > 0;'
new_hasquery = '''const hasQuery = query.trim().length > 0;
  const suggestions = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    const names = results.map(r => r.name);
    return Array.from(new Set(names)).filter(n => n.toLowerCase().startsWith(q) && n.toLowerCase() !== q).slice(0, 4);
  }, [results, query]);'''
content = content.replace(old_hasquery, new_hasquery)

# 2. Render suggestions row
old_filters = '''            <Animated.View entering={FadeInDown.springify().damping(18).stiffness(160).mass(0.8)} exiting={FadeOut.duration(180)}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {FILTERS.map((f) => <FilterChip key={f.id} item={f} active={activeFilter === f.id} onPress={() => setActiveFilter(f.id)} colors={colors} />)}
              </ScrollView>'''
new_filters = '''            <Animated.View entering={FadeInDown.springify().damping(18).stiffness(160).mass(0.8)} exiting={FadeOut.duration(180)}>
              {suggestions.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterRow, { paddingBottom: 12 }]}>
                  {suggestions.map((s, idx) => (
                    <Animated.View key={s} entering={FadeInDown.delay(idx * 30).springify().damping(20).stiffness(150)}>
                      <AnimatedPressable onPress={() => { setQuery(s); inputRef.current?.blur(); }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, backgroundColor: colors.surfaceContainerHighest }}>
                          <MaterialCommunityIcons name="magnify" size={14} color={colors.primary} />
                          <ThemedText style={{ fontSize: 13, color: colors.foreground, fontWeight: '500' }}>{s}</ThemedText>
                        </View>
                      </AnimatedPressable>
                    </Animated.View>
                  ))}
                </ScrollView>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {FILTERS.map((f) => <FilterChip key={f.id} item={f} active={activeFilter === f.id} onPress={() => setActiveFilter(f.id)} colors={colors} />)}
              </ScrollView>'''
content = content.replace(old_filters, new_filters)

with open(file_path, 'w') as f:
    f.write(content)
print("Updated suggestions")
