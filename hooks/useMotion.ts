import { useSettings } from '@/hooks/useSettings';

/**
 * Central place to read the user's "Reduce animations" preference so any
 * screen can shorten/disable non-essential motion consistently, instead of
 * each screen re-deriving it. Durations are multiplied by `scale` (0 when
 * reduced) so existing `withTiming`/`withSpring` calls degrade gracefully
 * without needing separate reduced-motion code paths everywhere.
 */
export function useMotion() {
  const { settings } = useSettings();
  const reduceAnimations = settings.reduceAnimations;
  return {
    reduceAnimations,
    /** Multiply any animation duration by this value. */
    scale: reduceAnimations ? 0 : 1,
    /** Use to pick a duration: durationMs when motion is on, ~0 when reduced. */
    duration: (durationMs: number) => (reduceAnimations ? 0 : durationMs),
  };
}
