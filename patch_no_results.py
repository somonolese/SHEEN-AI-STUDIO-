import os

file_path = '/app/applet/app/(tabs)/search.tsx'
with open(file_path, 'r') as f:
    content = f.read()

old_no_results = '''function NoResultsState({ query, colors, onClear }: { query: string; colors: ReturnType<typeof useColors>; onClear: () => void; }) {
  const router = useRouter();
  return (
    <EmptyState
      type="search"
      customSubtitle={`We couldn't find anything matching your search for "${query}". Try a different keyword or browse Categories.`}
      onPrimaryPress={onClear}
      onSecondaryPress={() => router.push('/categories')}
    />
  );
}'''

new_no_results = '''function NoResultsState({ query, colors, onClear }: { query: string; colors: ReturnType<typeof useColors>; onClear: () => void; }) {
  const router = useRouter();
  return (
    <Animated.View entering={FadeInUp.duration(400).springify().damping(22).stiffness(150)} style={[styles.emptyWrap, { flex: 1, paddingBottom: 100 }]}>
      <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceContainerHighest, marginBottom: 24, width: 110, height: 110, borderRadius: 55 }]}>
        <MaterialCommunityIcons name="magnify-close" size={48} color={colors.primary} />
      </View>
      <ThemedText style={[styles.emptyTitle, { color: colors.foreground, fontSize: 24, fontWeight: '700', marginBottom: 12, textAlign: 'center' }]}>No results found</ThemedText>
      <ThemedText style={[styles.emptySub, { color: colors.mutedForeground, fontSize: 15, marginBottom: 32, paddingHorizontal: 20 }]}>
        We couldn't find anything for "{query}". Check the spelling or try a different search term.
      </ThemedText>
      <AnimatedPressable onPress={onClear}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, backgroundColor: colors.primary, borderRadius: 20 }}>
          <MaterialCommunityIcons name="backspace-outline" size={20} color={colors.onPrimary} />
          <ThemedText style={{ color: colors.onPrimary, fontSize: 15, fontWeight: '600' }}>Clear Search</ThemedText>
        </View>
      </AnimatedPressable>
      <AnimatedPressable onPress={() => router.push('/categories')} style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, backgroundColor: 'transparent' }}>
          <ThemedText style={{ color: colors.primary, fontSize: 15, fontWeight: '600' }}>Browse Categories</ThemedText>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}'''

content = content.replace(old_no_results, new_no_results)

with open(file_path, 'w') as f:
    f.write(content)
print("Updated no results state")
