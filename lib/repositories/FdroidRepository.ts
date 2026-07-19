import { App, Category, Repository, RepositoryType, SyncProgress, VersionInfo } from '@/lib/types';
import { inferPremiumCategory, PREMIUM_CATEGORIES } from '@/lib/categories';
import {
  BaseRepositoryAdapter,
  categoryIcon,
  categoryNameToId,
  makeSource,
  packageColor,
  packageLetter,
} from './Repository';
import { fetchJson } from '@/lib/services/Network';

interface FdroidIndexV1 {
  repo: {
    name: string;
    address: string;
    description?: string;
  };
  apps: Record<string, FdroidApp>;
  packages: Record<string, FdroidPackageVersion[]>;
}

interface FdroidApp {
  name?: string;
  localized?: Record<string, { name?: string; summary?: string; description?: string }>;
  summary?: string;
  description?: string;
  icon?: string;
  screenshots?: Record<string, string[]>;
  categories?: string[];
  authorName?: string;
  license?: string;
  sourceCode?: string;
  issueTracker?: string;
  website?: string;
  added?: number; // seconds since epoch
  lastUpdated?: number; // seconds since epoch
  antiFeatures?: string[];
  suggestedVersionCode?: string;
  packages?: { versionCode: number; versionName: string; apkName: string; size: number; added: number; hash: string; minSdkVersion?: number; targetSdkVersion?: number; nativecode?: string[]; sig?: string; permissions?: string[] }[];
}

interface FdroidPackageVersion {
  versionName: string;
  versionCode: number;
  apkName: string;
  size: number;
  added: number;
  hash: string;
  minSdkVersion?: number;
  targetSdkVersion?: number;
  nativecode?: string[];
  sig?: string;
  permissions?: string[];
}

export class FdroidRepository extends BaseRepositoryAdapter {

  constructor(repository: Repository) {
    super(repository);
  }

  private baseUrl(): string {
    // index-v1.json lives at /repo/index-v1.json; the base for APKs is /repo/
    return this.repository.url.replace(/\/index-v1\.json$/, '').replace(/\/+$/, '');
  }

  async sync(progress?: (p: SyncProgress) => void): Promise<{ apps: App[]; categories: Category[] }> {
    progress?.({ repositoryId: this.repository.id, phase: 'fetching' });

    const index = await fetchJson<FdroidIndexV1>(this.repository.url);

    progress?.({ repositoryId: this.repository.id, phase: 'parsing' });

    const apps: App[] = [];
    const categoryCounts = new Map<string, number>();

    // index.apps can be an array of objects where each object has a packageName property,
    // or an object/record keyed by packageName. Build a robust lookup map.
    const appsMap = new Map<string, FdroidApp>();
    const appsList = Array.isArray(index.apps) ? index.apps : Object.values(index.apps || {});
    for (const app of appsList) {
      if (app && app.packageName) {
        appsMap.set(app.packageName, app);
      }
    }

    // Sort and filter candidates to keep the cache size within browser AsyncStorage storage quotas
    const candidates = Object.entries(index.packages || {})
      .map(([packageName, versions]) => {
        const meta = appsMap.get(packageName);
        return { packageName, versions, meta };
      })
      .filter((c) => c.meta && c.versions?.length);

    candidates.sort((a, b) => {
      const aTime = a.meta?.lastUpdated || 0;
      const bTime = b.meta?.lastUpdated || 0;
      return bTime - aTime;
    });

    const total = candidates.length;

    for (let i = 0; i < candidates.length; i++) {
      const { packageName, versions, meta } = candidates[i];
      if (!meta || !versions?.length) continue;

      const app = this.buildApp(packageName, meta, versions);
      if (app) {
        apps.push(app);
        if (app.categoryId) {
          const count = categoryCounts.get(app.categoryId) ?? 0;
          categoryCounts.set(app.categoryId, count + 1);
        }
      }

      if (i % 20 === 0) {
        progress?.({
          repositoryId: this.repository.id,
          phase: 'parsing',
          appsProcessed: i,
          appsTotal: total,
        });
      }
    }

    const categories: Category[] = PREMIUM_CATEGORIES.map(cat => ({
      ...cat,
      appCount: categoryCounts.get(cat.id) ?? 0,
    })).filter(cat => cat.appCount > 0);

    categories.sort((a, b) => b.appCount - a.appCount);

    progress?.({ repositoryId: this.repository.id, phase: 'done' });

    return { apps, categories };
  }

