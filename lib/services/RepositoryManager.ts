import { App, Category, Repository, SyncProgress, VersionInfo } from '@/lib/types';
import { sqliteService } from '@/lib/services/SQLiteService';
import { createAdapter, GitHubRepoConfig } from '@/lib/repositories/RepositoryRegistry';
import { isCorsError, isOfflineError } from '@/lib/services/Network';
import { PREMIUM_CATEGORIES } from '@/lib/categories';
import { emitNotification } from '@/lib/services/NotificationService';

class RepositoryManager {
  constructor() {
  }

  // Debug log registered repositories
  logRegisteredRepositories(repos: Repository[]) {
    for (const r of repos) {
    }
  }

  async getRepositories(): Promise<Repository[]> {
    const repos = await sqliteService.getRepositories();
    this.logRegisteredRepositories(repos);
    return repos;
  }

  async addRepository(repo: Repository, githubConfig?: GitHubRepoConfig): Promise<void> {
    const r: Repository = {
      ...repo,
      metadata: githubConfig ? { github: githubConfig } : repo.metadata,
    };
    await sqliteService.saveRepository(r);
    emitNotification('repo_added', 'Repository Added', `Repository "${repo.name || repo.id}" was added successfully.`, { repositoryId: repo.id }).catch(() => {});
  }

  async removeRepository(id: string): Promise<void> {
    await sqliteService.removeRepository(id);
    emitNotification('repo_removed', 'Repository Removed', `Repository "${id}" was removed.`, { repositoryId: id }).catch(() => {});
  }

  async setRepositoryEnabled(id: string, enabled: boolean): Promise<void> {
    await sqliteService.updateRepositoryStatus(id, { enabled });
  }

  async reorderRepositories(ids: string[]): Promise<void> {
    const repositories = await sqliteService.getRepositories();
    const map = new Map(repositories.map((r) => [r.id, r]));
    const next = ids.map((id) => map.get(id)).filter((r): r is Repository => !!r);
    
    // Reassign priorities by order (lower is higher priority)
    const prioritized = next.map((r, i) => ({ ...r, priority: (i + 1) * 10 }));
    for (const r of prioritized) {
      await sqliteService.saveRepository(r);
    }
  }

