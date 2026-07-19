import re
with open('/app/applet/app/(tabs)/index.tsx', 'r') as f:
    text = f.read()

match = re.search(r'function ProfileHeader.*?return \(.*?\);\s*\}' , text, re.DOTALL)
if match:
    with open('profile_header.txt', 'w') as f2:
        f2.write(match.group(0))
