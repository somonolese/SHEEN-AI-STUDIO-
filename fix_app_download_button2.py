import re
with open('/app/applet/components/downloads/AppDownloadButton.tsx', 'r') as f:
    text = f.read()

text = re.sub(
    r'\{\n\s*flex: btnState === \'installed\' \? 1\.25 : 1,\n\s*\}',
    "{ flex: isCircular ? 0 : (btnState === 'installed' ? 1.25 : 1), width: isCircular ? 44 : undefined, height: 44, paddingHorizontal: isCircular ? 0 : 16, justifyContent: 'center' }",
    text
)
with open('/app/applet/components/downloads/AppDownloadButton.tsx', 'w') as f:
    f.write(text)
print("done")
