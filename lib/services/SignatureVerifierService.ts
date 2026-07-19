import { AppSignature } from '@/lib/types';
import { sqliteService } from './SQLiteService';

class SignatureVerifierService {
  constructor() {
  }

  /**
   * Generates a deterministic but authentic-looking SHA-256 certificate fingerprint.
   * Matches F-Droid keys vs Developer keys (GitHub / IzzyOnDroid) to replicate real Android scenarios
   * where source-built packages differ in signing authority.
   */
  getFingerprint(packageName: string, repositoryId: string): string {
    const isFdroid = String(repositoryId).toLowerCase().includes('fdroid');
    let hashVal = 0;
    // Generate a different seed depending on signing authority (F-Droid vs developer-signed)
    const seed = `${packageName}:${isFdroid ? 'fdroid-source-signed-authority' : 'developer-official-key-authority'}`;
    
    for (let i = 0; i < seed.length; i++) {
      hashVal = (hashVal << 5) - hashVal + seed.charCodeAt(i);
      hashVal |= 0; // Convert to 32-bit integer
    }

    const hexChars = '0123456789ABCDEF';
    const bytes: string[] = [];
    for (let i = 0; i < 32; i++) {
      const byteVal = Math.abs((hashVal ^ (i * 2011 + 31)) % 256);
      const hex = hexChars[Math.floor(byteVal / 16)] + hexChars[byteVal % 16];
      bytes.push(hex);
    }
    return bytes.join(':');
  }

  /**
   * Fetches the stored signature for an installed app.
   */
  async getInstalledSignature(packageName: string): Promise<AppSignature | null> {
    try {
      const sig = await sqliteService.getAppSignature(packageName);
      return sig;
    } catch (e) {
      console.error(`[SignatureVerifierService] Error getting signature for ${packageName}:`, e);
      return null;
    }
  }

  /**
   * Saves a signature on first install.
   */
  async saveInstalledSignature(
    packageName: string,
    fingerprint: string,
    repositorySource: string
  ): Promise<void> {
    try {
      const sig: AppSignature = {
        packageName,
        certificateFingerprint: fingerprint,
        installedAt: Date.now(),
        lastVerifiedAt: Date.now(),
        repositorySource,
      };
      await sqliteService.saveAppSignature(sig);
    } catch (e) {
      console.error(`[SignatureVerifierService] Error saving signature for ${packageName}:`, e);
    }
  }

  /**
   * Verifies the signature of an update against the currently installed signature.
   */
  async verifySignatureOnUpdate(
    packageName: string,
    newRepositoryId: string
  ): Promise<{
    success: boolean;
    isFirstInstall: boolean;
    reason?: string;
    oldFingerprint?: string;
    newFingerprint?: string;
    oldSource?: string;
    newSource?: string;
  }> {
    const existing = await this.getInstalledSignature(packageName);
    const newFingerprint = this.getFingerprint(packageName, newRepositoryId);

    if (!existing) {
      // First install scenario
      return {
        success: true,
        isFirstInstall: true,
        newFingerprint,
      };
    }

    if (existing.certificateFingerprint === newFingerprint) {
      // Match! Update last verification date
      const updated = {
        ...existing,
        lastVerifiedAt: Date.now(),
      };
      await sqliteService.saveAppSignature(updated);
      return {
        success: true,
        isFirstInstall: false,
        oldFingerprint: existing.certificateFingerprint,
        newFingerprint,
        oldSource: existing.repositorySource,
        newSource: newRepositoryId,
      };
    }

    // Mismatch! Warn user and block installation
    return {
      success: false,
      isFirstInstall: false,
      reason: 'Mismatched certificate fingerprint',
      oldFingerprint: existing.certificateFingerprint,
      newFingerprint,
      oldSource: existing.repositorySource,
      newSource: newRepositoryId,
    };
  }

  /**
   * Overrides warning and trusts the new signature, updating the database record.
   */
  async overrideAndTrustSignature(
    packageName: string,
    newFingerprint: string,
    repositorySource: string
  ): Promise<void> {
    try {
      const existing = await this.getInstalledSignature(packageName);
      const sig: AppSignature = {
        packageName,
        certificateFingerprint: newFingerprint,
        installedAt: existing?.installedAt || Date.now(),
        lastVerifiedAt: Date.now(),
        repositorySource,
      };
      await sqliteService.saveAppSignature(sig);
    } catch (e) {
      console.error(`[SignatureVerifierService] Error overriding signature for ${packageName}:`, e);
    }
  }
}

export const signatureVerifierService = new SignatureVerifierService();
