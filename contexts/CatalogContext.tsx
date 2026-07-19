import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { App, Category, Repository, SyncProgress } from '@/lib/types';
import {
  createAdapter,
  defaultRepositories,
  GitHubRepoConfig,
} from '@/lib/repositories/RepositoryRegistry';
import { loadCatalog } from '@/lib/services/CacheService';
import { PREMIUM_CATEGORIES } from '@/lib/categories';
import { emitNotification } from '@/lib/services/NotificationService';
import { isCorsError, isOfflineError } from '@/lib/services/Network';
import { sqliteService } from '@/lib/services/SQLiteService';
import { repositoryManager } from '@/lib/services/RepositoryManager';

type SyncState = 'idle' | 'syncing' | 'error' | 'success';

interface CatalogContextValue {
  repositories: Repository[];
  apps: App[];
  categories: Category[];
  appsById: Map<string, App>;
  appsByPackage: Map<string, App>;
  syncState: SyncState;
  syncProgress: SyncProgress[];
  lastSync: number;
  isLoading: boolean;
  error?: string;
  imageErrors: Record<string, number>;

  // Actions
  syncRepositories(): Promise<void>;
  addRepository(repo: Repository, githubConfig?: GitHubRepoConfig): Promise<void>;
  removeRepository(id: string): Promise<void>;
  setRepositoryEnabled(id: string, enabled: boolean): Promise<void>;
  reorderRepositories(ids: string[]): Promise<void>;
  getAppById(id: string): App | undefined;
  getAppByPackage(packageName: string): App | undefined;
  getAppsByCategory(categoryId: string): App[];
  retryImage(url: string): void;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncProgress, setSyncProgress] = useState<SyncProgress[]>([]);
  const [lastSync, setLastSync] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [imageErrors, setImageErrors] = useState<Record<string, number>>({});

  const enabledRepoIds = useMemo(() => {
    return new Set(repositories.filter((r) => r.enabled).map((r) => r.id));
  }, [repositories]);

  // Read apps from SQLite that correspond to enabled repositories
  const visibleApps = useMemo(() => {
    return apps.filter((app) => enabledRepoIds.has(app.repositoryId));
  }, [apps, enabledRepoIds]);

  const appsById = useMemo(() => {
    const map = new Map<string, App>();
    for (const app of visibleApps) map.set(app.id, app);
    return map;
  }, [visibleApps]);

  const appsByPackage = useMemo(() => {
    const map = new Map<string, App>();
    for (const app of visibleApps) map.set(app.packageName, app);
    return map;
  }, [visibleApps]);

  const visibleCategories = useMemo(() => {
    const appCounts = new Map<string, number>();
    for (const app of visibleApps) {
      if (app.categoryId) {
        appCounts.set(app.categoryId, (appCounts.get(app.categoryId) ?? 0) + 1);
      }
    }
    return PREMIUM_CATEGORIES.map(cat => ({
      ...cat,
      appCount: appCounts.get(cat.id) ?? 0
    })).filter(cat => cat.appCount > 0)
       .sort((a, b) => {
         if (a.appCount !== b.appCount) return b.appCount - a.appCount;
         return a.name.localeCompare(b.name);
       });
  }, [visibleApps]);

  const retryImage = useCallback((url: string) => {
    setImageErrors((prev) => ({ ...prev, [url]: (prev[url] || 0) + 1 }));
  }, []);

  // Refresh context state from SQLite
  const refreshFromSQLite = useCallback(async () => {
    try {
      const dbRepos = await sqliteService.getRepositories();
      const dbApps = await sqliteService.getApps({ limit: 5000 }); // baseline limits for global context matching
      const dbCategories = await sqliteService.getCategories();

      setRepositories(dbRepos);
      setApps(dbApps);
      setCategories(dbCategories);

      if (dbRepos.length > 0) {
        const lastSyncTimes = dbRepos.map(r => r.lastSyncAt || 0);
        setLastSync(Math.max(...lastSyncTimes, 0));
      }
    } catch (e) {
      console.error('[CatalogContext] Error refreshing from SQLite:', e);
    }
  }, []);

  const initializeDefaults = useCallback(async (): Promise<void> => {
    const repos = defaultRepositories();
    for (const r of repos) {
      await sqliteService.saveRepository(r);
    }
    await refreshFromSQLite();
  }, [refreshFromSQLite]);

  // Load cached catalog on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await sqliteService.init();

        // ─── LEGACY CACHE MIGRATION ───
        const alreadyMigrated = await sqliteService.isMigrated();
        if (!alreadyMigrated) {
          const legacyCached = await loadCatalog();
          if (legacyCached && (legacyCached.repositories.length > 0 || legacyCached.apps.length > 0)) {
            await sqliteService.syncCatalogData(
              legacyCached.repositories,
              legacyCached.apps,
              legacyCached.categories || []
            );
          }
          await sqliteService.markAsMigrated();
        }

        // Fetch from SQLite database
        const dbRepos = await sqliteService.getRepositories();
        if (dbRepos.length === 0) {
          if (!cancelled) {
            await initializeDefaults();
          }
        } else {
          if (!cancelled) {
            await refreshFromSQLite();
          }
        }
      } catch (e) {
        console.warn('[CatalogContext] Failed to load from SQLite, seeding defaults:', e);
        if (!cancelled) {
          await initializeDefaults();
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [initializeDefaults, refreshFromSQLite]);

  const syncRepositories = useCallback(async () => {
    if (syncState === 'syncing') return;
    setSyncState('syncing');
    setError(undefined);
    setSyncProgress([]);

    const progressMap = new Map<string, SyncProgress>();

    try {
      const { apps: syncedApps } = await repositoryManager.syncRepositories((p) => {
        progressMap.set(p.repositoryId, p);
        setSyncProgress(Array.from(progressMap.values()));
      });

      await refreshFromSQLite();
      setSyncState('success');
      
      const activeReposCount = repositories.filter(r => r.enabled).length;
      emitNotification(
        'sync_finished',
        'Repository sync finished',
        `Updated ${syncedApps.length} apps from ${activeReposCount} repositories.`
      );
    } catch (e) {
      const message = String((e as Error).message || e);
      setError(message);
      setSyncState('error');
      emitNotification('error', 'Repository sync failed', message);
    }
  }, [repositories, syncState, refreshFromSQLite]);

  // Auto-sync on first launch when no cache exists
  const autoSynced = useRef(false);
  useEffect(() => {
    if (!isLoading && apps.length === 0 && repositories.length > 0 && !autoSynced.current && syncState === 'idle') {
      autoSynced.current = true;
      syncRepositories();
    }
  }, [isLoading, apps.length, repositories, syncRepositories, syncState]);

  const addRepository = useCallback(async (repo: Repository, githubConfig?: GitHubRepoConfig) => {
    await repositoryManager.addRepository(repo, githubConfig);
    await refreshFromSQLite();
  }, [refreshFromSQLite]);

  const removeRepository = useCallback(async (id: string) => {
    await repositoryManager.removeRepository(id);
    await refreshFromSQLite();
  }, [refreshFromSQLite]);

  const setRepositoryEnabled = useCallback(async (id: string, enabled: boolean) => {
    await repositoryManager.setRepositoryEnabled(id, enabled);
    await refreshFromSQLite();
  }, [refreshFromSQLite]);

  const reorderRepositories = useCallback(async (ids: string[]) => {
    await repositoryManager.reorderRepositories(ids);
    await refreshFromSQLite();
  }, [refreshFromSQLite]);

  const getAppById = useCallback((id: string) => appsById.get(id), [appsById]);
  const getAppByPackage = useCallback((pkg: string) => appsByPackage.get(pkg), [appsByPackage]);
  
  const getFullAppById = useCallback(async (id: string) => {
    return await sqliteService.getAppById(id);
  }, []);

  const getAppsByCategory = useCallback(
    (categoryId: string) => visibleApps.filter((a) => a.categoryId === categoryId),
    [visibleApps],
  );

  const value: CatalogContextValue = {
    repositories,
    apps: visibleApps,
    categories: visibleCategories,
    appsById,
    appsByPackage,
    syncState,
    syncProgress,
    lastSync,
    isLoading,
    error,
    imageErrors,
    syncRepositories,
    addRepository,
    removeRepository,
    setRepositoryEnabled,
    reorderRepositories,
    getAppById,
    getFullAppById,
    getAppByPackage,
    getAppsByCategory,
    retryImage,
  };

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within a CatalogProvider');
  return ctx;
}
