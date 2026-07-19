import re
with open('/app/applet/components/categories/CategoryCard.tsx', 'r') as f:
    text = f.read()

text = text.replace("import Animated, { FadeInUp } from 'react-native-reanimated';", "import { materialCardEnter } from '../animations';\nimport Animated, { FadeInUp } from 'react-native-reanimated';")
text = re.sub(
    r'entering=\{FadeInUp\.delay\(index \* 35\)[^}]*\}',
    'entering={materialCardEnter(index, 0, 30)}',
    text
)
with open('/app/applet/components/categories/CategoryCard.tsx', 'w') as f:
    f.write(text)
