import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { App } from '@/lib/types';
import { proxyUrl } from '@/lib/services/Network';
import { smartImageCacheService } from '@/lib/services/SmartImageCacheService';

export interface IconCacheEntry {
  resolvedUrl: string;
  localUri?: string;
  lastUpdated: number;
  cachedAt: number;
  failed?: boolean;
}

const REGISTRY_KEY = 'sheen:v3:icon-registry';
const LOCAL_DIR = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}sheen_icons/`;

let registry: Record<string, IconCacheEntry> = {};
let isInitialized = false;
let initPromise: Promise<void> | null = null;
const memoryCache = new Map<string, string>(); // appId -> resolved URI/URL


export async function initIconCache(): Promise<void> {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Load registry from AsyncStorage
      const stored = await AsyncStorage.getItem(REGISTRY_KEY);
      if (stored) {
        registry = JSON.parse(stored);
      }
      
      // 2. Populate memory cache
      for (const [appId, entry] of Object.entries(registry)) {
        if (entry.failed) continue;
        if (Platform.OS === 'web') {
          memoryCache.set(appId, entry.resolvedUrl);
        } else if (entry.localUri) {
          memoryCache.set(appId, entry.localUri);
        }
      }

      // 3. Ensure native directory exists
      if (Platform.OS !== 'web') {
        const dirInfo = await FileSystem.getInfoAsync(LOCAL_DIR);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(LOCAL_DIR, { intermediates: true });
        }
      }
    } catch (e) {
      console.warn('[IconCacheService] Initialization error:', e);
    } finally {
      isInitialized = true;
    }
  })();

  return initPromise;
}

export function getCachedIconSync(app: App): string | undefined {
  return memoryCache.get(app.id);
}

export function getRepoBaseUrl(app: App): string {
  if (!app.iconUrl) return '';
  
  // Look for standard icon folders in path
  const match = app.iconUrl.match(/(https?:\/\/[^\/]+(?:\/[^\/]+)*?)\/(icons(?:-\d+)?)\//);
  if (match) {
    return match[1];
  }
  
  // Fallback: just strip the last segment (filename)
  const parts = app.iconUrl.split('/');
  if (parts.length > 1) {
    parts.pop();
    return parts.join('/');
  }
  return '';
}

async function verifyUrl(url: string): Promise<{ ok: boolean; status: number }> {
  try {
    const proxied = proxyUrl(url);
    // Try HEAD request first for speed
    let res = await fetch(proxied, { method: 'HEAD' });
    if (res.status === 200) {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.startsWith('image/')) {
        return { ok: true, status: 200 };
      }
    }
    
    // Fallback to GET
    res = await fetch(proxied, { method: 'GET' });
    if (res.ok) {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.startsWith('image/')) {
        return { ok: true, status: res.status };
      }
    }
    return { ok: false, status: res.status };
  } catch (e) {
    return { ok: false, status: 500 };
  }
}

export async function getResolvedIconUri(app: App): Promise<string | null> {
  await initIconCache();
  
  const entry = registry[app.id];
  const isExpired = entry ? (app.lastUpdated > entry.lastUpdated) : true;
  
  // Check if local file actually exists on native
  let localFileExists = false;
  if (entry && entry.localUri && Platform.OS !== 'web') {
    try {
      const info = await FileSystem.getInfoAsync(entry.localUri);
      localFileExists = info.exists;
    } catch {}
  }
  
  const useCache = entry && !isExpired && !entry.failed && (Platform.OS === 'web' || localFileExists);
  
  if (useCache) {
    const cachedUri = Platform.OS === 'web' ? entry.resolvedUrl : entry.localUri!;
    
    // Debug logging removed
    
    return cachedUri;
  }
  
  if (entry && entry.failed && !isExpired) {
    // Already verified to fail and not expired, return null to fallback to initials
    return null;
  }
  
  // Otherwise, we need to perform fresh resolution
  try {
    const filename = app.iconUrl ? app.iconUrl.split('/').pop() : undefined;
    if (!app.iconUrl) {
      return null;
    }
    
    const candidates: string[] = [app.iconUrl];
    const baseUrl = getRepoBaseUrl(app);
    
    if (filename && baseUrl && (app.repositoryId.includes('fdroid') || app.repositoryId.includes('izzy') || app.source === 'F-Droid' || app.source === 'IzzyOnDroid')) {
      const densities = ['icons-640', 'icons-480', 'icons-320', 'icons-240', 'icons-160', 'icons'];
      for (const d of densities) {
        const candidateUrl = `${baseUrl}/${d}/${filename}`;
        if (!candidates.includes(candidateUrl)) {
          candidates.push(candidateUrl);
        }
      }
      const rootCandidate = `${baseUrl}/${filename}`;
      if (!candidates.includes(rootCandidate)) {
        candidates.push(rootCandidate);
      }
    }
    
    let resolvedUrl = '';
    let status = 404;
    
    for (const candidate of candidates) {
      const { ok, status: s } = await verifyUrl(candidate);
      if (ok) {
        resolvedUrl = candidate;
        status = s;
        break;
      }
    }
    
    let localUri: string | undefined;
    if (resolvedUrl) {
      try {
        const cachedPath = await smartImageCacheService.getAndCacheImage(resolvedUrl, 'icon', {
          id: app.id,
          lastUpdated: app.lastUpdated || 0,
          packageName: app.packageName,
        });
        if (cachedPath) {
          localUri = cachedPath;
        }
      } catch (e) {
        console.warn(`[IconCacheService] SmartImageCache download failed for ${app.packageName}:`, e);
      }
    }
    
    const cacheEntry: IconCacheEntry = {
      resolvedUrl,
      localUri,
      lastUpdated: app.lastUpdated || 0,
      cachedAt: Date.now(),
      failed: !resolvedUrl,
    };
    
    registry[app.id] = cacheEntry;
    await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    
    const loadedSuccess = !!resolvedUrl && (Platform.OS === 'web' || !!localUri);
    const finalUri = Platform.OS === 'web' ? resolvedUrl : (localUri || resolvedUrl);
    
    if (loadedSuccess && finalUri) {
      memoryCache.set(app.id, finalUri);
    }
    
    // Debug logging removed
    
    return loadedSuccess ? finalUri : null;
  } catch (e) {
    console.warn(`[IconCacheService] Failed to resolve icon for ${app.packageName}:`, e);
    return null;
  }
}
