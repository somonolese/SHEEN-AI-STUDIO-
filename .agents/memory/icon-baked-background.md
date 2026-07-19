---
name: Branding icon with baked-in solid background
description: How to handle a source app-icon PNG that has no alpha channel (solid black/color corners) when reusing it as an in-app logo and platform icon.
---

When a supplied brand icon is a flat RGB PNG (no alpha) with a solid-color square behind a rounded-rect artwork, don't use it as-is for in-app components or Android adaptive icons — the solid corners will show as a visible box on any background that doesn't match.

**Why:** iOS requires fully opaque icons, but in-app usage (headers, about screens, splash) and Android adaptive icons need transparent corners to look correct on arbitrary surfaces/backgrounds.

**How to apply:**
1. Use ImageMagick floodfill from all four corners (`-alpha set -fuzz N% -fill none -draw "color 0,0 floodfill"` repeated for each corner) to punch out only the connected solid-color background, preserving the interior artwork.
2. Use the transparent version for in-app components, splash screen, Android adaptive icon foreground, and web favicon.
3. Flatten the transparent version onto the original background color (sampled from a corner pixel) to produce a separate opaque PNG for `ios.icon`, since iOS icons must not have alpha.
4. For a monochrome Android notification icon, don't try to threshold/segment the photorealistic artwork — render a simple vector glyph (e.g. an existing MaterialCommunityIcons glyph matching the brand concept) in white on transparent, sized to ~60-65% of the canvas for the Android safe zone.
