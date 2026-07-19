export interface VersionHistoryEntry {
  versionName: string;
  versionCode: number;
  releaseDate: string;
  sizeBytes: number;
  changelog: string;
  signingKeyId: string;
  apkUrl?: string;
  permissions: string[];
}