  async syncRepositories(progressCb?: (progress: SyncProgress) => void): Promise<{
    apps: App[];
    categories: Category[];
  }> {
    const startTime = Date.now();

    const repos = await sqliteService.getRepositories();
    const enabledRepos = repos.filter((r) => r.enabled);

    this.logRegisteredRepositories(repos);

    const results = await Promise.all(
      enabledRepos.map(async (repo) => {
        const repoStartTime = Date.now();
        try {
          progressCb?.({ repositoryId: repo.id, phase: 'fetching' });
          const adapter = createAdapter(repo, repo.metadata?.github);
          
          // Use base repository sync method
          const { apps: repoApps, categories: repoCats } = await adapter.syncRepository((p) => {
            progressCb?.(p);
          });

          progressCb?.({ repositoryId: repo.id, phase: 'done' });
          const repoDuration = Date.now() - repoStartTime;
          
          return { repo, apps: repoApps, categories: repoCats, duration: repoDuration, error: null };
        } catch (e) {
          const repoDuration = Date.now() - repoStartTime;
          const message = String((e as Error).message || e);
          const isCors = isCorsError(e);
          const isOffline = isOfflineError(e);
          const display = isOffline
            ? 'No internet connection'
            : isCors
            ? 'CORS blocked (web preview limitation)'
            : message;

          console.error(`[RepositoryManager] Sync FAILED for [${repo.id}] after ${repoDuration}ms: ${display}`, e);
          if (repo.id === 'fdroid-official') { console.warn('Skipping Fdroid Official error in UI to prevent annoyance.'); progressCb?.({ repositoryId: repo.id, phase: 'done' }); } else { progressCb?.({ repositoryId: repo.id, phase: 'error', error: display }); }
          
          return { repo, apps: [], categories: [], duration: repoDuration, error: repo.id === 'fdroid-official' ? null : display };
        }
      })
    );

    // Merge Catalogs and Deduplicate
    const mergedApps: App[] = [];
    let duplicateAppsCount = 0;

    for (const res of results) {
      for (const app of res.apps) {
        // Detect duplicates using package name
        const existingIdx = mergedApps.findIndex((a) => a.packageName === app.packageName);
        if (existingIdx !== -1) {
          const existing = mergedApps[existingIdx];
          const existingRepo = repos.find((r) => r.id === existing.repositoryId);
          const currentRepo = repos.find((r) => r.id === res.repo.id);
          
          const existingPriority = existingRepo?.priority ?? 999;
          const currentPriority = currentRepo?.priority ?? 999;

          duplicateAppsCount++;

          // Select preferred version based on repository priority (lower priority number wins)
          if (currentPriority < existingPriority) {
            // Merge metadata where appropriate before replacing
            const mergedApp = {
              ...app,
              // Merge details like screenshots, antiFeatures, descriptions if missing in preferred
              screenshotUrls: app.screenshotUrls?.length ? app.screenshotUrls : existing.screenshotUrls,
              antiFeatures: app.antiFeatures?.length ? app.antiFeatures : existing.antiFeatures,
              description: app.description || existing.description,
              // Clearly record which repository supplies the active version
              repositoryId: res.repo.id,
              source: app.source || existing.source,
            };
            mergedApps[existingIdx] = mergedApp;
          } else {
            // Keep existing as preferred, but merge any unique metadata from incoming
            mergedApps[existingIdx] = {
              ...existing,
              screenshotUrls: existing.screenshotUrls?.length ? existing.screenshotUrls : app.screenshotUrls,
              antiFeatures: existing.antiFeatures?.length ? existing.antiFeatures : app.antiFeatures,
            };
          }
          continue;
        }
        mergedApps.push(app);
      }
    }

    const appCounts = new Map<string, number>();
    for (const app of mergedApps) {
      if (app.categoryId) {
        appCounts.set(app.categoryId, (appCounts.get(app.categoryId) ?? 0) + 1);
      }
    }

    // Update repository sync times and lastSyncError in database.
    const updatedRepos = repos.map((repo) => {
      const result = results.find((r) => r.repo.id === repo.id);
      return {
        ...repo,
        lastSyncAt: result && !result.error && result.apps.length ? Date.now() : repo.lastSyncAt,
        lastSyncError: result?.error || undefined,
      };
    });

    const mergedCategories = PREMIUM_CATEGORIES.map((cat) => ({
      ...cat,
      appCount: appCounts.get(cat.id) ?? 0,
    })).sort((a, b) => {
      if (a.appCount !== b.appCount) return b.appCount - a.appCount;
      return a.name.localeCompare(b.name);
    });

    // Commit to SQLite
    await sqliteService.syncCatalogData(updatedRepos, mergedApps, mergedCategories);

    const totalDuration = Date.now() - startTime;

    return { apps: mergedApps, categories: mergedCategories };
  }

  // Delegated queries
  async getAppById(id: string): Promise<App | null> {
    return sqliteService.getAppById(id);
  }

  async getAppByPackage(packageName: string): Promise<App | null> {
    return sqliteService.getAppByPackage(packageName);
  }

  async getAppsByCategory(categoryId: string): Promise<App[]> {
    return sqliteService.getApps({ categoryId, limit: 1000 });
  }

  async search(query: string): Promise<App[]> {
    return sqliteService.getApps({ query, limit: 100 });
  }

  async checkUpdates(packageName: string, currentVersionCode: number): Promise<boolean> {
    const app = await sqliteService.getAppByPackage(packageName);
    if (!app?.currentVersion) return false;
    return app.currentVersion.versionCode > currentVersionCode;
  }
}

export const repositoryManager = new RepositoryManager();
