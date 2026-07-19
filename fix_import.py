import os

file_path = '/app/applet/app/(tabs)/search.tsx'
with open(file_path, 'r') as f:
    content = f.read()

import re
content = re.sub(r"import \{ LinearTransition \} from 'react-native-reanimated';\n\nfunction FilterChip", "function FilterChip", content)

old_reanimated = "import Animated, { Easing, FadeIn, FadeInDown, FadeInUp, FadeOut, useAnimatedStyle, useSharedValue, withSpring, withSequence, withTiming } from 'react-native-reanimated';"
new_reanimated = "import Animated, { Easing, FadeIn, FadeInDown, FadeInUp, FadeOut, useAnimatedStyle, useSharedValue, withSpring, withSequence, withTiming, LinearTransition } from 'react-native-reanimated';"

content = content.replace(old_reanimated, new_reanimated)

with open(file_path, 'w') as f:
    f.write(content)
print("Fixed import")
