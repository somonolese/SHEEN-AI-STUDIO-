import os

file_path = '/app/applet/app/(tabs)/search.tsx'
with open(file_path, 'r') as f:
    content = f.read()

old_result = '    <Animated.View entering={FadeInUp.delay(index * 40).duration(420).springify().damping(24).stiffness(170)}>'
new_result = '    <Animated.View entering={FadeInDown.delay(index * 60).duration(500).springify().damping(20).stiffness(150)}>'

content = content.replace(old_result, new_result)

with open(file_path, 'w') as f:
    f.write(content)
print("Updated result card animation")
