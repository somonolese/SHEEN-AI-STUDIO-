import re
with open('/app/applet/components/downloads/AppDownloadButton.tsx', 'r') as f:
    text = f.read()

# Add success animation
if 'scale.value = withSequence(withTiming(1.1, { duration: 100 }), withSpring(1, { damping: 15, stiffness: 150 }));' not in text:
    old_haptic = r"(      triggerHaptic\('success'\);)"
    new_haptic = r"\1\n      scale.value = withSequence(withTiming(1.1, { duration: 100 }), withSpring(1, { damping: 15, stiffness: 150 }));"
    text = re.sub(old_haptic, new_haptic, text)

with open('/app/applet/components/downloads/AppDownloadButton.tsx', 'w') as f:
    f.write(text)
print("done")
