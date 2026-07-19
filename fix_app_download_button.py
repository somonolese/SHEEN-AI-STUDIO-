import re

with open('/app/applet/components/downloads/AppDownloadButton.tsx', 'r') as f:
    text = f.read()

# isCircular
text = text.replace("const [showWarning, setShowWarning] = useState(false);", "const [showWarning, setShowWarning] = useState(false);\n  const isCircular = ['queued', 'preparing', 'downloading', 'paused', 'verifying', 'installing'].includes(btnState);")

# Update stateConfig
new_state_config = """    switch (btnState) {
      case 'idle':
        bg = colors.primary;
        fg = colors.onPrimary;
        label = 'Install';
        icon = 'download';
        break;
      case 'queued':
        bg = colors.surfaceContainer;
        fg = colors.mutedForeground;
        label = '';
        icon = 'clock-outline';
        break;
      case 'preparing':
        bg = colors.surfaceContainer;
        fg = colors.mutedForeground;
        label = '';
        icon = 'dots-horizontal';
        break;
      case 'downloading':
        bg = colors.surfaceContainer;
        fg = colors.primary;
        label = '';
        icon = 'pause';
        break;
      case 'paused':
        bg = colors.surfaceContainer;
        fg = colors.primary;
        label = '';
        icon = 'play';
        break;
      case 'verifying':
        bg = colors.surfaceContainer;
        fg = colors.mutedForeground;
        label = '';
        icon = 'shield-search';
        break;
      case 'installing':
        bg = colors.surfaceContainer;
        fg = colors.mutedForeground;
        label = '';
        icon = 'package-down';
        break;
      case 'installed':
        bg = colors.secondaryContainer;
        fg = colors.onSecondaryContainer;
        label = 'Open';
        icon = 'open-in-new';
        break;
      case 'update_available':
        bg = colors.primary;
        fg = colors.onPrimary;
        label = 'Update';
        icon = 'arrow-up-bold-box-outline';
        break;
      case 'failed':
        bg = `${colors.destructive}22`;
        fg = colors.destructive;
        label = 'Retry';
        icon = 'refresh';
        break;
      case 'warning':
        bg = colors.destructive;
        fg = '#ffffff';
        label = 'Blocked';
        icon = 'shield-alert-outline';
        break;
    }"""
text = re.sub(r'    switch \(btnState\) \{.*?(?=\n    return \{ bg, fg, label, icon \};)', new_state_config, text, flags=re.DOTALL)

# Let's replace the AnimatedPressable styling
text = re.sub(
    r'\{ flex: btnState === \'installed\' \? 1\.25 : 1 \}',
    "{ flex: isCircular ? 0 : (btnState === 'installed' ? 1.25 : 1), width: isCircular ? 44 : undefined, height: 44, paddingHorizontal: isCircular ? 0 : 16, justifyContent: 'center' }",
    text
)

# Render logic
new_render = """          {/* Progress Ring for Downloading state */}
          {isCircular ? (
            <ProgressRing
              progress={progress}
              size={44}
              strokeWidth={3.5}
              color={stateConfig.fg}
              trackColor={`${stateConfig.fg}33`}
              icon={currentIcon}
              indeterminate={btnState === 'preparing' || btnState === 'queued' || btnState === 'verifying' || btnState === 'installing'}
            />
          ) : (
            <Animated.View style={[styles.innerRow, animatedContentStyle]}>
              {currentIcon && (
                <Animated.View style={rotatingIconStyle}>
                  <MaterialCommunityIcons name={currentIcon as any} size={18} color={stateConfig.fg} />
                </Animated.View>
              )}
              <ThemedText style={[styles.label, { color: stateConfig.fg }]} numberOfLines={1}>
                {currentLabel}
              </ThemedText>
              
              {/* Optional queue position badge */}
              {btnState === 'queued' && queuePosition > 1 && (
                <View style={[styles.badge, { backgroundColor: `${stateConfig.fg}22` }]}>
                  <ThemedText style={[styles.badgeText, { color: stateConfig.fg }]}>#{queuePosition}</ThemedText>
                </View>
              )}
            </Animated.View>
          )}"""

text = re.sub(r'          \{/\* Progress Ring for Downloading state \*/\}.*?(?=        </AnimatedPressable>)', new_render + '\n', text, flags=re.DOTALL)

with open('/app/applet/components/downloads/AppDownloadButton.tsx', 'w') as f:
    f.write(text)
print("done")
