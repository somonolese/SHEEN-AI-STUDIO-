import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { proxyUrl } from '@/lib/services/Network';

export type ImageCacheType = 'icon' | 'screenshot' | 'banner' | 'avatar' | 'repo_logo';

export interface ImageCacheRegistryEntry {
  url: string;
  localUri: string;
  type: ImageCacheType;
  size: number;
  etag?: string;
  lastModified?: string;
  lastUpdated: number; // Metadata sync timestamp
  cachedAt: number;
  lastAccessedAt: number;
  appId?: string;
}

const REGISTRY_KEY = 'sheen:v4:smart-image-registry';

const CACHE_DIRS: Record<ImageCacheType, string> = {
  icon: `${FileSystem.cacheDirectory || FileSystem.documentDirectory}sheen_cache_icons/`,
  screenshot: `${FileSystem.cacheDirectory || FileSystem.documentDirectory}sheen_cache_screenshots/`,
  banner: `${FileSystem.cacheDirectory || FileSystem.documentDirectory}sheen_cache_banners/`,
  avatar: `${FileSystem.cacheDirectory || FileSystem.documentDirectory}sheen_cache_avatars/`,
  repo_logo: `${FileSystem.cacheDirectory || FileSystem.documentDirectory}sheen_cache_repos/`,
};

// Size thresholds in bytes for automatic cache eviction
const CACHE_SIZE_THRESHOLDS: Record<ImageCacheType, number> = {
  icon: 15 * 1024 * 1024,        // 15 MB max
  screenshot: 50 * 1024 * 1024,  // 50 MB max
  banner: 20 * 1024 * 1024,      // 20 MB max
  avatar: 5 * 1024 * 1024,        // 5 MB max
  repo_logo: 5 * 1024 * 1024,     // 5 MB max
};

class SmartImageCacheService {
  private registry: Record<string, ImageCacheRegistryEntry> = {};
  private memoryCache = new Map<string, string>(); // url -> localUri or base64
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private activeDownloads = new Map<string, Promise<string | null>>();

  constructor() {
    this.init();
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        if (Platform.OS === 'web') {
          this.isInitialized = true;
          return;
        }

        // 1. Load registry from AsyncStorage
        const stored = await AsyncStorage.getItem(REGISTRY_KEY);
        if (stored) {
          this.registry = JSON.parse(stored);
        }

        // 2. Ensure all separate cache directories exist
        for (const dirPath of Object.values(CACHE_DIRS)) {
          const dirInfo = await FileSystem.getInfoAsync(dirPath);
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
          }
        }

