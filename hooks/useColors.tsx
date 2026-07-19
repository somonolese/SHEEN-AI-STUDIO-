import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from '@/hooks/useSettings';
import { getEffectiveColorScheme, getEffectivePalette, ColorPalette } from '@/constants/designTokens';

export type { ColorPalette } from '@/constants/designTokens';

interface ThemeContextValue {
  colors: ColorPalette;
  scheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Global Theme Provider that handles color calculation and reactivity.
 * Wrapping the app in this ensures that every component using useColors()
 * re-renders instantly when settings or system theme changes.
 */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const systemScheme = useColorScheme() ?? null;

  const value = useMemo(() => {
    const colors = getEffectivePalette(settings, systemScheme);
    const scheme = getEffectiveColorScheme(settings, systemScheme);
    return { colors, scheme };
  }, [settings, systemScheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Returns the design tokens for the active theme, design style, and AMOLED
 * preference. The palette is fully reactive to SettingsProvider changes and
 * includes scheme-independent values like `radius`.
 */
export function useColors(): ColorPalette {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useColors must be used within an AppThemeProvider');
  }
  return ctx.colors;
}

/**
 * Returns the effective color scheme for status bars, splash screens, and
 * other scheme-only decisions. Respects the user's theme setting over the
 * system value.
 */
export function useEffectiveColorScheme(): 'light' | 'dark' {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useEffectiveColorScheme must be used within an AppThemeProvider');
  }
  return ctx.scheme;
}
