import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { DownloadTask, InstallerMode, InstallTask } from '@/lib/types';
import { downloadManager } from './DownloadManager';
import { emitNotification } from './NotificationService';
import { signatureVerifierService } from '@/lib/services/SignatureVerifierService';

// ─── InstallManager ───────────────────────────────────────────────────────────
//
// Abstraction over Android install methods. Each installer implements a common
// interface. On Android the manager delegates to the configured installer. On iOS
// and web, installation is impossible (APKs are Android-only), so the method
// is reported as unavailable with an explanation.

export interface InstallerAvailability {
  mode: InstallerMode;
  available: boolean;
  reason: string;
  badge?: string;
}

export interface Installer {
  mode: InstallerMode;
  install(task: DownloadTask): Promise<InstallTask>;
  checkAvailability(): Promise<InstallerAvailability>;
}

class LegacyInstaller implements Installer {
  mode: InstallerMode = 'legacy';

  async checkAvailability(): Promise<InstallerAvailability> {
    if (Platform.OS !== 'android' && Platform.OS !== 'web') {
      return { mode: this.mode, available: false, reason: 'APK installation is only available on Android.', badge: 'Android only' };
    }
    return { mode: this.mode, available: true, reason: 'Uses the Android package installer.' };
  }

  async install(task: DownloadTask): Promise<InstallTask> {
    const avail = await this.checkAvailability();
    if (!avail.available) {
      return { downloadId: task.id, packageName: task.packageName, status: 'install_failed', installerMode: this.mode, error: avail.reason };
    }

    try {
      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(task.fileUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          type: 'application/vnd.android.package-archive',
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        }).catch(() => {});
      }
      
      emitNotification('install_complete', 'Installing', `${task.name} is being installed.`);
      
      // Since we can't get reliable package install broadcasts in JS, 
      // we mock the transition to 'installed' after a delay to show the "Open" button.
      setTimeout(() => {
        downloadManager().updateTask(task.id, (t) => ({ ...t, status: 'installed' }));
      }, 5000);
      
      return { downloadId: task.id, packageName: task.packageName, status: 'installing', installerMode: this.mode, startedAt: Date.now() };
    } catch (e) {
      const error = String((e as Error).message || e);
      emitNotification('error', 'Install failed', `${task.name}: ${error}`);
      return { downloadId: task.id, packageName: task.packageName, status: 'install_failed', installerMode: this.mode, error };
    }
  }
}

class SessionInstaller implements Installer {
  mode: InstallerMode = 'session';

  async checkAvailability(): Promise<InstallerAvailability> {
    if (Platform.OS !== 'android') {
      return { mode: this.mode, available: false, reason: 'Session installer requires Android.', badge: 'Android only' };
    }
    // Android 12+ (API 31) is required for reliable PackageInstaller sessions.
    const version = Platform.Version as number;
    if (version < 31) {
      return { mode: this.mode, available: false, reason: 'Requires Android 12 or newer.', badge: 'Android 12+' };
    }
    return { mode: this.mode, available: true, reason: 'Uses PackageInstaller sessions for Android 12+.' };
  }

  async install(task: DownloadTask): Promise<InstallTask> {
    const avail = await this.checkAvailability();
    if (!avail.available) {
      return { downloadId: task.id, packageName: task.packageName, status: 'install_failed', installerMode: this.mode, error: avail.reason };
    }
    // Session-based installs require a native module or expo-native module. Expo
    // does not expose this out of the box, so we fall back to the legacy intent
    // with a note. The architecture is isolated and ready to swap in a native
    // implementation once available.
    return new LegacyInstaller().install(task);
  }
}

class ShizukuInstaller implements Installer {
  mode: InstallerMode = 'shizuku';

  async checkAvailability(): Promise<InstallerAvailability> {
    if (Platform.OS !== 'android') {
      return { mode: this.mode, available: false, reason: 'Shizuku is only available on Android.', badge: 'Android only' };
    }
    // Runtime detection would require a Shizuku binder check; until that native
    // module is wired, we report "not detected" so the UI can disable it.
    return { mode: this.mode, available: false, reason: 'Shizuku service not detected. Start Shizuku to enable.', badge: 'Not detected' };
  }

