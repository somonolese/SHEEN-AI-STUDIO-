import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { isLoaded, loadAsync } from 'expo-font';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  ComicNeue_400Regular,
  ComicNeue_700Bold,
} from '@expo-google-fonts/comic-neue';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

/**
 * All custom font assets used by the app. Loaded once at startup. If any font
 * fails to load (common on web due to FontFaceObserver timeouts), we fall back
 * to the system font for that weight so the UI never crashes or stays blank.
 */
const FONT_ASSETS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  ComicNeue_400Regular,
  ComicNeue_700Bold,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
};

/** Maximum time to wait for the initial font load before falling back. */
const FONT_LOAD_TIMEOUT_MS = 1500;

interface FontContextValue {
  /** Set of font family names that finished loading successfully. */
  loadedFonts: Set<string>;
  /** Error encountered while loading fonts, if any. */
  error: Error | null;
  /** True once the loading attempt has finished (success or failure). */
  ready: boolean;
}

const FontContext = createContext<FontContextValue>({
  loadedFonts: new Set(),
  error: null,
  ready: false,
});

function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Font load timed out after ${ms}ms`)), ms);
  });
}

/** Check which of the configured font families are currently registered. */
function getAvailableFonts(): Set<string> {
  return new Set(
    Object.keys(FONT_ASSETS).filter((name) => {
      try {
        return isLoaded(name);
      } catch {
        return false;
      }
    })
  );
}

export function FontProvider({ children }: { children: ReactNode }) {
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set());
  const [error, setError] = useState<Error | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const attemptLoad = async () => {
      try {
        // Race the font load against a short timeout so the splash never waits
        // longer than FONT_LOAD_TIMEOUT_MS for a slow/failing FontFaceObserver.
        await Promise.race([loadAsync(FONT_ASSETS), createTimeoutPromise(FONT_LOAD_TIMEOUT_MS)]);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        if (isMounted) setError(err);
      } finally {
        // Always mark ready and report whatever fonts are actually available.
        if (isMounted) {
          setLoadedFonts(getAvailableFonts());
          setReady(true);
        }
      }
    };

    attemptLoad();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <FontContext.Provider value={{ loadedFonts, error, ready }}>
      {children}
    </FontContext.Provider>
  );
}

export function useFontContext(): FontContextValue {
  return useContext(FontContext);
}
