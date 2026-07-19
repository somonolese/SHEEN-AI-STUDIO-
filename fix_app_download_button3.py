import re

with open('/app/applet/components/downloads/AppDownloadButton.tsx', 'r') as f:
    text = f.read()

# Animate width using useAnimatedStyle
# In Reanimated, animating to 'auto' is tricky, but we can set maxWidth or flex instead.
# Actually, the button is inside a row with flex: 1 by default, but when circular it should be fixed size.

# I'll just rewrite the whole component to be perfect.
