# SHEEN Implementation Roadmap: Design System Alignment

This roadmap outlines the necessary steps to align the current SHEEN application with the **Organic Precision** design system defined in `DESIGN_SYSTEM.md`.

## Priority 1: Foundation & Consistency (The Look and Feel)
- [ ] **Color Palette Unification**: Globally replace existing primary/background shades with the defined Deep Carbon theme (`#0F0F0F`, `#1C1C1C`) and Indigo/Teal accents (`#5E60CE`, `#48BFE3`).
- [ ] **Typography Enforcement**: Ensure `Manrope` is applied to all `ThemedText` instances. Validate weight and tracking for headings vs. body text.
- [ ] **Shape Language Standardization**: Normalize `borderRadius` across all cards, buttons, and containers to follow the 12dp/24dp/32dp/40dp scale.

## Priority 2: Component Refinement (Atomic Level)
- [ ] **Download Button**: Update `AppDownloadButton` to strictly use the defined pill-shaped idle state and the circular spinning progress ring for active states.
- [ ] **Repository Badges**: Ensure all badges utilize the defined uppercase, bold, mono-spaced text style with subtle background tints.
- [ ] **Card & Elevation**: Audit all `View` elements acting as cards to remove hard black shadows, replacing them with the defined soft, physics-based elevation shadows.
- [ ] **Skeleton Loaders**: Update all `Skeleton` components to match the Deep Carbon background and provide cohesive, fluid loading transitions.

## Priority 3: Screen & Flow Refinement (UI/UX)
- [ ] **App Details Screen**: Align hero section, section headers, and information list with the new spacing (4dp/8dp grid) and typography hierarchy.
- [ ] **Category App Cards**: Ensure list-view cards match the visual language of the hero/featured cards (consistent corner radius, typography, and badge styling).
- [ ] **Empty/Loading States**: Standardize empty state illustrations and loading animations to be minimal, fluid, and aligned with the "Gallery" aesthetic.

## Priority 4: Motion & Interaction (Feel)
- [ ] **Spring Physics Audit**: Globally audit all animated components (transitions, fades, expands). Replace any remaining linear animations with the spring config (`damping: 20, stiffness: 120`).
- [ ] **Touch Feedback**: Audit `Pressable` components to ensure consistent use of `android_ripple` and standard haptic patterns.
