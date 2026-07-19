/**
 * Update Confidence — a pre-install trust signal shown before any app
 * update, similar in spirit to permission-change warnings on mainstream
 * app stores but tuned for a sideloaded / multi-repository catalog.
 */

export type ConfidenceLevel = 'safe' | 'review' | 'warning';

export interface ConfidenceResult {
  level: ConfidenceLevel;
  /** Human-readable reasons behind the level, most important first. */
  reasons: string[];
}

export interface VersionSnapshot {
  versionName: string;
  versionCode: number;
  signingKeyId: string;
  permissions: string[];
}

export interface RepoContext {
  /** Whether the repository this update is coming from is cryptographically verified. */
  verified: boolean;
  /** Whether the update is coming from the same repository the app was originally installed from. */
  sameRepository: boolean;
  /** True if the package's signature could not be validated at all. */
  unverifiedPackage?: boolean;
}

export const CONFIDENCE_META: Record<
  ConfidenceLevel,
  { emoji: string; label: string; color: string; bg: string }
> = {
  safe: { emoji: '🟢', label: 'Safe Update', color: '#1B5E20', bg: '#E4F5E7' },
  review: { emoji: '🟡', label: 'Review Recommended', color: '#8A5A00', bg: '#FFF3D6' },
  warning: { emoji: '🔴', label: 'Warning', color: '#B3261E', bg: '#FDE2E1' },
};

function isMajorVersionJump(from: string, to: string): boolean {
  const majorOf = (v: string) => parseInt(v.split('.')[0] ?? '0', 10) || 0;
  return majorOf(to) > majorOf(from);
}

/**
 * Computes the confidence level for updating `installed` to `incoming`,
 * given the repository context the update was fetched from.
 *
 * Warning-tier checks are evaluated first because any one of them (changed
 * signature, changed repo, unverified package) makes the update
 * untrustworthy regardless of anything else about it.
 */
export function computeUpdateConfidence(
  installed: VersionSnapshot,
  incoming: VersionSnapshot,
  repo: RepoContext,
): ConfidenceResult {
  const warningReasons: string[] = [];
  const reviewReasons: string[] = [];

  if (incoming.signingKeyId !== installed.signingKeyId) {
    warningReasons.push('The signing key changed since your installed version — this app was not signed by the same developer.');
  }
  if (!repo.sameRepository) {
    warningReasons.push('This update is coming from a different repository than the one you originally installed from.');
  }
  if (repo.unverifiedPackage) {
    warningReasons.push('The package signature could not be verified.');
  }
  if (!repo.verified) {
    warningReasons.push('The source repository is not a verified repository.');
  }

  const addedPermissions = incoming.permissions.filter((p) => !installed.permissions.includes(p));
  if (addedPermissions.length > 0) {
    reviewReasons.push(`Requests ${addedPermissions.length} new permission${addedPermissions.length > 1 ? 's' : ''}: ${addedPermissions.join(', ')}.`);
  }
  if (isMajorVersionJump(installed.versionName, incoming.versionName)) {
    reviewReasons.push(`Major version jump from ${installed.versionName} to ${incoming.versionName} — larger changes are more likely.`);
  }

  if (warningReasons.length > 0) {
    return { level: 'warning', reasons: warningReasons };
  }
  if (reviewReasons.length > 0) {
    return { level: 'review', reasons: reviewReasons };
  }
  return {
    level: 'safe',
    reasons: [
      'Signed with the same key as your installed version.',
      'Coming from a verified repository.',
      'No new dangerous permissions.',
    ],
  };
}
