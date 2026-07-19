import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { checkForUpdates } from './UpdateManager';
import { emitNotification } from './NotificationService';
import { loadCatalog } from './CacheService';

const BACKGROUND_UPDATE_TASK = 'BACKGROUND_UPDATE_TASK';

TaskManager.defineTask(BACKGROUND_UPDATE_TASK, async () => {
  try {
    const { loadUpdateSettings } = require('./CacheService');
    const settings = await loadUpdateSettings();
    
    if (settings.autoCheckMode === 'manual') {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const catalog = await loadCatalog();
    const apps = catalog?.apps;
    if (!apps || apps.length === 0) return BackgroundFetch.BackgroundFetchResult.NoData;
    
    const updates = await checkForUpdates(apps);
    
    if (updates.length > 0) {
      if (settings.autoCheckMode === 'auto') {
        // Enqueue auto update if wifi/charging met
        // For now, emit notification that updates are downloading
        await emitNotification('update_available', 'Updating Apps', `Downloading ${updates.length} updates in background.`);
        // Note: we'd ideally trigger DownloadManager here, but DownloadManager uses Expo filesystem and hooks into UI. 
        // For MVP, just notify
      } else {
        await emitNotification('update_available', 'Updates Available', `You have ${updates.length} app updates available.`);
      }
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error("Background update check failed", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundUpdateTask() {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_UPDATE_TASK, {
      minimumInterval: 60 * 60 * 12, // 12 hours
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (err) {
  }
}

