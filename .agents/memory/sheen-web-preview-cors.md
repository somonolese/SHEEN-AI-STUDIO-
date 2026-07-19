---
name: SHEEN web preview CORS
description: CORS strategy for the SHEEN web preview on Replit.
---

Browsers block direct `fetch` to F-Droid, IzzyOnDroid, and GitHub from the web preview origin. To make the preview functional:

- Keep a same-origin CORS proxy endpoint (`/api/proxy`) on the preview server that forwards whitelisted requests and adds `Access-Control-Allow-Origin: *`.
- On the frontend, route external URLs through `/api/proxy` when `Platform.OS === 'web'` and the host is not the current origin.
- Keep the proxy host allow-list small to avoid turning the server into an open relay.

**Why:** The Android app uses native fetch without CORS, but the web preview must obey same-origin policy. A same-origin proxy lets the web preview use the same data sources without changing the repository adapters.
**How to apply:** When adding new external data sources (e.g., more GitHub endpoints, new repository icons), add their hostnames to the proxy allow-list and use `proxyUrl()` for any fetch or image URL that needs to load on web.
