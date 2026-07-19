import { useCallback, useEffect, useState } from 'react';
import { App, UpdateInfo } from '@/lib/types';
import { checkForUpdates, recordUpdateCheck } from '@/lib/services/UpdateManager';
import * as Notifications from 'expo-notifications';

export function useUpdates(apps: App[]): {
  updates: UpdateInfo[];
  isLoading: boolean;
  error?: string;
  check: () => void;
  lastCheck: number;
} {
  const [updates, setUpdates] = useState<UpdateInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [lastCheck, setLastCheck] = useState(0);

  const check = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await checkForUpdates(apps);
      setUpdates(result);
      await recordUpdateCheck();
      setLastCheck(Date.now());
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setIsLoading(false);
    }
  }, [apps]);

  useEffect(() => {
    check();
  }, [check]);

  useEffect(() => {
    Notifications.setBadgeCountAsync(updates.length);
  }, [updates]);

  return { updates, isLoading, error, check, lastCheck };
}
