import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from './useSettings';

const REC_STORAGE_KEY = 'sheen.post_install_recs';

interface RecStorage {
  installedApps: Record<string, number>; // appId -> install timestamp
  dismissedApps: Record<string, boolean>; // appId -> true if dismissed
  lastShownAt: number; // timestamp of last recommendation shown
}

const DEFAULT_STORAGE: RecStorage = {
  installedApps: {},
  dismissedApps: {},
  lastShownAt: 0,
};

// 3 days in milliseconds
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
// 2 days in milliseconds for wait between showing recommendations
const SEVERAL_DAYS_BETWEEN_RECS = 2 * 24 * 60 * 60 * 1000;

export function usePostInstallRecommendations() {
  const { settings } = useSettings();
  const [data, setData] = useState<RecStorage>(DEFAULT_STORAGE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(REC_STORAGE_KEY);
        if (raw) {
          setData(JSON.parse(raw));
        }
      } catch (e) {
        console.warn('Failed to load post-install recommendations data', e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const saveData = useCallback(async (newData: RecStorage) => {
    setData(newData);
    try {
      await AsyncStorage.setItem(REC_STORAGE_KEY, JSON.stringify(newData));
    } catch (e) {
      console.warn('Failed to save post-install recommendations data', e);
    }
  }, []);

  const recordInstall = useCallback((appId: string) => {
    saveData({
      ...data,
      installedApps: {
        ...data.installedApps,
        [appId]: Date.now(),
      }
    });
  }, [data, saveData]);

  const dismissRecommendation = useCallback((appId: string) => {
    saveData({
      ...data,
      dismissedApps: {
        ...data.dismissedApps,
        [appId]: true,
      },
      lastShownAt: Date.now(),
    });
  }, [data, saveData]);

  const activeRecommendationAppId = (): string | null => {
    if (!ready || !settings.recommendationsAfterInstall) return null;

    const now = Date.now();
    // Don't show if we showed one recently
    if (now - data.lastShownAt < SEVERAL_DAYS_BETWEEN_RECS) return null;

    // Find the first installed app that is > 3 days old and hasn't been dismissed
    for (const [appId, installTime] of Object.entries(data.installedApps)) {
      if (!data.dismissedApps[appId] && (now - installTime >= THREE_DAYS)) {
        return appId;
      }
    }
    return null;
  };

  return {
    recordInstall,
    dismissRecommendation,
    activeRecommendationAppId: activeRecommendationAppId(),
  };
}
