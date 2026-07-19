import { App, Category, Repository, SyncProgress, VersionInfo } from '@/lib/types';
import { sqliteService } from '@/lib/services/SQLiteService';

export interface RepositoryAdapter {
  readonly repository: Repository;

  /**
   * Unified Repository Adapter Methods
   */
  syncRepository(progress?: (p: SyncProgress) => void): Promise<{ apps: App[]; categories: Category[] }>;
  fetchCatalog(): Promise<App[]>;
  fetchAppDetails(packageName: string): Promise<App | null>;
  search(query: string): Promise<App[]>;
  getCategories(): Promise<Category[]>;
  getLatestVersion(packageName: string): Promise<VersionInfo | null>;
  getScreenshots(packageName: string): Promise<string[]>;
  getPermissions(packageName: string): Promise<string[]>;
  getDeveloperApps(developer: string): Promise<App[]>;
  checkUpdates(packageName: string, currentVersionCode: number): Promise<boolean>;
  downloadApk(packageName: string, versionName: string): Promise<string>;

  /**
   * Fetch and parse the repository index. Should return full metadata for every
   * app. Implementations are expected to emit progress via the optional callback
   * and to throw only on unrecoverable errors (e.g. network unreachable, corrupt
   * index). Partial results are returned as an empty array with lastSyncError set
   * on the repository instead.
   */
  sync(progress?: (p: SyncProgress) => void): Promise<{ apps: App[]; categories: Category[] }>;

  /** Resolve a direct APK download URL for a specific version. */
  resolveApkUrl(packageName: string, version: { versionName: string; fileName?: string }): string;

  /** Build a full icon URL from a relative path. */
  resolveIconUrl(iconPath?: string): string | undefined;

  /** Build a full screenshot URL from a relative path. */
  resolveScreenshotUrl(screenshotPath?: string): string | undefined;
}

export abstract class BaseRepositoryAdapter implements RepositoryAdapter {
  readonly repository: Repository;

  constructor(repository: Repository) {
    this.repository = repository;
  }

  abstract sync(progress?: (p: SyncProgress) => void): Promise<{ apps: App[]; categories: Category[] }>;
  abstract resolveApkUrl(packageName: string, version: { versionName: string; fileName?: string }): string;
  abstract resolveIconUrl(iconPath?: string): string | undefined;
  abstract resolveScreenshotUrl(screenshotPath?: string): string | undefined;

  async syncRepository(progress?: (p: SyncProgress) => void): Promise<{ apps: App[]; categories: Category[] }> {
    const startTime = Date.now();
    try {
      const res = await this.sync(progress);
      return res;
    } catch (e) {
      console.error(`[Adapter:${this.repository.id}] syncRepository failed:`, e);
      throw e;
    }
  }

  async fetchCatalog(): Promise<App[]> {
    return sqliteService.getApps({ repositoryId: this.repository.id, limit: 1000 });
  }

  async fetchAppDetails(packageName: string): Promise<App | null> {
    const app = await sqliteService.getAppByPackage(packageName);
    if (app && app.repositoryId === this.repository.id) {
      return app;
    }
    return null;
  }

  async search(query: string): Promise<App[]> {
    return sqliteService.getApps({ repositoryId: this.repository.id, query, limit: 100 });
  }

  async getCategories(): Promise<Category[]> {
    const allApps = await this.fetchCatalog();
    const catCounts = new Map<string, number>();
    for (const app of allApps) {
      if (app.categoryId) {
        catCounts.set(app.categoryId, (catCounts.get(app.categoryId) ?? 0) + 1);
      }
    }
    const { PREMIUM_CATEGORIES } = require('@/lib/categories');
    return PREMIUM_CATEGORIES.map((cat: any) => ({
      ...cat,
      appCount: catCounts.get(cat.id) ?? 0,
    })).filter((cat: any) => cat.appCount > 0)
       .sort((a: any, b: any) => b.appCount - a.appCount);
  }

  async getLatestVersion(packageName: string): Promise<VersionInfo | null> {
    const app = await this.fetchAppDetails(packageName);
    return app?.currentVersion || null;
  }

  async getScreenshots(packageName: string): Promise<string[]> {
    const app = await this.fetchAppDetails(packageName);
    return app?.screenshotUrls || [];
  }

  async getPermissions(packageName: string): Promise<string[]> {
    const app = await this.fetchAppDetails(packageName);
    return app?.permissions || app?.currentVersion?.permissions || [];
  }

  async getDeveloperApps(developer: string): Promise<App[]> {
    return sqliteService.getApps({ repositoryId: this.repository.id, developer, limit: 100 });
  }

  async checkUpdates(packageName: string, currentVersionCode: number): Promise<boolean> {
    const latest = await this.getLatestVersion(packageName);
    if (!latest) return false;
    return latest.versionCode > currentVersionCode;
  }

  async downloadApk(packageName: string, versionName: string): Promise<string> {
    const app = await this.fetchAppDetails(packageName);
    if (!app) throw new Error(`App ${packageName} not found in repository ${this.repository.id}`);
    const version = app.versions?.find(v => v.versionName === versionName) || app.currentVersion;
    if (!version) throw new Error(`Version ${versionName} not found for app ${packageName}`);
    return this.resolveApkUrl(packageName, version);
  }
}

export function makeSource(type: Repository['type']): import('@/lib/types').AppSource {
  switch (type) {
    case 'fdroid':
      return 'F-Droid';
    case 'izzy':
      return 'IzzyOnDroid';
    case 'github':
      return 'GitHub';
    default:
      return 'Other';
  }
}

export function categoryNameToId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Pick a deterministic accent color from a package name. */
export function packageColor(packageName: string): string {
  const palette = [
    '#1A73E8', '#C2703D', '#175DDC', '#0D8C5A', '#C62828', '#1976D2', '#00838F', '#00695C',
    '#263238', '#BF360C', '#B71C1C', '#2E7D32', '#37474F', '#0082C9', '#4527A0', '#3F51B5',
    '#6A1B9A', '#FF6D00', '#00897B', '#558B2F', '#7B4FB0', '#E8842A', '#0277BD', '#424242',
  ];
  let hash = 0;
  for (let i = 0; i < packageName.length; i++) {
    hash = (hash << 5) - hash + packageName.charCodeAt(i);
    hash |= 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

export function packageLetter(name: string): string {
  const first = name.trim()[0];
  return first ? first.toUpperCase() : '?';
}

export function categoryIcon(name: string): string {
  const map: Record<string, string> = {
    'connectivity': 'wifi',
    'development': 'code-tags',
    'games': 'gamepad-variant-outline',
    'graphics': 'image-outline',
    'internet': 'web',
    'money': 'cash-multiple',
    'multimedia': 'play-circle-outline',
    'navigation': 'map-outline',
    'phone-sms': 'cellphone-message',
    'reading': 'book-open-outline',
    'science-education': 'school-outline',
    'security': 'shield-lock-outline',
    'sports-health': 'run',
    'system': 'cog-outline',
    'theming': 'palette-outline',
    'time': 'clock-outline',
    'writing': 'pencil-outline',
  };
  return map[categoryNameToId(name)] ?? 'apps';
}
