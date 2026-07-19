import re
with open('/app/applet/components/downloads/AppDownloadButton.tsx', 'r') as f:
    text = f.read()

text = text.replace("const isCircular = ['queued', 'preparing', 'downloading', 'paused', 'verifying', 'installing'].includes(btnState);", "")

text = re.sub(
    r'(const btnState = useMemo<PillState>\(\(\) => \{.*?\n  \}, \[status, otherDownloading, installedVersion, hasUpdate\]\);)',
    r'\1\n  const isCircular = [\'queued\', \'preparing\', \'downloading\', \'paused\', \'verifying\', \'installing\'].includes(btnState);',
    text,
    flags=re.DOTALL
)

with open('/app/applet/components/downloads/AppDownloadButton.tsx', 'w') as f:
    f.write(text)
print("done")
