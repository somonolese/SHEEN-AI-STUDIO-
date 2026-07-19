import { SheenSettings } from '@/hooks/useSettings';
import colors from './colors';

/**
 * Material 3 design tokens extended to support multiple visual styles.
 *
 * The base palette is the existing Material You teal scheme. The app can
 * override it at runtime based on:
 *   - themeMode (system / light / dark / amoled)
 *   - designStyle (materialYou / liquidGlass)
 *   - materialYou toggle (static vs dynamic color simulation)
 *   - amoledBlack toggle / amoled theme mode
 */

type Palette = typeof colors.light;

type PaletteOverride = Partial<Palette & { radius: number }>;

const LIQUID_GLASS_LIGHT: PaletteOverride = {
  primary: '#5B8DEF',
  onPrimary: '#FFFFFF',
  primaryContainer: 'rgba(91,141,239,0.15)',
  onPrimaryContainer: '#1E3A8A',
  secondary: '#7C8BAF',
  onSecondary: '#FFFFFF',
  secondaryContainer: 'rgba(124,139,175,0.15)',
  onSecondaryContainer: '#334155',
  background: '#F8FAFF',
  foreground: '#1E293B',
  surface: '#FFFFFF',
  onSurface: '#1E293B',
  surfaceVariant: '#E2E8F0',
  onSurfaceVariant: '#64748B',
  surfaceContainer: 'rgba(255,255,255,0.72)',
  surfaceContainerHigh: 'rgba(255,255,255,0.85)',
  card: 'rgba(255,255,255,0.70)',
  cardForeground: '#1E293B',
  border: 'rgba(148,163,184,0.22)',
  input: 'rgba(148,163,184,0.22)',
  outline: '#94A3B8',
  muted: '#E2E8F0',
  mutedForeground: '#64748B',
  accent: 'rgba(91,141,239,0.12)',
  accentForeground: '#1E3A8A',
  destructive: '#EF4444',
  destructiveForeground: '#FFFFFF',
  text: '#1E293B',
  tint: '#5B8DEF',
  primaryForeground: '#FFFFFF',
  radius: 28,
};

const LIQUID_GLASS_DARK: PaletteOverride = {
  primary: '#93C5FD',
  onPrimary: '#0F172A',
  primaryContainer: 'rgba(147,197,253,0.12)',
  onPrimaryContainer: '#DBEAFE',
  secondary: '#A5B4FC',
  onSecondary: '#0F172A',
  secondaryContainer: 'rgba(165,180,252,0.12)',
  onSecondaryContainer: '#E0E7FF',
  background: '#0F172A',
  foreground: '#E2E8F0',
  surface: '#1E293B',
  onSurface: '#E2E8F0',
  surfaceVariant: '#334155',
  onSurfaceVariant: '#94A3B8',
  surfaceContainer: 'rgba(30,41,59,0.72)',
  surfaceContainerHigh: 'rgba(30,41,59,0.85)',
  card: 'rgba(30,41,59,0.70)',
  cardForeground: '#E2E8F0',
  border: 'rgba(148,163,184,0.14)',
  input: 'rgba(148,163,184,0.14)',
  outline: '#64748B',
  muted: '#334155',
  mutedForeground: '#94A3B8',
  accent: 'rgba(147,197,253,0.12)',
  accentForeground: '#DBEAFE',
  destructive: '#FFB4AB',
  destructiveForeground: '#690005',
  text: '#E2E8F0',
  tint: '#93C5FD',
  primaryForeground: '#0F172A',
  radius: 28,
};

const MATERIAL_YOU_DYNAMIC_LIGHT: PaletteOverride = {
  primary: '#6B4C9A',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EADDFF',
  onPrimaryContainer: '#25005C',
  secondary: '#635B70',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E8DEF8',
  onSecondaryContainer: '#1E192B',
  background: '#FFFBFE',
  foreground: '#1C1B1F',
  surface: '#FFFBFE',
  onSurface: '#1C1B1F',
  surfaceVariant: '#E7E0EC',
  onSurfaceVariant: '#49454F',
  surfaceContainer: '#F3EDF7',
  surfaceContainerHigh: '#ECE6F0',
  card: '#FFFFFF',
  cardForeground: '#1C1B1F',
  border: '#CAC4D0',
  input: '#CAC4D0',
  outline: '#79747E',
  muted: '#E7E0EC',
  mutedForeground: '#625B71',
  accent: '#E8DEF8',
  accentForeground: '#1E192B',
  destructive: '#B3261E',
  destructiveForeground: '#FFFFFF',
  text: '#1C1B1F',
  tint: '#6B4C9A',
  primaryForeground: '#FFFFFF',
  radius: 20,
};

