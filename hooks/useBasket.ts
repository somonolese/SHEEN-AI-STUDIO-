import { useCallback, useEffect, useState } from 'react';
import { App } from '@/lib/types';
import * as BasketManager from '@/lib/services/BasketManager';

export function useBasket() {
  const [items, setItems] = useState<Record<string, { appId: string; addedAt: number; queued?: boolean }>>({});

  useEffect(() => {
    return BasketManager.subscribeBasket(setItems);
  }, []);

  const add = useCallback(async (app: App) => {
    await BasketManager.addToBasket(app);
  }, []);

  const remove = useCallback(async (appId: string) => {
    await BasketManager.removeFromBasket(appId);
  }, []);

  const clear = useCallback(async () => {
    await BasketManager.clearBasket();
  }, []);

  const isInBasket = useCallback(
    (appId: string) => !!items[appId],
    [items],
  );

  const ids = Object.keys(items);

  return { items, ids, add, remove, clear, isInBasket };
}
