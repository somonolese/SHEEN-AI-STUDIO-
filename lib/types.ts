import type { ConfidenceLevel } from './updateConfidence';

// ─── SHEEN Domain Types ─────────────────────────────────────────────────────
//
// Core data model shared across repositories, downloads, installs, and updates.
// These types are intentionally plain JSON so they can be cached and transferred
// without losing information.

export type RepositoryType = 'fdroid' | 'izzy' | 'github' | 'manual';

export type AppSource = 'F-Droid' | 'IzzyOnDroid' | 'GitHub' | 'Other';

export type InstallerMode = 'legacy' | 'session' | 'shizuku' | 'root';

export interface Repository {
  id: string;
  name: string;
  type: RepositoryType;
  url: string;
  enabled: boolean;
  priority: number; // lower = higher priority when resolving duplicates
  lastSyncAt?: number;
  lastSyncError?: string;
  metadata?: Record<string, unknown>;
}

export interface VersionInfo {
  versionName: string;
  versionCode: number;
  added: number; // timestamp ms
  sizeBytes?: number;
  apkUrl?: string;
  changelog?: string;
  signingKeyId?: string;
  minSdk?: number;
  targetSdk?: number;
  permissions?: string[];
  nativeCode?: string[];
  fileName?: string;
}

export interface App {
  // Identity
  id: string; // unique within SHEEN (repoId:packageName)
  packageName: string; // Android package name
  name: string;
  developer: string;
  source: AppSource;
  repositoryId: string;

  // Presentation
  description: string;
  shortDescription?: string;
  iconUrl?: string;
  screenshotUrls?: string[];
  iconBlurhash?: string;
  screenshotBlurhashes?: string[];
  category?: string;
  categoryId?: string;
  color?: string; // fallback accent color
  letter?: string; // fallback icon letter
  rating?: number;
  downloads?: number;
  license?: string;

  // Trust & source links
  sourceRepo?: string; // e.g. GitHub URL
  homepage?: string;
  issueTracker?: string;
  website?: string;

  // Versioning
  currentVersion: VersionInfo;
  versions: VersionInfo[]; // newest first
  added: number;
  lastUpdated: number;

  // Safety
  antiFeatures?: string[];
  permissions?: string[];

  // Cache bookkeeping
  cachedAt: number;
  etag?: string;
}

export interface Category {
  id: string;
  name: string;
  icon?: string; // MaterialCommunity icon name
  color: string;
  appCount: number;
}

export interface SearchResult {
  app: App;
  score: number;
  matchedOn: ('name' | 'developer' | 'packageName' | 'description')[];
}

export interface SyncProgress {
  repositoryId: string;
  phase: 'fetching' | 'parsing' | 'caching' | 'done' | 'error';
  bytesDownloaded?: number;
  totalBytes?: number;
  appsProcessed?: number;
  appsTotal?: number;
  error?: string;
}

export interface RepositoryIndex {
  repository: Repository;
  apps: App[];
  categories: Category[];
  fetchedAt: number;
  appsByPackage: Map<string, App>; // packageName -> app
}

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'verifying'
  | 'failed'
  | 'cancelled'
  | 'installing'
  | 'installed'
  | 'install_failed'
  | 'signature_mismatch';

export interface DownloadTask {
  id: string;
  appId: string;
  packageName: string;
  name: string;
  developer: string;
  versionName: string;
  versionCode: number;
  apkUrl: string;
  fileUri: string;
  totalBytes: number;
  downloadedBytes: number;
  speedBps: number;
  status: DownloadStatus;
  error?: string;
  queuedAt: number;
  startedAt?: number;
  completedAt?: number;
  batchId?: string;
  repositoryId: string;
  iconUrl?: string;
  signatureMismatch?: {
    oldFingerprint: string;
    newFingerprint: string;
    oldSource: string;
    newSource: string;
  };
}

export interface InstallTask {
  downloadId: string;
  packageName: string;
  status: DownloadStatus;
  installerMode: InstallerMode;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface UpdateInfo {
  packageName: string;
  name: string;
  installedVersionCode?: number;
  installedVersionName?: string;
  availableVersion: VersionInfo;
  app: App;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  permissionChanges?: {
    added: string[];
    removed: string[];
  };
  source: AppSource;
}

export interface BasketItem {
  appId: string;
  addedAt: number;
  queued?: boolean;
}

export type NotificationType =
  | 'download_started'
  | 'download_progress'
  | 'download_complete'
  | 'download_completed'
  | 'install_complete'
  | 'install_completed'
  | 'install_failed'
  | 'update_available'
  | 'sync_finished'
  | 'sync_failed'
  | 'repo_added'
  | 'repo_removed'
  | 'basket_action'
  | 'app_shared'
  | 'experimental_announcement'
  | 'release_notes'
  | 'error'
  | 'info'
  | 'success'
  | 'warning'
  | 'upload'
  | 'sync';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
  data?: Record<string, unknown>;
}

export interface StorageInfo {
  path: string;
  totalBytes: number;
  freeBytes: number;
  usable: boolean;
}

export interface AppSignature {
  packageName: string;
  certificateFingerprint: string;
  installedAt: number;
  lastVerifiedAt: number;
  repositorySource: string;
}

