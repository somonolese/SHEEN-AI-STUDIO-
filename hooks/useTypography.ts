import { useSettings, FontFamily } from '@/hooks/useSettings';
import { useFontContext } from '@/contexts/FontContext';

export interface FontSet {
  regular?: string;
  medium?: string;
  semibold?: string;
  bold?: string;
}

export const FONT_OPTIONS: { key: FontFamily; label: string; description: string; previewFontFamily: string; previewText: string }[] = [
  { key: 'inter', label: 'Inter', description: 'Clean and professional', previewFontFamily: 'Inter_400Regular', previewText: 'The quick brown fox jumps over the lazy dog' },
  { key: 'spaceGrotesk', label: 'Space Grotesk', description: 'Geometric and futuristic', previewFontFamily: 'SpaceGrotesk_400Regular', previewText: 'The quick brown fox jumps over the lazy dog' },
  { key: 'playfairDisplay', label: 'Playfair Display', description: 'Elegant serif', previewFontFamily: 'PlayfairDisplay_400Regular', previewText: 'The quick brown fox jumps over the lazy dog' },
  { key: 'comicNeue', label: 'Comic Neue', description: 'Friendly and rounded', previewFontFamily: 'ComicNeue_400Regular', previewText: 'The quick brown fox jumps over the lazy dog' },
  { key: 'jetbrainsMono', label: 'JetBrains Mono', description: 'Technical monospace', previewFontFamily: 'JetBrainsMono_400Regular', previewText: 'The quick brown fox jumps over the lazy dog' },
];

const FONT_FAMILIES: Record<FontFamily, FontSet> = {
  inter: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  spaceGrotesk: {
    regular: 'SpaceGrotesk_400Regular',
    medium: 'SpaceGrotesk_500Medium',
    semibold: 'SpaceGrotesk_600SemiBold',
    bold: 'SpaceGrotesk_700Bold',
  },
  playfairDisplay: {
    regular: 'PlayfairDisplay_400Regular',
    medium: 'PlayfairDisplay_500Medium',
    semibold: 'PlayfairDisplay_600SemiBold',
    bold: 'PlayfairDisplay_700Bold',
  },
  comicNeue: {
    regular: 'ComicNeue_400Regular',
    medium: 'ComicNeue_400Regular',
    semibold: 'ComicNeue_700Bold',
    bold: 'ComicNeue_700Bold',
  },
  jetbrainsMono: {
    regular: 'JetBrainsMono_400Regular',
    medium: 'JetBrainsMono_500Medium',
    semibold: 'JetBrainsMono_600SemiBold',
    bold: 'JetBrainsMono_700Bold',
  },
};

export const FONT_LABELS: Record<FontFamily, string> = {
  inter: 'Inter',
  spaceGrotesk: 'Space Grotesk',
  playfairDisplay: 'Playfair Display',
  comicNeue: 'Comic Neue',
  jetbrainsMono: 'JetBrains Mono',
};

/**
 * Returns the active font families for the current typography setting.
 * If a custom font failed to load, that weight falls back to undefined so
 * React Native uses the system font instead of crashing.
 */
export function useTypography(): FontSet {
  const { settings } = useSettings();
  const { loadedFonts } = useFontContext();
  const selected = FONT_FAMILIES[settings.fontFamily] ?? FONT_FAMILIES.inter;

  return {
    regular: loadedFonts.has(selected.regular!) ? selected.regular : undefined,
    medium: loadedFonts.has(selected.medium!) ? selected.medium : undefined,
    semibold: loadedFonts.has(selected.semibold!) ? selected.semibold : undefined,
    bold: loadedFonts.has(selected.bold!) ? selected.bold : undefined,
  };
}

/**
 * Convenience helper to merge a base style with a weight-specific font family.
 */
