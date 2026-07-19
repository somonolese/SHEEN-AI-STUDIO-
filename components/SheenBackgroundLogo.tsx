import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

/**
 * A large, softly faded SHEEN logo mark placed behind screen content.
 * Uses the official app icon artwork instead of the placeholder "S".
 * Opacity is kept very low so text and cards above it remain fully readable.
 */
export function SheenBackgroundLogo() {
  return (
    <View style={styles.container} pointerEvents="none">
      <Image
        source={require('@/assets/images/icon.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.055,
    zIndex: 0,
  },
  logo: {
    width: 300,
    height: 300,
  },
});
