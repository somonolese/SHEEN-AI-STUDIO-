import { App, VersionInfo } from '@/lib/types';

export type UpdateCategory = 'Security' | 'Feature' | 'BugFix' | 'Maintenance' | 'General';
export type UpdateBadge = 'Security' | 'Bug Fix' | 'Features' | 'Performance' | 'UI Improvements';

export interface UpdateIntelligence {
  category: UpdateCategory;
  badges: UpdateBadge[];
  sizeDiffBytes?: number;
  installedVersionName?: string;
  installedVersionCode?: number;
}

export function analyzeUpdate(
  app: App,
  installedVersionCode?: number,
  installedVersionName?: string
): UpdateIntelligence {
  const availableVersion = app.currentVersion;
  const changelog = (availableVersion.changelog || '').toLowerCase();
  const versionName = (availableVersion.versionName || '').toLowerCase();

  // Find installed version's size if possible
  let installedSize: number | undefined;
  if (installedVersionCode) {
    const installedVer = app.versions.find(v => v.versionCode === installedVersionCode);
    if (installedVer) {
      installedSize = installedVer.sizeBytes;
    }
  }

  const sizeDiffBytes = 
    availableVersion.sizeBytes !== undefined && installedSize !== undefined
      ? availableVersion.sizeBytes - installedSize
      : undefined;

  const badges: UpdateBadge[] = [];

  // Keywords check for badges
  const securityKeywords = ['security', 'exploit', 'cve', 'vulnerability', 'leak', 'patch security', 'auth', 'unauthorized', 'permission', 'sandbox', 'crypto', 'tls', 'ssl', 'private'];
  const bugFixKeywords = ['fix', 'bug', 'crash', 'issue', 'resolve', 'prevent', 'correct', 'hotfix', 'regression', 'exception', 'freeze', 'error'];
  const featureKeywords = ['feature', 'add', 'added', 'new', 'introduce', 'introducing', 'support for', 'implement', 'implemented', 'mode', 'option', 'setting', 'support'];
  const performanceKeywords = ['performance', 'fast', 'speed', 'optimize', 'optimization', 'leak', 'lag', 'smooth', 'efficient', 'efficiency', 'memory', 'cpu', 'cache', 'render', 'fps'];
  const uiKeywords = ['ui', 'ux', 'theme', 'color', 'dark mode', 'light mode', 'layout', 'visual', 'padding', 'margin', 'icon', 'design', 'screen', 'animation', 'style', 'view', 'transition', 'button', 'card', 'view'];

  if (securityKeywords.some(k => changelog.includes(k) || versionName.includes(k))) {
    badges.push('Security');
  }
  if (bugFixKeywords.some(k => changelog.includes(k) || versionName.includes(k))) {
    badges.push('Bug Fix');
  }
  if (featureKeywords.some(k => changelog.includes(k) || versionName.includes(k))) {
    badges.push('Features');
  }
  if (performanceKeywords.some(k => changelog.includes(k))) {
    badges.push('Performance');
  }
  if (uiKeywords.some(k => changelog.includes(k))) {
    badges.push('UI Improvements');
  }

  // Classification logic (highest priority down)
  let category: UpdateCategory = 'General';

  if (badges.includes('Security')) {
    category = 'Security';
  } else if (badges.includes('Features')) {
    category = 'Feature';
  } else if (badges.includes('Bug Fix')) {
    category = 'BugFix';
  } else if (
    changelog.includes('dependencies') ||
    changelog.includes('dependency') ||
    changelog.includes('build') ||
    changelog.includes('ci') ||
    changelog.includes('translation') ||
    changelog.includes('translate') ||
    changelog.includes('locales') ||
    changelog.includes('refactor') ||
    changelog.includes('cleanup') ||
    changelog.includes('bump') ||
    changelog.includes('maintenance') ||
    changelog.includes('manifest') ||
    changelog.includes('gradle')
  ) {
    category = 'Maintenance';
  }

  return {
    category,
    badges,
    sizeDiffBytes,
    installedVersionName,
    installedVersionCode,
  };
}
