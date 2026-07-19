# SHEEN Design System: Organic Precision

SHEEN is defined by "Organic Precision"—an experience that feels intuitive, fluid, and human-centric while maintaining the structural reliability of a production-grade application.

## 1. Visual Personality
- **Mood**: High-contrast, depth-focused, inviting, and technical yet approachable.
- **Theme**: "Deep Carbon" (Dark Mode by default).
- **Goal**: To feel like a curated, high-end digital gallery rather than a dense data list.

## 2. Color System (Material 3 Dynamic)
- **Primary**: Electric Indigo (`#5E60CE`) - Used for active actions, download states, and high-priority indicators.
- **Secondary**: Seafoam Teal (`#48BFE3`) - Used for secondary actions and subtle accent highlights.
- **Surface**: Deep Carbon (`#0F0F0F`) to Charcoal Gray (`#1C1C1C`) - Used for card backgrounds and elevated surfaces.
- **Text**: Pure White (`#FFFFFF`) for primary, Desaturated Silver (`#A0A0A0`) for secondary.

## 3. Typography Hierarchy
- **Primary Font**: Manrope (Modern, geometric, highly legible).
- **Headings**: Heavy weight, tight tracking (e.g., -0.04em) for impact.
- **Body**: Normal/Medium weight, high line-height (1.6x) for readability.
- **Monospaced**: For version numbers, hash IDs, and technical data.

## 4. Shape Language
- **Cards/Containers**: Rounded corners with a variable scale:
  - Small elements (buttons): 12dp
  - Standard cards: 24dp - 32dp
  - Full screen overlays: 40dp+
- **Shadows**:
  - Soft, diffused, physics-based elevation shadows (no hard black outlines).

## 5. Motion Principles (Spring Physics)
- **Fluidity**: All transitions (fades, translations, expands) are physics-based using spring animations (`damping: 20, stiffness: 120`).
- **No Linear Motion**: Linear interpolations are forbidden for UI transitions.

## 6. Component Specs
- **Download Button**: Floating, pill-shaped when idle; circular, spinning progress ring when active.
- **Repository Badges**: Subtle background-tinted, uppercase, bold, mono-spaced text labels.
- **Hero Cards**: Full-bleed banner imagery with dynamic gradient overlays for text legibility.
- **Lists**: Clean separator-less entries utilizing padding and card grouping for hierarchy.

## 7. Interaction Feedback
- **Touch**: Immediate ripple feedback (`android_ripple`) on all actionable surfaces.
- **Haptics**: Subtle, distinct haptic patterns for successful downloads, errors, and long-press interactions.

---
This document serves as the source of truth for all future UI modifications.
