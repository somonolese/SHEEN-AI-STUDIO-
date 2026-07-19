import re

with open('update_header.js', 'r') as f:
    text = f.read()

# Fix hasCover
text = text.replace('const colorScheme = useColorScheme();', 'const colorScheme = useColorScheme();\\n  const hasCover = !!settings.coverPhoto;')

# Add padding to SectionList
text = text.replace('contentContainerStyle={[styles.scroll, { paddingTop: topPad, paddingBottom: bottomPad }]}', 'contentContainerStyle={[styles.scroll, { paddingTop: topPad + 280, paddingBottom: bottomPad }]}')

# Add styles
styles_code = '''
  parallaxHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    justifyContent: 'flex-end',
  },
  parallaxToolbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 20,
  },
  parallaxToolbarIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toolbarIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff3b5c',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  toolbarAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  toolbarAvatar: {
    width: '100%',
    height: '100%',
  },
  parallaxContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  parallaxGreeting: {
    fontSize: 16,
    marginBottom: 4,
  },
  parallaxName: {
    fontSize: 28,
    letterSpacing: -0.5,
  },
'''
text = text.replace('const styles = StyleSheet.create({', 'const styles = StyleSheet.create({' + styles_code)

with open('/app/applet/app/(tabs)/index.tsx', 'w') as f:
    f.write(text)
print("Applied part 2")
