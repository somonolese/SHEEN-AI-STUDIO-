import os

file_path = '/app/applet/app/(tabs)/search.tsx'
with open(file_path, 'r') as f:
    content = f.read()

voice_dialog_old = '''<Modal visible={voiceDialogVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={closeVoiceDialog}>
          <Pressable style={[styles.dialogOverlay, { backgroundColor: 'rgba(0,0,0,0.45)' }]} onPress={closeVoiceDialog}>
            <Animated.View entering={FadeInUp.duration(300).springify().damping(22)} style={[styles.dialogCard, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center', paddingVertical: 40 }]}>
              <MaterialCommunityIcons name="microphone" size={64} color={colors.primary} style={{ marginBottom: 16 }} />
              <ThemedText style={[styles.dialogTitle, { color: colors.foreground, fontFamily: fonts.bold }]}>Listening...</ThemedText>
              <ThemedText style={[styles.dialogBody, { color: colors.mutedForeground, fontFamily: fonts.regular, textAlign: 'center', marginTop: 8 }]}>
                {Platform.OS === 'web' && typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) ? 'Speak now to search apps.' : 'Simulating voice search...'}
              </ThemedText>
              <Pressable onPress={closeVoiceDialog} style={[styles.dialogButton, { backgroundColor: colors.surfaceContainerHigh, marginTop: 24 }]}>
                <ThemedText style={[styles.dialogButtonText, { color: colors.onSurface, fontFamily: fonts.medium }]}>Cancel</ThemedText>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>'''

voice_comp = '''function VoiceSearchDialog({ visible, onClose, colors, fonts }: { visible: boolean; onClose: () => void; colors: any; fonts: any; }) {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.5);

  useEffect(() => {
    if (visible) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.5, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      pulseScale.value = 1;
      pulseOpacity.value = 0.5;
    }
  }, [visible]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={[styles.dialogOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]} onPress={onClose}>
        <Animated.View entering={FadeInUp.duration(300).springify().damping(22)} style={[styles.dialogCard, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center', paddingVertical: 40 }]}>
          <View style={{ position: 'relative', width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <Animated.View style={[pulseStyle, { position: 'absolute', width: '100%', height: '100%', borderRadius: 48, backgroundColor: colors.primary }]} />
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="microphone" size={32} color={colors.onPrimary} />
            </View>
          </View>
          <ThemedText style={[styles.dialogTitle, { color: colors.foreground, fontFamily: fonts.bold }]}>Listening...</ThemedText>
          <ThemedText style={[styles.dialogBody, { color: colors.mutedForeground, fontFamily: fonts.regular, textAlign: 'center', marginTop: 8 }]}>
            {Platform.OS === 'web' && typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) ? 'Speak now to search apps.' : 'Simulating voice search...'}
          </ThemedText>
          <Pressable onPress={onClose} style={[styles.dialogButton, { backgroundColor: colors.surfaceContainerHigh, marginTop: 24 }]}>
            <ThemedText style={[styles.dialogButtonText, { color: colors.onSurface, fontFamily: fonts.medium }]}>Cancel</ThemedText>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}'''

content = content.replace(voice_dialog_old, '<VoiceSearchDialog visible={voiceDialogVisible} onClose={closeVoiceDialog} colors={colors} fonts={fonts} />')
if 'function VoiceSearchDialog' not in content:
    content = content.replace('function ResultCard', voice_comp + '\nfunction ResultCard')

with open(file_path, 'w') as f:
    f.write(content)
print("Updated voice search animation")
