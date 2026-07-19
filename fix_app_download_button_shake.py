import re
with open('/app/applet/components/downloads/AppDownloadButton.tsx', 'r') as f:
    text = f.read()

# Make sure withSequence is imported
if 'withSequence' not in text:
    text = text.replace('withRepeat,', 'withRepeat,\n  withSequence,')

# Add shakeOffset inside the component
if 'const shakeOffset = useSharedValue(0);' not in text:
    # Find a good place, e.g. after const prevStatus = useRef(status);
    hook_place = r'(  const prevStatus = useRef\(status\);)'
    text = re.sub(hook_place, r'  const shakeOffset = useSharedValue(0);\n\n  useEffect(() => {\n    if (btnState === \'failed\') {\n      shakeOffset.value = withSequence(\n        withTiming(8, { duration: 50 }),\n        withTiming(-8, { duration: 50 }),\n        withTiming(8, { duration: 50 }),\n        withTiming(0, { duration: 50 })\n      );\n    }\n  }, [btnState]);\n\n\1', text)

# Add it to the animatedScaleStyle
if 'translateX: shakeOffset.value' not in text:
    scale_style = r'(transform: \[)(\s*\{ scale: scale\.value \})'
    text = re.sub(scale_style, r'\1{ translateX: shakeOffset.value },\2', text)

with open('/app/applet/components/downloads/AppDownloadButton.tsx', 'w') as f:
    f.write(text)
print("done")
