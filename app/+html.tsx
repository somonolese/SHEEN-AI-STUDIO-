import { type PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

/**
 * The custom HTML shell used for the web build. This mirrors the default Expo
 * Router HTML but adds a dark background color that matches the splash screen
 * so users never see a white flash while the JavaScript bundle is loading.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
  body {
    background-color: #0A0E0F;
  }
  @media (prefers-color-scheme: dark) {
    body {
      background-color: #000000;
    }
  }
`;
