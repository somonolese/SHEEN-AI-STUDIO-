import React, { useCallback, useEffect, useState } from 'react';
import { DownloadTask, App } from '@/lib/types';
import { downloadManager, DownloadManager } from '@/lib/services/DownloadManager';
import { installApk } from '@/lib/services/InstallManager';
import { useSettings } from './useSettings';
import { usePostInstallRecommendations } from './usePostInstallRecommendations';

// Re-export format helpers from the download manager for UI convenience.
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEta(remainingBytes: number, speedBps: number): string {
  if (speedBps <= 0) return '--';
  const seconds = remainingBytes / speedBps;
  if (seconds < 1) return '<1s';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}m ${remSeconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export interface DownloadableApp {
  appId: string;
  name: string;
  developer: string;
  letter: string;
  color: string;
  version: string;
  sizeBytes?: number;
  apkUrl?: string;
  repositoryId?: string;
  iconUrl?: string;
}

interface DownloadsContextValue {
  tasks: DownloadTask[];
  batches: { id: string; taskIds: string[]; createdAt: number }[];
  startDownload: (app: DownloadableApp) => string;
  startBatch: (apps: DownloadableApp[]) => string;
  pauseDownload: (taskId: string) => void;
  resumeDownload: (taskId: string) => void;
  cancelDownload: (taskId: string) => void;
  retryDownload: (taskId: string) => void;
  clearCompleted: () => void;
  getBatchProgress: (batchId: string) => { completed: number; total: number; fraction: number; currentName?: string };
  installTask: (taskId: string) => Promise<void>;
  forceInstallTask: (taskId: string) => Promise<void>;
  pauseAll: () => void;
  resumeAll: () => void;
  cancelAllQueued: () => void;
  retryAllFailed: () => void;
  reorderQueued: (taskIdsInOrder: string[]) => void;
}

export function useDownloads(): DownloadsContextValue {
  const manager = downloadManager();
  const [tasks, setTasks] = useState<DownloadTask[]>(manager.getTasks());
  const { settings } = useSettings();
  const { recordInstall } = usePostInstallRecommendations();

  useEffect(() => {
    return manager.subscribe((next) => setTasks(next));
  }, [manager]);

  const startDownload = useCallback(
    (app: DownloadableApp) => {
      const realApp = toApp(app);
      const task = manager.enqueue(realApp, realApp.currentVersion);
      return task.id;
    },
    [manager],
  );

  const startBatch = useCallback(
    (apps: DownloadableApp[]) => {
      const realApps = apps.map(toApp);
      return manager.startBatch(realApps);
    },
    [manager],
  );

  const pauseDownload = useCallback((taskId: string) => manager.pause(taskId), [manager]);
  const resumeDownload = useCallback((taskId: string) => manager.resume(taskId), [manager]);
  const cancelDownload = useCallback((taskId: string) => manager.cancel(taskId), [manager]);
  const retryDownload = useCallback((taskId: string) => manager.retry(taskId), [manager]);
  const clearCompleted = useCallback(() => manager.clearCompleted(), [manager]);
  const getBatchProgress = useCallback((batchId: string) => manager.getBatchProgress(batchId), [manager]);

  const pauseAll = useCallback(() => manager.pauseAll(), [manager]);
  const resumeAll = useCallback(() => manager.resumeAll(), [manager]);
  const cancelAllQueued = useCallback(() => manager.cancelAllQueued(), [manager]);
  const retryAllFailed = useCallback(() => manager.retryAllFailed(), [manager]);
  const reorderQueued = useCallback((taskIdsInOrder: string[]) => manager.reorderQueued(taskIdsInOrder), [manager]);

  const installTask = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (task.status !== 'completed') return;
      await installApk(task, settings.defaultInstaller);
      recordInstall(task.appId);
    },
    [tasks, settings.defaultInstaller, recordInstall],
  );

  const forceInstallTask = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (task.status !== 'completed' && task.status !== 'signature_mismatch') return;
      await installApk(task, settings.defaultInstaller, true);
      recordInstall(task.appId);
    },
    [tasks, settings.defaultInstaller, recordInstall],
  );

  const batches = tasks.reduce((acc, task) => {
    if (!task.batchId) return acc;
    const existing = acc.find((b) => b.id === task.batchId);
    if (existing) {
      existing.taskIds.push(task.id);
    } else {
      acc.push({ id: task.batchId, taskIds: [task.id], createdAt: task.queuedAt });
    }
    return acc;
  }, [] as { id: string; taskIds: string[]; createdAt: number }[]);

  return {
    tasks,
    batches,
    startDownload,
    startBatch,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    retryDownload,
    clearCompleted,
    getBatchProgress,
    installTask,
    forceInstallTask,
    pauseAll,
    resumeAll,
    cancelAllQueued,
    retryAllFailed,
    reorderQueued,
  };
}

export function useAppDownload(appId: string): DownloadTask | undefined {
  const { tasks } = useDownloads();
  return tasks
    .filter((t) => t.appId === appId)
    .sort((a, b) => b.queuedAt - a.queuedAt)[0];
}

function toApp(app: DownloadableApp): App {
  // Convert the legacy DownloadableApp shape into a real App so the download
  // manager can resolve APK URLs. This is used by screens that still hold old
  // mock data until they are fully migrated to the catalog.
  return {
    id: app.appId,
    packageName: app.appId.replace(/^[^:]*:/, ''),
    name: app.name,
    developer: app.developer,
    source: 'Other',
    repositoryId: app.repositoryId || 'manual',
    description: '',
    color: app.color,
    letter: app.letter,
    iconUrl: app.iconUrl,
    currentVersion: {
      versionName: app.version,
      versionCode: 1,
      added: Date.now(),
      sizeBytes: app.sizeBytes,
      apkUrl: app.apkUrl,
    },
    versions: [],
    added: Date.now(),
    lastUpdated: Date.now(),
    cachedAt: Date.now(),
  };
}