        // 3. Populate memory cache and prune missing files
        const updatedRegistry: Record<string, ImageCacheRegistryEntry> = {};
        for (const [url, entry] of Object.entries(this.registry)) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(entry.localUri);
            if (fileInfo.exists) {
              this.memoryCache.set(url, entry.localUri);
              updatedRegistry[url] = entry;
            }
          } catch {
            // Prune entries pointing to deleted files
          }
        }

        this.registry = updatedRegistry;
        await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(this.registry));
      } catch (e) {
        console.warn('[SmartImageCache] Initialization failed:', e);
      } finally {
        this.isInitialized = true;
      }
    })();

    return this.initPromise;
  }

  /**
   * Generates a safe local filename based on the URL
   */
  private getLocalPath(url: string, type: ImageCacheType): string {
    const cleanUrl = url.replace(/[^a-zA-Z0-9]/g, '_');
    // Ensure file extension is preserved where possible
    let ext = '.png';
    const match = url.match(/\.(png|jpg|jpeg|webp|gif|svg)(?:\?|$)/i);
    if (match) {
      ext = `.${match[1].toLowerCase()}`;
    }
    // Manipulator output might convert webp/gif to png/jpeg, so we use jpeg/png mostly.
    return `${CACHE_DIRS[type]}${cleanUrl}${ext}`;
  }

  /**
   * Helper to perform image optimization (resize, format convert, compress)
   */
  private async optimizeImage(
    sourceUri: string,
    type: ImageCacheType,
    hasAlphaChannel = true
  ): Promise<string> {
    if (Platform.OS === 'web') return sourceUri;

    try {
      let width: number | undefined;
      let height: number | undefined;
      let format = hasAlphaChannel ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG;
      let compress = 0.85;

      switch (type) {
        case 'icon':
        case 'avatar':
          width = 160;
          height = 160;
          compress = 0.85;
          break;
        case 'repo_logo':
          width = 120;
          height = 120;
          compress = 0.85;
          break;
        case 'banner':
          width = 720;
          compress = 0.8;
          format = ImageManipulator.SaveFormat.JPEG; // Force JPEG for banners for major file size saving
          break;
        case 'screenshot':
          width = 640; // Optimize for mobile screens
          compress = 0.8;
          format = ImageManipulator.SaveFormat.JPEG; // JPEG for screenshot compression
          break;
      }

      const actions: ImageManipulator.Action[] = [];
      if (width) {
        actions.push({ resize: { width, height } });
      }

      // Manipulate image
      const result = await ImageManipulator.manipulateAsync(
        sourceUri,
        actions,
        { compress, format }
      );

      return result.uri;
    } catch (e) {
      console.warn('[SmartImageCache] Optimization failed, keeping original:', e);
      return sourceUri;
    }
  }

  /**
   * Resolves and returns cached image uri or downloads/caches it
   */
  async getAndCacheImage(
    url: string,
    type: ImageCacheType,
    appInfo?: { id: string; lastUpdated: number; packageName?: string }
  ): Promise<string | null> {
    if (!url) return null;
    await this.init();

    // 1. Check memory cache first
    const memCached = this.memoryCache.get(url);
    if (memCached) {
      if (this.registry[url]) {
        this.registry[url].lastAccessedAt = Date.now();
      }
      return memCached;
    }

    // 2. Check registry and disk cache
    const entry = this.registry[url];
    if (entry) {
      const isExpired = appInfo ? appInfo.lastUpdated > entry.lastUpdated : false;
      if (!isExpired) {
        if (Platform.OS === 'web') {
          return url;
        }
        try {
          const fileInfo = await FileSystem.getInfoAsync(entry.localUri);
          if (fileInfo.exists) {
            entry.lastAccessedAt = Date.now();
            this.memoryCache.set(url, entry.localUri);
            this.saveRegistryDebounced();
            return entry.localUri;
          }
        } catch {}
      }
    }

    // 3. Handle concurrent duplicate downloads of same image
    if (this.activeDownloads.has(url)) {
      return this.activeDownloads.get(url)!;
    }

    const downloadPromise = (async () => {
      try {
        if (Platform.OS === 'web') {
          const finalUrl = proxyUrl(url);
          this.memoryCache.set(url, finalUrl);
          return finalUrl;
        }

        const localPath = this.getLocalPath(url, type);
        const tempPath = `${FileSystem.cacheDirectory}temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const headers: Record<string, string> = {};
        if (entry && entry.etag) {
          headers['If-None-Match'] = entry.etag;
        }
        if (entry && entry.lastModified) {
          headers['If-Modified-Since'] = entry.lastModified;
        }

        // Run download through proxy
        const proxiedUrl = proxyUrl(url);
        
        let downloadResult;
        try {
          downloadResult = await FileSystem.downloadAsync(proxiedUrl, tempPath, { headers });
        } catch (downloadErr) {
          // If we fail and have an older disk version, reuse it as fallback
          if (entry) {
            return entry.localUri;
          }
          throw downloadErr;
        }

        // Handle HTTP 304 Not Modified
        if (downloadResult.status === 304 && entry) {
          entry.lastAccessedAt = Date.now();
          entry.cachedAt = Date.now();
          if (appInfo) {
            entry.lastUpdated = appInfo.lastUpdated;
          }
          this.memoryCache.set(url, entry.localUri);
          this.saveRegistryDebounced();
          
          // Cleanup temp file
          try {
            await FileSystem.deleteAsync(tempPath, { idempotent: true });
          } catch {}

          return entry.localUri;
        }

        if (downloadResult.status !== 200) {
          // Cleanup temp file
          try {
            await FileSystem.deleteAsync(tempPath, { idempotent: true });
          } catch {}

          if (entry) {
            return entry.localUri; // Fallback to stale cache
          }
          throw new Error(`HTTP Status ${downloadResult.status} downloading image`);
        }

        // Auto-detect transparency for PNG icons to preserve opacity channels
        const hasAlpha = url.toLowerCase().includes('.png') || url.toLowerCase().includes('.svg');

        // 4. Optimization Pipeline
        const optimizedUri = await this.optimizeImage(tempPath, type, hasAlpha);

        // Move to final separate cache folder location
        await FileSystem.moveAsync({
          from: optimizedUri,
          to: localPath,
        });

        // Clean up raw temp download if it differs
        if (optimizedUri !== tempPath) {
          try {
            await FileSystem.deleteAsync(tempPath, { idempotent: true });
          } catch {}
        }

        // Get file info for final size
        const finalInfo = await FileSystem.getInfoAsync(localPath);
        const finalSize = finalInfo.exists ? finalInfo.size : 0;

        const etag = downloadResult.headers['etag'] || downloadResult.headers['ETag'];
        const lastModified = downloadResult.headers['last-modified'] || downloadResult.headers['Last-Modified'];

         const newEntry: ImageCacheRegistryEntry = {
          url,
          localUri: localPath,
          type,
          size: finalSize,
          etag,
          lastModified,
          lastUpdated: appInfo ? appInfo.lastUpdated : Date.now(),
          cachedAt: Date.now(),
          lastAccessedAt: Date.now(),
          appId: appInfo?.id,
        };

        this.registry[url] = newEntry;
        this.memoryCache.set(url, localPath);
        this.saveRegistryDebounced();

        // Check if total storage limit of this category is exceeded, run eviction
        this.triggerEvictionIfNeeded(type);

        return localPath;
      } catch (err) {
        console.warn(`[SmartImageCache] Image fetch failed for ${url}:`, err);
        // On error, check if we have any existing stale file as a fallback
        if (entry) {
          return entry.localUri;
        }
        return null;
      } finally {
        this.activeDownloads.delete(url);
      }
    })();

    this.activeDownloads.set(url, downloadPromise);
    return downloadPromise;
  }

  /**
   * Prefetches a list of images in the background to ensure lag-free rendering
   */
  prefetchImages(urls: string[], type: ImageCacheType): void {
    if (Platform.OS === 'web') return;
    
    // Process sequentially in background to avoid networking congestion
    (async () => {
      for (const url of urls) {
        try {
          await this.getAndCacheImage(url, type);
        } catch {}
      }
    })();
  }

  /**
   * Triggers background eviction when directory limits are reached
   */
  private async triggerEvictionIfNeeded(type: ImageCacheType): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      const typeEntries = Object.values(this.registry).filter((e) => e.type === type);
      const totalSize = typeEntries.reduce((sum, e) => sum + e.size, 0);
      const threshold = CACHE_SIZE_THRESHOLDS[type];

      if (totalSize > threshold) {
        // Sort by lastAccessedAt (Oldest first)
        typeEntries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

        let freedBytes = 0;
        const targetToFree = totalSize - (threshold * 0.7); // Evict down to 70% of threshold

        for (const entry of typeEntries) {
          if (freedBytes >= targetToFree) break;
          
          try {
            const info = await FileSystem.getInfoAsync(entry.localUri);
            if (info.exists) {
              await FileSystem.deleteAsync(entry.localUri, { idempotent: true });
              freedBytes += entry.size;
            }
            delete this.registry[entry.url];
            this.memoryCache.delete(entry.url);
          } catch {}
        }

        await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(this.registry));
      }
    } catch (e) {
      console.warn('[SmartImageCache] Eviction failed:', e);
    }
  }

  /**
   * Cleans up expired cache files (e.g. cached files older than 14 days)
   */
  async cleanExpiredCache(maxAgeMs = 14 * 24 * 60 * 60 * 1000): Promise<void> {
    if (Platform.OS === 'web') return;
    await this.init();

    try {
      const now = Date.now();
      const expiredEntries = Object.values(this.registry).filter(
        (e) => now - e.cachedAt > maxAgeMs
      );

      for (const entry of expiredEntries) {
        try {
          await FileSystem.deleteAsync(entry.localUri, { idempotent: true });
          delete this.registry[entry.url];
          this.memoryCache.delete(entry.url);
        } catch {}
      }

      await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(this.registry));
    } catch (e) {
      console.warn('[SmartImageCache] Failed cleaning expired cache:', e);
    }
  }

  /**
   * Refreshes outdated images following repository sync
   */
  async refreshOutdatedImages(syncedApps: { id: string; lastUpdated: number }[]): Promise<void> {
    if (Platform.OS === 'web') return;
    await this.init();

    try {
      const appMap = new Map(syncedApps.map((a) => [a.id, a.lastUpdated]));
      let outdatedCount = 0;

      for (const [url, entry] of Object.entries(this.registry)) {
        if (entry.appId && appMap.has(entry.appId)) {
          const syncedLastUpdated = appMap.get(entry.appId)!;
          if (syncedLastUpdated > entry.lastUpdated) {
            try {
              const info = await FileSystem.getInfoAsync(entry.localUri);
              if (info.exists) {
                await FileSystem.deleteAsync(entry.localUri, { idempotent: true });
              }
              delete this.registry[url];
              this.memoryCache.delete(url);
              outdatedCount++;
            } catch (err) {
              console.warn(`[SmartImageCache] Failed to delete outdated image for ${entry.appId}:`, err);
            }
          }
        }
      }

      if (outdatedCount > 0) {
        await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(this.registry));
      }
    } catch (e) {
      console.warn('[SmartImageCache] Failed refreshing outdated images:', e);
    }
  }

  /**
   * Completely clears all cached directories and registry
   */
  async clearAllCaches(): Promise<void> {
    if (Platform.OS === 'web') {
      this.memoryCache.clear();
      return;
    }
    await this.init();

    try {
      for (const dirPath of Object.values(CACHE_DIRS)) {
        try {
          const info = await FileSystem.getInfoAsync(dirPath);
          if (info.exists) {
            await FileSystem.deleteAsync(dirPath, { recursive: true });
            await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
          }
        } catch {}
      }

      this.registry = {};
      this.memoryCache.clear();
      await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(this.registry));
    } catch (e) {
      console.warn('[SmartImageCache] Failed to clear caches:', e);
    }
  }

  private saveTimeout: any;
  private saveRegistryDebounced(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(this.registry));
      } catch {}
    }, 2000);
  }
}

export const smartImageCacheService = new SmartImageCacheService();
