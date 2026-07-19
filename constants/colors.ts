/**
 * Material 3 design tokens — Material You "teal" tonal palette.
 * Follows Material You conventions with surface tones and state layers.
 */

const colors = {
  light: {
    // Core brand
    primary: '#006874',
    onPrimary: '#FFFFFF',
    primaryContainer: '#9EEFFD',
    onPrimaryContainer: '#001F24',

    // Secondary
    secondary: '#4A6267',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#CDE7EC',
    onSecondaryContainer: '#051F23',

    // Surfaces
    background: '#FAFDFD',
    foreground: '#191C1D',
    surface: '#FAFDFD',
    onSurface: '#191C1D',
    surfaceVariant: '#DBE4E6',
    onSurfaceVariant: '#3F484A',
    surfaceContainer: '#EEF2F2',
    surfaceContainerHigh: '#E7ECEC',

    // Cards
    card: '#FFFFFF',
    cardForeground: '#191C1D',

    // Muted / subdued
    muted: '#DBE4E6',
    mutedForeground: '#6F797A',

    // Accent
    accent: '#CDE7EC',
    accentForeground: '#051F23',

    // Utility
    border: '#C4CDCF',
    input: '#C4CDCF',
    outline: '#6F797A',

    // Destructive
    destructive: '#BA1A1A',
    destructiveForeground: '#FFFFFF',

    // Legacy aliases (kept for scaffold compatibility)
    text: '#191C1D',
    tint: '#006874',
    primaryForeground: '#FFFFFF',
  },

  dark: {
    // Core brand
    primary: '#83D2E0',
    onPrimary: '#00363D',
    primaryContainer: '#004F58',
    onPrimaryContainer: '#9EEFFD',

    // Secondary
    secondary: '#B1CBD0',
    onSecondary: '#1C3438',
    secondaryContainer: '#334B4F',
    onSecondaryContainer: '#CDE7EC',

    // Surfaces
    background: '#191C1D',
    foreground: '#E1E3E3',
    surface: '#191C1D',
    onSurface: '#E1E3E3',
    surfaceVariant: '#3F484A',
    onSurfaceVariant: '#BFC8CA',
    surfaceContainer: '#1F2223',
    surfaceContainerHigh: '#292C2D',

    // Cards
    card: '#1F2223',
    cardForeground: '#E1E3E3',

    // Muted / subdued
    muted: '#3F484A',
    mutedForeground: '#899294',

    // Accent
    accent: '#334B4F',
    accentForeground: '#CDE7EC',

    // Utility
    border: '#3F484A',
    input: '#3F484A',
    outline: '#899294',

    // Destructive
    destructive: '#FFB4AB',
    destructiveForeground: '#690005',

    // Legacy aliases (kept for scaffold compatibility)
    text: '#E1E3E3',
    tint: '#83D2E0',
    primaryForeground: '#00363D',
  },

  radius: 16,
};

export default colors;