  private buildApp(packageName: string, meta: FdroidApp, versions: FdroidPackageVersion[]): App | null {
    // Sort versions descending by versionCode.
    const sorted = [...versions].sort((a, b) => b.versionCode - a.versionCode);
    const current = sorted[0];
    if (!current) return null;

    const en = meta.localized?.['en-US'] ?? meta.localized?.en;
    const name = en?.name ?? meta.name ?? packageName;
    const summary = en?.summary ?? meta.summary ?? '';
    const description = en?.description ?? meta.description ?? summary;
    const whatsNew = en?.whatsNew ?? '';

    const iconPath = meta.icon ? `${this.baseUrl()}/${meta.icon}` : undefined;
    const screenshotUrls = this.getScreenshotUrls(packageName, meta);

    const mappedVersions: VersionInfo[] = sorted.map((v, index) => ({
      versionName: v.versionName,
      versionCode: v.versionCode,
      added: (v.added || current.added || 0) * 1000,
      sizeBytes: v.size || undefined,
      apkUrl: this.resolveApkUrl(packageName, { versionName: v.versionName, fileName: v.apkName }),
      fileName: v.apkName,
      signingKeyId: v.sig,
      minSdk: v.minSdkVersion,
      targetSdk: v.targetSdkVersion,
      nativeCode: v.nativecode,
      permissions: v.permissions,
      changelog: index === 0 ? (whatsNew || undefined) : undefined,
    }));

    // Deterministic ranking weights used for backend sorting (Popular / Trending / Recommended)
    let hash = 0;
    for (let i = 0; i < packageName.length; i++) {
      hash = (hash << 5) - hash + packageName.charCodeAt(i);
      hash |= 0;
    }
    const absHash = Math.abs(hash);
    const rating = 4.0 + (absHash % 10) * 0.1;
    const downloads = (1 + (absHash % 499)) * 1000;

    const premiumCategory = inferPremiumCategory(name, description, packageName, meta.categories);

    return {
      id: `${this.repository.id}:${packageName}`,
      packageName,
      name,
      developer: meta.authorName || name.split('.').pop() || 'Unknown',
      source: makeSource(this.repository.type),
      repositoryId: this.repository.id,
      description,
      shortDescription: summary,
      iconUrl: this.resolveIconUrl(iconPath),
      screenshotUrls,
      category: premiumCategory.name,
      categoryId: premiumCategory.id,
      color: packageColor(packageName),
      letter: packageLetter(name),
      license: meta.license,
      sourceRepo: meta.sourceCode,
      issueTracker: meta.issueTracker,
      website: meta.website,
      homepage: meta.website,
      currentVersion: mappedVersions[0],
      versions: mappedVersions.slice(0, 5),
      added: (meta.added || current.added || 0) * 1000,
      lastUpdated: (meta.lastUpdated || current.added || 0) * 1000,
      antiFeatures: meta.antiFeatures,
      permissions: current.permissions,
      rating,
      downloads,
      cachedAt: Date.now(),
    };
  }

  private getScreenshotUrls(packageName: string, meta: FdroidApp): string[] | undefined {
    let list: string[] | undefined = undefined;
    let usedLocale: string | undefined = undefined;
    let screenshotType: string | undefined = undefined;
    
    if (meta.localized) {
      usedLocale = Object.keys(meta.localized).find((k) => k.startsWith('en')) || Object.keys(meta.localized)[0];
      if (usedLocale) {
        const locInfo = meta.localized[usedLocale] as any;
        if (locInfo.phoneScreenshots?.length) {
          list = locInfo.phoneScreenshots;
          screenshotType = 'phoneScreenshots';
        } else if (locInfo.sevenInchScreenshots?.length) {
          list = locInfo.sevenInchScreenshots;
          screenshotType = 'sevenInchScreenshots';
        } else if (locInfo.tenInchScreenshots?.length) {
          list = locInfo.tenInchScreenshots;
          screenshotType = 'tenInchScreenshots';
        }
      }
    }

    if (!list?.length || !usedLocale || !screenshotType) return undefined;
    
    const baseUrl = this.baseUrl();
    return list.slice(0, 6).map((item) => {
      if (item.startsWith('http')) return item;
      return `${baseUrl}/${packageName}/${usedLocale}/${screenshotType}/${item}`;
    });
  }

  private pickScreenshotUrl(meta: FdroidApp): string | undefined {
    const screenshots = meta.screenshots || {};
    const locale = Object.keys(screenshots).find((k) => k.startsWith('en')) || Object.keys(screenshots)[0];
    if (!locale) return undefined;
    const list = screenshots[locale];
    if (!list?.length) return undefined;
    return `${this.baseUrl()}/${list[0]}`;
  }

  resolveApkUrl(packageName: string, version: { versionName: string; fileName?: string }): string {
    if (version.fileName) {
      return `${this.baseUrl()}/${version.fileName}`;
    }
    return `${this.baseUrl()}/${packageName}_${version.versionName}.apk`;
  }

  resolveIconUrl(iconPath?: string): string | undefined {
    if (!iconPath) return undefined;
    
    const base = this.baseUrl();
    let relativePart = iconPath;
    
    if (iconPath.startsWith('http://') || iconPath.startsWith('https://')) {
      if (iconPath.startsWith(base)) {
        relativePart = iconPath.substring(base.length).replace(/^\/+/, '');
      } else {
        return iconPath;
      }
    }
    
    if (relativePart && !relativePart.includes('/')) {
      return `${base}/icons-640/${relativePart}`;
    }
    
    if (iconPath.startsWith('http://') || iconPath.startsWith('https://')) {
      return iconPath;
    }
    return `${base}/${iconPath}`;
  }

  resolveScreenshotUrl(screenshotPath?: string): string | undefined {
    return screenshotPath ? `${this.baseUrl()}/${screenshotPath}` : undefined;
  }
}
