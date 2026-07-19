import re
with open('/app/applet/components/downloads/AppDownloadButton.tsx', 'r') as f:
    text = f.read()

# Add FadeIn/FadeOut to the conditional blocks
old_render = """          {isCircular ? (
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
            <Animated.View style={[styles.innerRow, animatedContentStyle]}>"""

new_render = """          {isCircular ? (
            <Animated.View key="ring" entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={{ alignItems: 'center', justifyContent: 'center' }}>
              <ProgressRing
                progress={progress}
                size={44}
                strokeWidth={3.5}
                color={stateConfig.fg}
                trackColor={`${stateConfig.fg}33`}
                icon={currentIcon}
                indeterminate={btnState === 'preparing' || btnState === 'queued' || btnState === 'verifying' || btnState === 'installing'}
              />
            </Animated.View>
          ) : (
            <Animated.View key="text" entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[styles.innerRow, animatedContentStyle]}>"""

text = text.replace(old_render, new_render)

with open('/app/applet/components/downloads/AppDownloadButton.tsx', 'w') as f:
    f.write(text)
print("done")
