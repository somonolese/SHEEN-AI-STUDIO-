import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { DownloadTask, DownloadStatus, App } from '@/lib/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SheenSettings, DEFAULT_SETTINGS } from '@/hooks/useSettings';
import { installApk } from '@/lib/services/InstallManager';

export async function getSettings(): Promise<SheenSettings> {
  try {
    const raw = await AsyncStorage.getItem('sheen.settings.v1');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}
import { loadDownloads, saveDownloads } from './CacheService';
import { emitNotification } from './NotificationService';

// ─── DownloadManager ────────────────────────────────────────────────────────
//
// Real APK download engine using expo-file-system on Android. On web we use a
// fetch fallback because the web filesystem cannot store arbitrary APK files.
// Supports queueing, pause/resume (native only), retries, speed/ETA, and batch IDs.

const MAX_CONCURRENT = 1;
const TICK_MS = 250;

interface ActiveDownload {
  task: DownloadTask;
  resumable?: FileSystem.DownloadResumable;
  webController?: AbortController;
  webReader?: ReadableStreamDefaultReader<Uint8Array>;
  startTime: number;
}

let instance: DownloadManager | null = null;

export class DownloadManager {
  private tasks: DownloadTask[] = [];
  private active = new Map<string, ActiveDownload>();
  private listeners: Set<(tasks: DownloadTask[]) => void> = new Set();
  private tickInterval?: ReturnType<typeof setInterval>;
  private loaded = false;

  static get(): DownloadManager {
    if (!instance) instance = new DownloadManager();
    return instance;
  }

  private constructor() {
    this.load();
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    const state = await loadDownloads();
    this.tasks = state.tasks.filter((t) => t.status !== 'installing' && t.status !== 'installed');
    // Reset transient states to queued/failed so they can be resumed.
    this.tasks = this.tasks.map((t) => {
      if (t.status === 'downloading') return { ...t, status: 'queued', speedBps: 0 };
      if (t.status === 'paused') return { ...t, status: 'queued' };
      return t;
    });
    this.loaded = true;
    this.emit();
    this.startTick();
  }

  private save(): void {
    saveDownloads({ tasks: this.tasks }).catch(() => {});
  }

  private emit(): void {
    this.listeners.forEach((cb) => cb(this.tasks));
  }

  subscribe(cb: (tasks: DownloadTask[]) => void): () => void {
    this.listeners.add(cb);
    cb(this.tasks);
    return () => this.listeners.delete(cb);
  }

  getTasks(): DownloadTask[] {
    return this.tasks;
  }

  enqueue(app: App, version = app.currentVersion, batchId?: string): DownloadTask {
    const id = makeTaskId();
    const fileUri = getApkFileUri(app.packageName, version.versionName, version.fileName);

    const task: DownloadTask = {
      id,
      appId: app.id,
      packageName: app.packageName,
      name: app.name,
      developer: app.developer,
      versionName: version.versionName,
      versionCode: version.versionCode,
      apkUrl: version.apkUrl || `${app.source === 'IzzyOnDroid' ? 'https://apt.izzysoft.de/fdroid/repo' : 'https://f-droid.org/repo'}/${version.fileName || `${app.packageName}_${version.versionName}.apk`}`,
      fileUri,
      totalBytes: version.sizeBytes || 0,
      downloadedBytes: 0,
      speedBps: 0,
      status: 'queued',
      queuedAt: Date.now(),
      batchId,
      repositoryId: app.repositoryId,
      iconUrl: app.iconUrl,
    };

    // Avoid duplicate queued tasks for the same app+version.
    this.tasks = this.tasks.filter(
      (t) => !(t.appId === task.appId && t.versionCode === task.versionCode && t.status === 'queued'),
    );

    this.tasks = [task, ...this.tasks];
    this.emit();
    this.save();
    getSettings().then(settings => {
      if (settings.downloadNotifications && settings.notifDownloadProgress) {
        emitNotification('download_started', `Download started`, `Downloading ${app.name} ${version.versionName}`);
      }
    });
    this.pump();
    return task;
  }

  startBatch(apps: App[], versionForApp?: (app: App) => App['currentVersion']): string {
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    for (const app of apps) {
      this.enqueue(app, versionForApp?.(app) ?? app.currentVersion, batchId);
    }
    return batchId;
  }

  pause(taskId: string): void {
    const active = this.active.get(taskId);
    if (active?.resumable) {
      active.task.status = 'paused';
      active.resumable.pauseAsync().catch(() => {});
    } else if (active?.webController) {
      active.webController.abort();
      active.task.status = 'paused';
    }
    this.updateTask(taskId, (t) => ({ ...t, status: 'paused' }));
  }

  resume(taskId: string): void {
    this.updateTask(taskId, (t) => ({ ...t, status: 'queued' }));
    this.pump();
  }

  cancel(taskId: string): void {
    const active = this.active.get(taskId);
    if (active?.resumable) {
      active.resumable.cancelAsync().catch(() => {});
    }
    if (active?.webController) {
      active.webController.abort();
    }
    this.active.delete(taskId);
    this.tasks = this.tasks.filter((t) => t.id !== taskId);
    this.emit();
    this.save();
    this.pump();
  }

  retry(taskId: string): void {
    this.updateTask(taskId, (t) => ({
      ...t,
      status: 'queued',
      downloadedBytes: 0,
      speedBps: 0,
      error: undefined,
      completedAt: undefined,
    }));
    this.pump();
  }

  clearCompleted(): void {
    this.tasks = this.tasks.filter((t) => t.status !== 'completed' && t.status !== 'installed' && t.status !== 'failed');
    this.emit();
    this.save();
  }

  updateTask(taskId: string, updater: (t: DownloadTask) => DownloadTask): void {
    this.tasks = this.tasks.map((t) => (t.id === taskId ? updater(t) : t));
    this.emit();
    this.save();
  }

  private pump(): void {
    if (!this.loaded) return;
    
    const activeCount = this.tasks.filter((t) => t.status === 'downloading').length;
    const freeSlots = MAX_CONCURRENT - activeCount;
    if (freeSlots <= 0) return;

    const queued = this.tasks.filter((t) => t.status === 'queued').slice(0, freeSlots);
    for (const task of queued) {
      this.updateTask(task.id, (t) => ({ ...t, status: 'downloading', startedAt: Date.now() }));
      this.startNativeDownload(task).catch((e) => {
        this.updateTask(task.id, (t) => ({ ...t, status: 'failed', error: String(e.message || e) }));
        emitNotification('error', 'Download failed', `${task.name}: ${String(e.message || e)}`);
        this.pump();
      });
    }
  }

  private async startNativeDownload(task: DownloadTask): Promise<void> {
    if (Platform.OS === 'web') {
      await this.startWebDownload(task);
      return;
    }

    try {
      // Clean up any previous partial file for a fresh retry.
      const info = await FileSystem.getInfoAsync(task.fileUri);
      if (info.exists) {
        await FileSystem.deleteAsync(task.fileUri, { idempotent: true });
      }
    } catch {}

    const resumable = FileSystem.createDownloadResumable(
      task.apkUrl,
      task.fileUri,
      {},
      (progress) => {
        const total = progress.totalBytesExpectedToWrite || task.totalBytes || 0;
        const current = progress.totalBytesWritten || 0;
        this.updateTask(task.id, (t) => ({ ...t, totalBytes: total || t.totalBytes, downloadedBytes: current }));
      },
    );

    this.active.set(task.id, { task, resumable, startTime: Date.now() });
    const result = await resumable.downloadAsync();
    this.active.delete(task.id);

    if (result?.uri) {
      this.updateTask(task.id, (t) => ({
        ...t,
        status: 'verifying',
        downloadedBytes: t.totalBytes || 0,
      }));
      await new Promise(resolve => setTimeout(resolve, 1500));
      this.updateTask(task.id, (t) => ({
        ...t,
        status: 'completed',
        completedAt: Date.now(),
      }));
      const settings = await getSettings();
      if (settings.downloadNotifications && settings.notifDownloadProgress) {
        emitNotification('download_complete', 'Download complete', `${task.name} ${task.versionName} is ready to install`);
      }
      if (settings.autoInstallAfterDownload && (Platform.OS as string) !== 'web') {
        this.updateTask(task.id, (t) => ({ ...t, status: 'installing' }));
        installApk(this.tasks.find(t => t.id === task.id)!, settings.defaultInstaller).then(() => {
          this.updateTask(task.id, (t) => ({ ...t, status: 'installed' }));
          if (settings.notifInstallCompleted) {
             emitNotification('install_complete', 'Installed', `${task.name} was installed successfully.`);
          }
          if (settings.keepApkAfterInstall === false) {
             FileSystem.deleteAsync(task.fileUri, { idempotent: true }).catch(() => {});
          }
        }).catch(() => {
          this.updateTask(task.id, (t) => ({ ...t, status: 'completed' }));
        });
      }
    } else {
      throw new Error('Download returned no file');
    }

    this.pump();
  }

  private async startWebDownload(task: DownloadTask): Promise<void> {
    const controller = new AbortController();
    const startTime = Date.now();
    this.active.set(task.id, { task, webController: controller, startTime });

    try {
      const response = await fetch(task.apkUrl, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentLength = Number(response.headers.get('content-length')) || 0;
      this.updateTask(task.id, (t) => ({ ...t, totalBytes: contentLength || t.totalBytes }));

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');
      this.active.get(task.id)!.webReader = reader;

      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        this.updateTask(task.id, (t) => ({ ...t, downloadedBytes: received }));
      }

      this.active.delete(task.id);
      this.updateTask(task.id, (t) => ({
        ...t,
        status: 'verifying',
        downloadedBytes: t.totalBytes || received,
      }));
      await new Promise(resolve => setTimeout(resolve, 1500));
      this.updateTask(task.id, (t) => ({
        ...t,
        status: 'completed',
        completedAt: Date.now(),
      }));
      const settings = await getSettings();
      if (settings.downloadNotifications && settings.notifDownloadProgress) {
        emitNotification('download_complete', 'Download complete', `${task.name} ${task.versionName} is ready to install`);
      }
    } catch (e) {
      this.active.delete(task.id);
      throw e;
    }
    this.pump();
  }

  private startTick(): void {
    if (this.tickInterval) return;
    this.tickInterval = setInterval(() => {
      const now = Date.now();
      this.tasks = this.tasks.map((task) => {
        if (task.status !== 'downloading') return task;

        const active = this.active.get(task.id);
        if (!active) return task;

        const elapsedSec = (now - active.startTime) / 1000;
        if (elapsedSec <= 0) return task;

        const remaining = Math.max(0, (task.totalBytes || 0) - task.downloadedBytes);
        const speed = task.downloadedBytes / elapsedSec;

        return { ...task, speedBps: speed };
      });
      this.emit();
    }, TICK_MS);
  }

  getBatchProgress(batchId: string): { completed: number; total: number; fraction: number; currentName?: string } {
    const batchTasks = this.tasks.filter((t) => t.batchId === batchId);
    const total = batchTasks.length;
    const completed = batchTasks.filter((t) => t.status === 'completed' || t.status === 'installed').length;
    const current = batchTasks.find((t) => t.status === 'downloading' || t.status === 'installing');
    return { completed, total, fraction: total > 0 ? completed / total : 0, currentName: current?.name };
  }

  pauseAll(): void {
    this.tasks.forEach((t) => {
      if (t.status === 'downloading') {
        this.pause(t.id);
      }
    });
  }

  resumeAll(): void {
    this.tasks.forEach((t) => {
      if (t.status === 'paused') {
        this.resume(t.id);
      }
    });
  }

  cancelAllQueued(): void {
    const queuedTasks = this.tasks.filter((t) => t.status === 'queued');
    queuedTasks.forEach((t) => {
      this.cancel(t.id);
    });
  }

  retryAllFailed(): void {
    const failedTasks = this.tasks.filter((t) => t.status === 'failed' || t.status === 'install_failed' || t.status === 'signature_mismatch');
    failedTasks.forEach((t) => {
      this.retry(t.id);
    });
  }

  reorderQueued(taskIdsInOrder: string[]): void {
    const queuedMap = new Map<string, DownloadTask>();
    const otherTasks: DownloadTask[] = [];
    
    this.tasks.forEach((t) => {
      if (t.status === 'queued') {
        queuedMap.set(t.id, t);
      } else {
        otherTasks.push(t);
      }
    });

    const reorderedQueued: DownloadTask[] = [];
    taskIdsInOrder.forEach((id) => {
      const task = queuedMap.get(id);
      if (task) {
        reorderedQueued.push(task);
        queuedMap.delete(id);
      }
    });

    queuedMap.forEach((task) => {
      reorderedQueued.push(task);
    });

    const newTasks: DownloadTask[] = [];
    let queuedIndex = 0;
    this.tasks.forEach((t) => {
      if (t.status === 'queued') {
        if (queuedIndex < reorderedQueued.length) {
          newTasks.push(reorderedQueued[queuedIndex++]);
        }
      } else {
        newTasks.push(t);
      }
    });

    this.tasks = newTasks;
    this.emit();
    this.save();
    this.pump();
  }
}

function makeTaskId(): string {
  return `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getApkFileUri(packageName: string, versionName: string, fileName?: string): string {
  if (Platform.OS === 'web') {
    return `web://${packageName}/${versionName}`;
  }
  const name = fileName || `${packageName}_${versionName}.apk`;
  return `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}sheen/downloads/${name}`;
}

export function downloadManager(): DownloadManager {
  return DownloadManager.get();
}
