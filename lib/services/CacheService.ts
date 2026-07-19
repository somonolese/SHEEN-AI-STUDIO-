import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { App, Category, Repository } from '@/lib/types';

// ─── CacheService ───────────────────────────────────────────────────────────
//
// Persistent cache for repository metadata, app catalogs, and small assets.
// Uses AsyncStorage for JSON metadata and expo-file-system for the large apps array.

const CACHE_VERSION = 4;
const PREFIX = 'sheen:v4:';

const KEYS = {
  cacheVersion: `${PREFIX}cache-version`,
  repositories: `${PREFIX}repositories`,
  categories: `${PREFIX}categories`,
  lastFullSync: `${PREFIX}last-full-sync`,
  basket: `${PREFIX}basket`,
  notifications: `${PREFIX}notifications`,
  downloadTasks: `${PREFIX}download-tasks`,
  updateSettings: `${PREFIX}update-settings`,
};

const APPS_FILE_PATH = `${FileSystem.documentDirectory}sheen_apps_cache.json`;

export interface CachedCatalog {
  repositories: Repository[];
  apps: App[];
  categories: Category[];
  lastSync: number;
}

export interface BasketState {
  items: Record<string, { addedAt: number; queued?: boolean }>;
}

export interface NotificationState {
  items: import('@/lib/types').AppNotification[];
}

export interface DownloadState {
  tasks: import('@/lib/types').DownloadTask[];
}

export interface UpdateSettings {
  ignoredPackages: string[];
  ignoredVersions: Record<string, string>;
  lastCheck: number;
  autoCheckMode: 'auto' | 'notify' | 'manual';
  wifiOnly: boolean;
  chargingOnly: boolean;
}

/** Robust, lightweight IndexedDB helpers for high-capacity persistence in the browser preview iframe */
function writeWebDb(key: string, value: any): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined' || Platform.OS !== 'web') {
        resolve();
        return;
      }
      const request = indexedDB.open('sheen_web_db', 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv');
        }
      };
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction('kv', 'readwrite');
        const store = tx.objectStore('kv');
        store.put(value, key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function readWebDb(key: string): Promise<any | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined' || Platform.OS !== 'web') {
        resolve(null);
        return;
      }
      const request = indexedDB.open('sheen_web_db', 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv');
        }
      };
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction('kv', 'readonly');
        const store = tx.objectStore('kv');
        const getReq = store.get(key);
        getReq.onsuccess = () => {
          db.close();
          resolve(getReq.result || null);
        };
        getReq.onerror = () => {
          db.close();
          resolve(null);
        };
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Ensure schema migrations run before any read. */
async function ensureMigrated(): Promise<void> {
  const stored = await AsyncStorage.getItem(KEYS.cacheVersion);
  if (stored && Number(stored) === CACHE_VERSION) return;
  // If the version changed, clear all SHEEN metadata caches (not user settings).
  await clearMetadataCache();
  await AsyncStorage.setItem(KEYS.cacheVersion, String(CACHE_VERSION));
}

export async function clearMetadataCache(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const ours = allKeys.filter((k) => k.startsWith('sheen:'));
  await AsyncStorage.multiRemove(ours);
  if (Platform.OS === 'web') {
    await writeWebDb('apps', []);
  } else {
    try {
      const info = await FileSystem.getInfoAsync(APPS_FILE_PATH);
      if (info.exists) {
        await FileSystem.deleteAsync(APPS_FILE_PATH);
      }
    } catch (e) {}
  }
}

export async function saveCatalog(catalog: CachedCatalog): Promise<void> {
  await ensureMigrated();
  const pairs: readonly [string, string][] = [
    [KEYS.repositories, JSON.stringify(catalog.repositories)],
    [KEYS.categories, JSON.stringify(catalog.categories)],
    [KEYS.lastFullSync, JSON.stringify(catalog.lastSync)],
  ];
  await AsyncStorage.multiSet(pairs as any);
  
  if (Platform.OS === 'web') {
    await writeWebDb('apps', catalog.apps);
  } else {
    // Save apps array to file system to avoid AsyncStorage size limits
    try {
      await FileSystem.writeAsStringAsync(APPS_FILE_PATH, JSON.stringify(catalog.apps));
    } catch (e) {
      console.warn('[CacheService] Failed to save apps to file system:', e);
    }
  }
}

