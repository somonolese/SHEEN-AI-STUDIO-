/**
 * SheenIcon — Official SHEEN app icon as a reusable component.
 *
 * Displays the basket-with-apps artwork at any requested size.
 * The icon artwork already contains the correct rounded-rect shape,
 * so no additional border radius is applied by default.
 *
 * Usage:
 *   <SheenIcon size={32} />                    // small — top bars
 *   <SheenIcon size={80} />                    // medium — hero sections
 *   <SheenIcon size={120} style={{ ... }} />   // large — about page
 */

import React from 'react';
import { Image, ImageStyle, StyleProp, View, ViewStyle } from 'react-native';

// Keep the require() outside the component so it is only resolved once.
const ICON_SOURCE = require('@/assets/images/icon.png');

interface SheenIconProps {
  /** Size of the icon in logical pixels (width = height). Defaults to 32. */
  size?: number;
  /** Extra ViewStyle applied to the wrapping View. */
  style?: StyleProp<ViewStyle>;
  /** Extra ImageStyle applied directly to the Image. */
  imageStyle?: StyleProp<ImageStyle>;
}

export function SheenIcon({ size = 32, style, imageStyle }: SheenIconProps) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Image
        source={ICON_SOURCE}
        style={[{ width: size, height: size } as ImageStyle, imageStyle]}
        resizeMode="contain"
      />
    </View>
  );
}
