# SHEEN

An open-source Android app store inspired by Kashmir, built with Material 3 and Material You design. Lets users discover, browse, and manage free and open-source Android apps.

## Tech Stack

- **Expo** (~54) + **Expo Router** (~6) — file-based navigation
- **React Native** (0.81) + **React Native Web** — cross-platform, runs in browser via Expo web
- **TypeScript** — strict mode
- **TanStack Query** — data fetching
- **Material 3** design tokens (custom color palette in `constants/colors.ts`)
- **pnpm** — package manager

## How to Run

```
pnpm run dev:web
```

This starts the Expo web dev server on an internal port and runs a local reverse proxy on port 5000. The Replit preview pane shows the web build, and a same-origin `/api/proxy` endpoint lets the web preview fetch F-Droid/IzzyOnDroid/GitHub data without browser CORS restrictions.

The original mobile dev script is still available:

```
pnpm run dev
```

## How to Run on Replit

The **Start application** workflow is already configured to run `PORT=5000 pnpm run dev:web`. Click the Run button to open the live preview.

## Project Structure

```
app/                  Expo Router screens
  (tabs)/             Bottom-tab screens: Home, Search, Categories, Favorites, Settings
  app-details.tsx     App detail screen
  _layout.tsx         Root layout (fonts, providers, splash screen)
components/           Shared UI components (ErrorBoundary, etc.)
constants/colors.ts   Material 3 color tokens (light + dark palette)
hooks/useColors.ts    Hook that returns the active palette based on color scheme
assets/images/        Static image assets
server/serve.js       Static file server (used after `pnpm run build`)
scripts/build.js      Expo web export build script
```

## Setup Notes

- `pnpm-workspace.yaml` defines the pnpm catalog for `react`, `react-dom`, `@tanstack/react-query`, and `zod` — required because `package.json` uses `catalog:` version references.
- The `@workspace/api-client-react` workspace dep and the `tsconfig.json` project reference to `../../lib/api-client-react` were removed (the package was not imported anywhere in source).

## User Preferences

- Minimum changes only — do not redesign, refactor, add features, or change UI/functionality without explicit instruction.