export async function loadCatalog(): Promise<CachedCatalog | null> {
  await ensureMigrated();
  const [[, reposRaw], [, catsRaw], [, syncRaw]] = await AsyncStorage.multiGet([
    KEYS.repositories,
    KEYS.categories,
    KEYS.lastFullSync,
  ]);

  if (catsRaw === null) return null;

  let apps: App[] = [];
  if (Platform.OS === 'web') {
    const loadedApps = await readWebDb('apps');
    if (loadedApps && Array.isArray(loadedApps)) {
      apps = loadedApps;
    }
  } else {
    try {
      const info = await FileSystem.getInfoAsync(APPS_FILE_PATH);
      if (info.exists) {
        const appsStr = await FileSystem.readAsStringAsync(APPS_FILE_PATH);
        apps = JSON.parse(appsStr);
      }
    } catch (e) {
      console.warn('[CacheService] Failed to load apps from file system:', e);
    }
  }

  try {
    return {
      repositories: reposRaw ? JSON.parse(reposRaw) : [],
      apps,
      categories: JSON.parse(catsRaw),
      lastSync: syncRaw ? JSON.parse(syncRaw) : 0,
    };
  } catch (e) {
    console.warn('[CacheService] Failed to parse catalog cache:', e);
    return null;
  }
}

export async function saveApp(app: App): Promise<void> {
  await ensureMigrated();
  const catalog = await loadCatalog();
  if (!catalog) return;
  const idx = catalog.apps.findIndex((a) => a.id === app.id);
  if (idx >= 0) {
    catalog.apps[idx] = app;
  } else {
    catalog.apps.push(app);
  }
  await saveCatalog(catalog);
}

export async function getCachedApp(id: string): Promise<App | null> {
  const catalog = await loadCatalog();
  return catalog?.apps.find((a) => a.id === id) || null;
}

export async function saveBasket(state: BasketState): Promise<void> {
  await AsyncStorage.setItem(KEYS.basket, JSON.stringify(state));
}

export async function loadBasket(): Promise<BasketState> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.basket);
    return raw ? JSON.parse(raw) : { items: {} };
  } catch {
    return { items: {} };
  }
}

export async function saveNotifications(state: NotificationState): Promise<void> {
  await AsyncStorage.setItem(KEYS.notifications, JSON.stringify(state));
}

export async function loadNotifications(): Promise<NotificationState> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.notifications);
    return raw ? JSON.parse(raw) : { items: [] };
  } catch {
    return { items: [] };
  }
}

export async function saveDownloads(state: DownloadState): Promise<void> {
  await AsyncStorage.setItem(KEYS.downloadTasks, JSON.stringify(state));
}

export async function loadDownloads(): Promise<DownloadState> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.downloadTasks);
    return raw ? JSON.parse(raw) : { tasks: [] };
  } catch {
    return { tasks: [] };
  }
}

export async function saveUpdateSettings(state: UpdateSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.updateSettings, JSON.stringify(state));
}

export async function loadUpdateSettings(): Promise<UpdateSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.updateSettings);
    return raw ? { autoCheckMode: 'notify', wifiOnly: true, chargingOnly: false, ignoredVersions: {}, ...JSON.parse(raw) } : { ignoredPackages: [], ignoredVersions: {}, lastCheck: 0, autoCheckMode: 'notify', wifiOnly: true, chargingOnly: false };
  } catch {
    return { ignoredPackages: [], ignoredVersions: {}, lastCheck: 0, autoCheckMode: 'notify', wifiOnly: true, chargingOnly: false };
  }
}

export async function clearAll(): Promise<void> {
  await clearMetadataCache();
}

export async function getLastFullSync(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.lastFullSync);
    return raw ? JSON.parse(raw) : 0;
  } catch {
    return 0;
  }
}
