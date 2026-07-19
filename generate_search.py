import re

file_path = '/app/applet/app/(tabs)/search.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# I will write a script that replaces specific parts of the search file.

# 1. Add HighlightedText component
highlight_comp = '''
function HighlightedText({ text, query, style, highlightStyle, numberOfLines }: { text: string; query: string; style: any; highlightStyle: any; numberOfLines?: number; }) {
  if (!query) return <ThemedText style={style} numberOfLines={numberOfLines}>{text}</ThemedText>;
  
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <ThemedText style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() 
          ? <ThemedText key={i} style={[style, highlightStyle]}>{part}</ThemedText>
          : part
      )}
    </ThemedText>
  );
}
'''
if 'HighlightedText' not in content:
    content = content.replace('function ResultCard', highlight_comp + '\nfunction ResultCard')

# 2. Update ResultCard to use HighlightedText for name
result_card_name_old = '''<ThemedText style={[styles.resultName, { color: colors.foreground }]} numberOfLines={1}>{app.name}</ThemedText>'''
result_card_name_new = '''<HighlightedText text={app.name} query={query} style={[styles.resultName, { color: colors.foreground }]} highlightStyle={{ color: colors.primary, backgroundColor: `${colors.primary}33` }} numberOfLines={1} />'''
# wait, ResultCard doesn't have query passed to it. Let's pass it.
# We'll replace the ResultCard definition first.
old_result_def = 'function ResultCard({ app, index, favorited, onToggleFavorite, onPress, colors }: { app: App; index: number; favorited: boolean; onToggleFavorite: () => void; onPress?: () => void; colors: ReturnType<typeof useColors>; }) {'
new_result_def = 'function ResultCard({ app, index, favorited, onToggleFavorite, onPress, colors, query = "" }: { app: App; index: number; favorited: boolean; onToggleFavorite: () => void; onPress?: () => void; colors: ReturnType<typeof useColors>; query?: string; }) {'
content = content.replace(old_result_def, new_result_def)
content = content.replace(result_card_name_old, result_card_name_new)

# 3. Pass query to ResultCard where it is rendered
old_result_render = '''                      <ResultCard
                        app={item}
                        index={index}
                        favorited={isInBasket(item.id)}
                        onToggleFavorite={() => toggleFavorite(item)}
                        onPress={() => openDetails(item.id)}
                        colors={colors}
                      />'''
new_result_render = '''                      <ResultCard
                        app={item}
                        index={index}
                        favorited={isInBasket(item.id)}
                        onToggleFavorite={() => toggleFavorite(item)}
                        onPress={() => openDetails(item.id)}
                        colors={colors}
                        query={query.trim()}
                      />'''
content = content.replace(old_result_render, new_result_render)

# 4. Update RecentRow
old_recent = '''function RecentRow({ term, onPress, onRemove, index, colors }: { term: string; onPress: () => void; onRemove: () => void; index: number; colors: ReturnType<typeof useColors>; }) {
  return <Animated.View entering={FadeInUp.delay(index * 40).duration(360).springify().damping(24).stiffness(180)}><AnimatedPressable style={[styles.recentRow, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]} onPress={onPress}><MaterialCommunityIcons name="history" size={18} color={colors.mutedForeground} /><ThemedText style={[styles.recentText, { color: colors.foreground }]} numberOfLines={1}>{term}</ThemedText><Pressable onPress={stopPropagation(onRemove)} hitSlop={12} style={styles.recentRemoveBtn}><MaterialCommunityIcons name="close" size={16} color={colors.mutedForeground} /></Pressable></AnimatedPressable></Animated.View>;
}'''
new_recent = '''function RecentRow({ term, onPress, onRemove, index, colors }: { term: string; onPress: () => void; onRemove: () => void; index: number; colors: ReturnType<typeof useColors>; }) {
  return (
    <Animated.View entering={FadeInUp.delay(index * 40).duration(360).springify().damping(24).stiffness(180)}>
      <AnimatedPressable style={[styles.recentRow, { backgroundColor: 'transparent', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 0, paddingHorizontal: 20, marginHorizontal: 0 }]} onPress={onPress}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="history" size={16} color={colors.mutedForeground} />
        </View>
        <ThemedText style={[styles.recentText, { color: colors.foreground, fontWeight: '500' }]} numberOfLines={1}>{term}</ThemedText>
        <Pressable onPress={stopPropagation(onRemove)} hitSlop={12} style={styles.recentRemoveBtn}>
          <MaterialCommunityIcons name="close" size={18} color={colors.mutedForeground} />
        </Pressable>
      </AnimatedPressable>
    </Animated.View>
  );
}'''
content = content.replace(old_recent, new_recent)

# 5. Update PopularChip (Trending)
old_popular = '''function PopularChip({ label, onPress, colors }: { label: string; onPress: () => void; colors: ReturnType<typeof useColors>; }) {
  return <AnimatedPressable onPress={onPress}><View style={[styles.popularChip, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}><MaterialCommunityIcons name="trending-up" size={13} color={colors.primary} /><ThemedText style={[styles.popularChipText, { color: colors.foreground }]}>{label}</ThemedText></View></AnimatedPressable>;
}'''
new_popular = '''function PopularChip({ label, onPress, colors, index }: { label: string; onPress: () => void; colors: ReturnType<typeof useColors>; index: number; }) {
  return (
    <Animated.View entering={FadeInUp.delay(index * 30).springify().damping(22).stiffness(150)}>
      <AnimatedPressable onPress={onPress}>
        <View style={[styles.popularChip, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="fire" size={16} color={colors.primary} />
          <ThemedText style={[styles.popularChipText, { color: colors.foreground, fontWeight: '500' }]}>{label}</ThemedText>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}'''
content = content.replace(old_popular, new_popular)

# Need to update mapping of PopularChip in PreSearchState
old_popular_map = '''{POPULAR_SEARCHES.map((term) => <PopularChip key={term} label={term} colors={colors} onPress={() => onSelectSearch(term)} />)}'''
new_popular_map = '''{POPULAR_SEARCHES.map((term, idx) => <PopularChip key={term} label={term} index={idx} colors={colors} onPress={() => onSelectSearch(term)} />)}'''
content = content.replace(old_popular_map, new_popular_map)

# Change "Popular" to "Trending"
old_popular_title = '''<ThemedText style={[styles.sectionTitle, { color: colors.foreground }]}>Popular</ThemedText>'''
new_popular_title = '''<ThemedText style={[styles.sectionTitle, { color: colors.foreground }]}>Trending Searches</ThemedText>'''
content = content.replace(old_popular_title, new_popular_title)
# Change "Recent" to "Recent Searches"
old_recent_title = '''<ThemedText style={[styles.sectionTitle, { color: colors.foreground }]}>Recent</ThemedText>'''
new_recent_title = '''<ThemedText style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Searches</ThemedText>'''
content = content.replace(old_recent_title, new_recent_title)

# Update PreSearchState to layout correctly without margins on recent rows
old_presearch = '''{recentSearches.map((term, i) => <RecentRow key={term} term={term} index={i} colors={colors} onPress={() => onSelectSearch(term)} onRemove={() => onRemoveRecent(term)} />)}'''
new_presearch = '''<View style={{ marginTop: -8 }}>{recentSearches.map((term, i) => <RecentRow key={term} term={term} index={i} colors={colors} onPress={() => onSelectSearch(term)} onRemove={() => onRemoveRecent(term)} />)}</View>'''
content = content.replace(old_presearch, new_presearch)

with open(file_path, 'w') as f:
    f.write(content)
print("Updated basic parts")
