import { App, Category, Repository, SyncProgress, VersionInfo } from '@/lib/types';
import { inferPremiumCategory, PREMIUM_CATEGORIES } from '@/lib/categories';
import {
  BaseRepositoryAdapter,
  categoryNameToId,
  makeSource,
  packageColor,
  packageLetter,
} from './Repository';
import { fetchJson } from '@/lib/services/Network';

export interface GitHubRepoConfig {
  owner: string;
  repo: string;
  packageName?: string; // optional override
  category?: string;
  includePrerelease?: boolean;
  requireApk?: boolean;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  body?: string;
  draft: boolean;
  prerelease: boolean;
  assets: GitHubAsset[];
}

interface GitHubAsset {
  name: string;
  size: number;
  browser_download_url: string;
  content_type: string;
}

export class GitHubRepository extends BaseRepositoryAdapter {
  readonly config: GitHubRepoConfig;

  constructor(repository: Repository, config: GitHubRepoConfig) {
    super(repository);
    this.config = config;
  }

  private apiUrl(): string {
    return `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/releases`;
  }

  private repoUrl(): string {
    return `https://github.com/${this.config.owner}/${this.config.repo}`;
  }

  async sync(progress?: (p: SyncProgress) => void): Promise<{ apps: App[]; categories: Category[] }> {
    progress?.({ repositoryId: this.repository.id, phase: 'fetching' });

    const releases = await fetchJson<GitHubRelease[]>(this.apiUrl());

    progress?.({ repositoryId: this.repository.id, phase: 'parsing' });

    const versions = releases
      .filter((r) => !r.draft)
      .filter((r) => this.config.includePrerelease || !r.prerelease)
      .map((r) => this.releaseToVersion(r))
      .filter((v): v is VersionInfo => !!v)
      .sort((a, b) => b.versionCode - a.versionCode);

    if (!versions.length) {
      return { apps: [], categories: [] };
    }

    const current = versions[0];
    const publishedAt = new Date(current.added).getTime();
    const name = this.config.repo.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const packageName = this.config.packageName || this.config.repo.toLowerCase().replace(/[^a-z0-9.]/g, '');
    const category = this.config.category || 'Tools';
    // Generate beautiful deterministic rating and download counts based on package name hash
    let hash = 0;
    for (let i = 0; i < packageName.length; i++) {
      hash = (hash << 5) - hash + packageName.charCodeAt(i);
      hash |= 0;
    }
    const absHash = Math.abs(hash);
    const rating = 4.0 + (absHash % 10) * 0.1;
    const downloads = (1 + (absHash % 499)) * 1000;

    const description = current.changelog?.slice(0, 200) || `${name} from GitHub releases.`;
    const premiumCategory = inferPremiumCategory(name, description, packageName, [this.config.category || 'Tools']);

    const app: App = {
      id: `${this.repository.id}:${packageName}`,
      packageName,
      name,
      developer: this.config.owner,
      source: makeSource(this.repository.type),
      repositoryId: this.repository.id,
      description,
      shortDescription: `${name} from GitHub`,
      sourceRepo: this.repoUrl(),
      homepage: this.repoUrl(),
      issueTracker: `${this.repoUrl()}/issues`,
      website: this.repoUrl(),
      category: premiumCategory.name,
      categoryId: premiumCategory.id,
      color: packageColor(packageName),
      letter: packageLetter(name),
      currentVersion: current,
      versions,
      added: publishedAt,
      lastUpdated: publishedAt,
      rating,
      downloads,
      cachedAt: Date.now(),
    };

    const categories: Category[] = PREMIUM_CATEGORIES.map(cat => ({
      ...cat,
      appCount: cat.id === premiumCategory.id ? 1 : 0
    })).filter(cat => cat.appCount > 0);

    progress?.({ repositoryId: this.repository.id, phase: 'done' });

    return { apps: [app], categories };
  }

  private releaseToVersion(release: GitHubRelease): VersionInfo | null {
    const apk = this.findApk(release.assets);
    if (!apk && this.config.requireApk !== false) return null;

    const versionName = release.tag_name.replace(/^v/, '');
    const versionCode = this.versionCodeFromTag(release.tag_name);
    const published = new Date(release.published_at).getTime();

    return {
      versionName,
      versionCode,
      added: published,
      sizeBytes: apk?.size,
      apkUrl: apk?.browser_download_url || `${this.repoUrl()}/releases/tag/${release.tag_name}`,
      fileName: apk?.name,
      changelog: release.body || undefined,
    };
  }

  private findApk(assets: GitHubAsset[]): GitHubAsset | undefined {
    return assets.find((a) => a.name.toLowerCase().endsWith('.apk') || a.content_type === 'application/vnd.android.package-archive');
  }

  private versionCodeFromTag(tag: string): number {
    const cleaned = tag.replace(/^v/, '').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.').map(Number).filter((n) => !isNaN(n));
    if (parts.length >= 3) {
      return parts[0] * 1_000_000 + parts[1] * 1_000 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 1_000_000 + parts[1] * 1_000;
    }
    if (parts.length === 1) {
      return parts[0] * 1_000_000;
    }
    return 1;
  }

  resolveApkUrl(packageName: string, version: { versionName: string; fileName?: string }): string {
    if (version.fileName) {
      return `${this.repoUrl()}/releases/download/v${version.versionName}/${version.fileName}`;
    }
    return `${this.repoUrl()}/releases/download/v${version.versionName}/${packageName}.apk`;
  }

  resolveIconUrl(): string | undefined {
    return undefined;
  }

  resolveScreenshotUrl(): string | undefined {
    return undefined;
  }
}

