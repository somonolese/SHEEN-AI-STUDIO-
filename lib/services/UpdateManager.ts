import { App, UpdateInfo, VersionInfo } from '@/lib/types';
import { loadUpdateSettings, saveUpdateSettings } from './CacheService';

// ─── UpdateManager ────────────────────────────────────────────────────────────
//
// Compares the locally installed version of each package with the catalog and
// produces a ranked list of available updates. On Android we could query the
// package manager natively; for now the installed version is tracked from the
// install manager and persisted in AsyncStorage. Web preview uses the same
// persistence so updates can still be demonstrated.

interface InstalledVersion {
  packageName: string;
  versionName: string;
  versionCode: number;
  installedAt: number;
}

let installedCache: Record<string, InstalledVersion> = {};
let loaded = false;

const INSTALLED_KEY = 'sheen:v2:installed-versions';

async function loadInstalled(): Promise<void> {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(INSTALLED_KEY);
    installedCache = raw ? JSON.parse(raw) : {};
  } catch {
    installedCache = {};
  }
  loaded = true;
}

async function saveInstalled(): Promise<void> {
  await AsyncStorage.setItem(INSTALLED_KEY, JSON.stringify(installedCache));
}

export function recordInstalled(packageName: string, version: VersionInfo): void {
  installedCache[packageName] = {
    packageName,
    versionName: version.versionName,
    versionCode: version.versionCode,
    installedAt: Date.now(),
  };
  saveInstalled().catch(() => {});
}

export function recordUninstalled(packageName: string): void {
  delete installedCache[packageName];
  saveInstalled().catch(() => {});
}


export async function getInstalledApps(): Promise<InstalledVersion[]> {
  await loadInstalled();
  return Object.values(installedCache).sort((a, b) => b.installedAt - a.installedAt);
}

export function getInstalledVersion(packageName: string): InstalledVersion | undefined {
  return installedCache[packageName];
}

export async function checkForUpdates(apps: App[]): Promise<UpdateInfo[]> {
  await loadInstalled();
  const updates: UpdateInfo[] = [];
  const ignored = await loadUpdateSettings();

  for (const app of apps) {
    
    if (ignored.ignoredPackages.includes(app.packageName)) continue;
    if (ignored.ignoredVersions?.[app.packageName] === String(app.currentVersion.versionCode)) continue;

    const installed = installedCache[app.packageName];
    if (!installed) continue;
    if (app.currentVersion.versionCode <= installed.versionCode) continue;

    const confidence = computeConfidence(app, installed.versionCode);
    const permissionChanges = installedPermissionsDiff(app.currentVersion.permissions || [], installed.versionCode);

    updates.push({
      packageName: app.packageName,
      name: app.name,
      installedVersionCode: installed.versionCode,
      installedVersionName: installed.versionName,
      availableVersion: app.currentVersion,
      app,
      confidence: confidence.level,
      confidenceScore: confidence.score,
      permissionChanges,
      source: app.source,
    });
  }

  // Highest confidence first, then by version delta.
  updates.sort((a, b) => b.confidenceScore - a.confidenceScore || (b.availableVersion.versionCode - (b.installedVersionCode ?? 0)) - (a.availableVersion.versionCode - (a.installedVersionCode ?? 0)));
  return updates;
}

export async function ignoreUpdates(packageName: string, ignore: boolean): Promise<void> {
  const state = await loadUpdateSettings();
  if (ignore) {
    if (!state.ignoredPackages.includes(packageName)) {
      state.ignoredPackages.push(packageName);
    }
  } else {
    state.ignoredPackages = state.ignoredPackages.filter((p) => p !== packageName);
  }
  await saveUpdateSettings(state);
}


export async function ignoreVersion(packageName: string, versionCode: string): Promise<void> {
  const state = await loadUpdateSettings();
  if (!state.ignoredVersions) state.ignoredVersions = {};
  state.ignoredVersions[packageName] = versionCode;
  await saveUpdateSettings(state);
}

export async function clearIgnoredVersion(packageName: string): Promise<void> {
  const state = await loadUpdateSettings();
  if (state.ignoredVersions && state.ignoredVersions[packageName]) {
    delete state.ignoredVersions[packageName];
    await saveUpdateSettings(state);
  }
}

export async function recordUpdateCheck(): Promise<void> {
  const state = await loadUpdateSettings();
  state.lastCheck = Date.now();
  await saveUpdateSettings(state);
}

export async function getLastUpdateCheck(): Promise<number> {
  const state = await loadUpdateSettings();
  return state.lastCheck;
}

function computeConfidence(app: App, installedVersionCode: number): { level: UpdateInfo['confidence']; score: number } {
  const delta = app.currentVersion.versionCode - installedVersionCode;
  const signingKey = app.currentVersion.signingKeyId;
  const hasChangelog = !!app.currentVersion.changelog && app.currentVersion.changelog.length > 10;
  const knownRepo = app.repositoryId.startsWith('fdroid') || app.repositoryId.startsWith('izzy') || app.repositoryId.startsWith('github');

  let score = 50;
  if (signingKey) score += 20;
  if (knownRepo) score += 15;
  if (hasChangelog) score += 10;
  if (delta < 5) score += 15; // patch/minor bump
  else if (delta < 50) score += 5;
  else score -= 10; // major jump

  if (app.antiFeatures?.includes('DisabledAlgorithm') || app.antiFeatures?.includes('KnownVulnerability')) {
    score -= 30;
  }

  score = Math.max(0, Math.min(100, score));

  let level: UpdateInfo['confidence'] = 'warning';
  if (score >= 80) level = 'safe';
  else if (score >= 60) level = 'review';

  return { level, score };
}

function installedPermissionsDiff(currentPermissions: string[], _installedVersionCode: number): UpdateInfo['permissionChanges'] {
  // We don't have the old permission list stored by default, so we treat the
  // current permissions as the new additions compared to the empty set. This
  // is a safe baseline; a future native install hook could persist the old list.
  return { added: currentPermissions, removed: [] };
}

// Import AsyncStorage locally to avoid top-level import issues if the module is
// not yet loaded (it is in the project, but this is safer for bundle split).
import AsyncStorage from '@react-native-async-storage/async-storage';
