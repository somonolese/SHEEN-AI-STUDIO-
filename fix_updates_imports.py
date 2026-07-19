import re
with open('/app/applet/app/(tabs)/updates.tsx', 'r') as f:
    text = f.read()

# Add imports
text = "import RNAnimated from 'react-native-reanimated';\nimport { materialCardEnter } from '../../components/animations';\n" + text

# Change Animated.View entering to RNAnimated.View entering
text = text.replace('<Animated.View entering={materialCardEnter', '<RNAnimated.View entering={materialCardEnter')
text = text.replace('</Animated.View>', '</RNAnimated.View>')

with open('/app/applet/app/(tabs)/updates.tsx', 'w') as f:
    f.write(text)