const MATERIAL_YOU_DYNAMIC_DARK: PaletteOverride = {
  primary: '#D0BCFF',
  onPrimary: '#381E72',
  primaryContainer: '#4F378B',
  onPrimaryContainer: '#EADDFF',
  secondary: '#CCC2DC',
  onSecondary: '#332D41',
  secondaryContainer: '#4A4458',
  onSecondaryContainer: '#E8DEF8',
  background: '#1C1B1F',
  foreground: '#E6E1E5',
  surface: '#1C1B1F',
  onSurface: '#E6E1E5',
  surfaceVariant: '#49454F',
  onSurfaceVariant: '#CAC4D0',
  surfaceContainer: '#36343B',
  surfaceContainerHigh: '#2B2930',
  card: '#36343B',
  cardForeground: '#E6E1E5',
  border: '#49454F',
  input: '#49454F',
  outline: '#938F99',
  muted: '#49454F',
  mutedForeground: '#A09DAA',
  accent: '#4A4458',
  accentForeground: '#E8DEF8',
  destructive: '#FFB4AB',
  destructiveForeground: '#690005',
  text: '#E6E1E5',
  tint: '#D0BCFF',
  primaryForeground: '#381E72',
  radius: 20,
};

const AMOLED_OVERRIDES: PaletteOverride = {
  background: '#000000',
  surface: '#000000',
  card: '#000000',
  surfaceContainer: '#000000',
  surfaceContainerHigh: '#000000',
  border: '#1C1C1C',
  input: '#1C1C1C',
  muted: '#1C1C1C',
};

export type ColorPalette = Palette & { radius: number };

/**
 * Builds the active color palette based on the user's settings.
 * Preserves the full token contract so every consumer gets the same keys.
 */
export function getEffectivePalette(
  settings: SheenSettings,
  systemScheme: 'light' | 'dark' | null,
): ColorPalette {
  const scheme =
    settings.themeMode === 'system'
      ? (systemScheme ?? 'light')
      : settings.themeMode === 'light'
        ? 'light'
        : 'dark';

  const base = scheme === 'dark' ? colors.dark : colors.light;
  let palette: ColorPalette = { ...base, radius: colors.radius };

  if (settings.designStyle === 'liquidGlass') {
    const override = scheme === 'light' ? LIQUID_GLASS_LIGHT : LIQUID_GLASS_DARK;
    palette = { ...palette, ...override };
  } else if (settings.materialYou) {
    const override = scheme === 'light' ? MATERIAL_YOU_DYNAMIC_LIGHT : MATERIAL_YOU_DYNAMIC_DARK;
    palette = { ...palette, ...override };
  }

  // Accent Color overrides (Only if Material You is disabled)
  if (!settings.materialYou && settings.accentColor) {
    const accent = settings.accentColor;
    let h = accent.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    const onAccent = yiq >= 128 ? '#000000' : '#FFFFFF';
    const isDark = scheme === 'dark';

    palette.primary = accent;
    palette.onPrimary = onAccent;
    palette.primaryContainer = isDark ? `rgba(${r}, ${g}, ${b}, 0.25)` : `rgba(${r}, ${g}, ${b}, 0.15)`;
    palette.onPrimaryContainer = isDark ? '#FFFFFF' : accent;
    
    // Also update secondary/accent colors to match the primary tone
    palette.secondary = accent;
    palette.onSecondary = onAccent;
    palette.secondaryContainer = isDark ? `rgba(${r}, ${g}, ${b}, 0.15)` : `rgba(${r}, ${g}, ${b}, 0.10)`;
    palette.onSecondaryContainer = isDark ? '#FFFFFF' : accent;

    palette.accent = palette.primaryContainer;
    palette.accentForeground = palette.primary;
    palette.tint = accent;
    palette.primaryForeground = onAccent;
  }

  // AMOLED Black (Only applied in Dark Mode as requested)
  if (scheme === 'dark' && settings.amoledBlack) {
    palette = { ...palette, ...AMOLED_OVERRIDES };
  }

  return palette;
}

export function getEffectiveColorScheme(
  settings: SheenSettings,
  systemScheme: 'light' | 'dark' | null,
): 'light' | 'dark' {
  if (settings.themeMode === 'system') return systemScheme ?? 'light';
  return settings.themeMode === 'light' ? 'light' : 'dark';
}
