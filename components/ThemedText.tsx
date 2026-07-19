import React, { useMemo } from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useTypography, FontSet } from '@/hooks/useTypography';

type Weight = keyof FontSet;

/**
 * Reads a style (or style array) and maps its explicit fontWeight to the
 * typography weight used by the current font family setting.
 */
function extractWeight(style: any): Weight {
  const flattened = StyleSheet.flatten(style) || {};
  const weight = flattened.fontWeight;
  switch (weight) {
    case 'bold':
    case '700':
    case '800':
    case '900':
      return 'bold';
    case '600':
    case 'semibold':
      return 'semibold';
    case '500':
    case 'medium':
      return 'medium';
    default:
      return 'regular';
  }
}

/**
 * A Text wrapper that automatically applies the active font family from
 * useTypography(). It preserves the passed style and adds fontFamily at the
 * end of the style array so the font change propagates across the entire app.
 */
export function ThemedText(props: TextProps) {
  const fonts = useTypography();
  const weight = useMemo(() => extractWeight(props.style), [props.style]);
  const flattened = useMemo(() => StyleSheet.flatten(props.style) ?? {}, [props.style]);
  // Respect an explicit fontFamily if one was provided by the caller.
  const fontFamily = flattened.fontFamily ?? fonts[weight];
  return <Text {...props} style={[props.style, { fontFamily }]} />;
}