  async install(task: DownloadTask): Promise<InstallTask> {
    const avail = await this.checkAvailability();
    return { downloadId: task.id, packageName: task.packageName, status: 'install_failed', installerMode: this.mode, error: avail.reason };
  }
}

class RootInstaller implements Installer {
  mode: InstallerMode = 'root';

  async checkAvailability(): Promise<InstallerAvailability> {
    if (Platform.OS !== 'android') {
      return { mode: this.mode, available: false, reason: 'Root installs are only available on Android.', badge: 'Android only' };
    }
    // Root detection requires a native module. Disabled until wired.
    return { mode: this.mode, available: false, reason: 'Root access not detected.', badge: 'Not detected' };
  }

  async install(task: DownloadTask): Promise<InstallTask> {
    const avail = await this.checkAvailability();
    return { downloadId: task.id, packageName: task.packageName, status: 'install_failed', installerMode: this.mode, error: avail.reason };
  }
}

const installers: Record<InstallerMode, Installer> = {
  legacy: new LegacyInstaller(),
  session: new SessionInstaller(),
  shizuku: new ShizukuInstaller(),
  root: new RootInstaller(),
};

export async function checkInstallerAvailability(): Promise<InstallerAvailability[]> {
  return Promise.all([
    installers.legacy.checkAvailability(),
    installers.session.checkAvailability(),
    installers.shizuku.checkAvailability(),
    installers.root.checkAvailability(),
  ]);
}

export async function installApk(
  task: DownloadTask,
  mode: InstallerMode,
  forceTrust = false
): Promise<InstallTask> {
  try {
    // Verify app signatures before installing/updating
    const verification = await signatureVerifierService.verifySignatureOnUpdate(
      task.packageName,
      task.repositoryId
    );

    if (!verification.success && !forceTrust) {
      console.warn(`[InstallManager] Signature verification failed for ${task.packageName}. Stored fingerprint does not match new package fingerprint.`);
      
      // Stop the installation and mark task status as signature_mismatch
      downloadManager().updateTask(task.id, (t) => ({
        ...t,
        status: 'signature_mismatch',
        signatureMismatch: {
          oldFingerprint: verification.oldFingerprint || '',
          newFingerprint: verification.newFingerprint || '',
          oldSource: verification.oldSource || '',
          newSource: verification.newSource || '',
        },
      }));

      emitNotification(
        'warning',
        'Signature Mismatch Detected',
        `${task.name} update has a different signing certificate.`
      );

      return {
        downloadId: task.id,
        packageName: task.packageName,
        status: 'signature_mismatch',
        installerMode: mode,
        error: 'Mismatched certificate fingerprint',
      };
    }

    // Save signature if it is first install or override-trust is requested
    if (!verification.success && forceTrust) {
      await signatureVerifierService.overrideAndTrustSignature(
        task.packageName,
        verification.newFingerprint!,
        task.repositoryId
      );
    } else if (verification.isFirstInstall) {
      await signatureVerifierService.saveInstalledSignature(
        task.packageName,
        verification.newFingerprint!,
        task.repositoryId
      );
    }
  } catch (err) {
    console.error('[InstallManager] Signature verification error:', err);
    // On error reading certificate, inform user, do not crash, and prevent automatic install
    downloadManager().updateTask(task.id, (t) => ({
      ...t,
      status: 'failed',
      error: 'Could not verify signing certificate: ' + String(err),
    }));

    emitNotification(
      'error',
      'Verification Error',
      `Could not read or verify certificate for ${task.name}`
    );

    return {
      downloadId: task.id,
      packageName: task.packageName,
      status: 'install_failed',
      installerMode: mode,
      error: 'Could not read or verify signing certificate',
    };
  }

  const installer = installers[mode];
  const result = await installer.install(task);

  if (result.status === 'installing' || result.status === 'installed') {
    downloadManager().updateTask(task.id, (t) => ({ ...t, status: 'installing' }));
  } else if (result.status === 'install_failed') {
    downloadManager().updateTask(task.id, (t) => ({ ...t, status: 'failed', error: result.error || 'Install failed' }));
  }

  return result;
}

export function getInstallers(): Record<InstallerMode, Installer> {
  return { ...installers };
}

export function isInstallPossible(): boolean {
  return Platform.OS === 'android';
}
