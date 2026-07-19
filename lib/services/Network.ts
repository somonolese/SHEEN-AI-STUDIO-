// ─── Network utilities ──────────────────────────────────────────────────────
//
// React Native Android uses the native fetch, which has no CORS restrictions.
// On the web preview, CORS may block direct requests to F-Droid/Izzy/GitHub
// assets. We try the direct request first; if it fails due to CORS we degrade
// gracefully and let the UI surface a retry / offline option.

import { Platform } from 'react-native';

const CORS_PROXY_HOSTS = new Set([
  'f-droid.org',
  'www.f-droid.org',
  'apt.izzysoft.de',
  'www.izzysoft.de',
  'img.izzysoft.de',
  'github.com',
  'api.github.com',
  'raw.githubusercontent.com',
  'codeload.github.com',
  'github-releases.githubusercontent.com',
  'gitlab.com',
  'fdroid.gitlab.io',
]);

function shouldProxy(url: string): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (u.host === window.location.host) return false;
    return CORS_PROXY_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

export function proxyUrl(url: string): string {
  if (!shouldProxy(url)) return url;
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithRetry(url, init);
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new NetworkError('CORS proxy failed or endpoint returned HTML', response.status, url);
  }
  try {
    const text = await response.text(); 
    return JSON.parse(text) as T;
  } catch (e) {
    throw new NetworkError(`Failed to parse JSON from ${url}: ${(e as Error).message}`, response.status, url);
  }
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetchWithRetry(url, init);
  return response.text();
}

export async function fetchWithRetry(url: string, init?: RequestInit, retries = 1): Promise<Response> {
  const resolvedUrl = proxyUrl(url);
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      const response = await fetch(resolvedUrl, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json,application/octet-stream,*/*',
          ...init?.headers,
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new NetworkError(`HTTP ${response.status} for ${url}`, response.status, url);
      }

      return response;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1_000 * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new NetworkError(`Network request failed for ${url}`, undefined, url);
}

export function isCorsError(error: unknown): boolean {
  if (error instanceof NetworkError) return false;
  const message = String((error as Error)?.message ?? error).toLowerCase();
  return (
    message.includes('cors') ||
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('networkrequest') ||
    (Platform.OS === 'web' && message.includes('aborted'))
  );
}

export function isOfflineError(error: unknown): boolean {
  const message = String((error as Error)?.message ?? error).toLowerCase();
  return (
    message.includes('offline') ||
    message.includes('no internet') ||
    message.includes('network request failed') ||
    message.includes('unable to resolve')
  );
}
