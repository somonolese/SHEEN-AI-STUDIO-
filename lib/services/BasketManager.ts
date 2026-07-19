import { App } from '@/lib/types';
import { loadBasket, saveBasket } from './CacheService';
import { emitNotification } from './NotificationService';

// ─── BasketManager ────────────────────────────────────────────────────────────
//
// Persistent basket of apps the user wants to install later. Add/remove, query,
// and install-all are supported. The basket is independent of favorites/updates
// so the UI can keep them separate.

interface BasketItem {
  appId: string;
  addedAt: number;
  queued?: boolean;
}

let listeners: Set<(items: Record<string, BasketItem>) => void> = new Set();
let items: Record<string, BasketItem> = {};
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  const state = await loadBasket();
  items = (state.items || {}) as Record<string, BasketItem>;
  loaded = true;
}

function emit(): void {
  listeners.forEach((cb) => cb({ ...items }));
}

async function persist(): Promise<void> {
  await saveBasket({ items });
}

export function subscribeBasket(cb: (items: Record<string, BasketItem>) => void): () => void {
  listeners.add(cb);
  ensureLoaded().then(() => emit());
  return () => listeners.delete(cb);
}

export async function addToBasket(app: App): Promise<void> {
  await ensureLoaded();
  items[app.id] = { appId: app.id, addedAt: Date.now() };
  emit();
  await persist();
  emitNotification('basket_action', 'Added to Basket', `"${app.name}" was added to your installation basket.`, { appId: app.id, appIcon: app.iconUrl, packageName: app.packageName }).catch(() => {});
}

export async function removeFromBasket(appId: string): Promise<void> {
  await ensureLoaded();
  delete items[appId];
  emit();
  await persist();
  emitNotification('basket_action', 'Removed from Basket', `An app was removed from your basket.`, { appId }).catch(() => {});
}

export async function isInBasket(appId: string): Promise<boolean> {
  await ensureLoaded();
  return !!items[appId];
}

export async function getBasketIds(): Promise<string[]> {
  await ensureLoaded();
  return Object.keys(items);
}

export async function clearBasket(): Promise<void> {
  await ensureLoaded();
  items = {};
  emit();
  await persist();
}

export async function markBasketQueued(appId: string, queued: boolean): Promise<void> {
  await ensureLoaded();
  if (items[appId]) {
    items[appId] = { ...items[appId], queued };
    emit();
    await persist();
  }
}

export async function getBasketSnapshot(): Promise<Record<string, BasketItem>> {
  await ensureLoaded();
  return { ...items };
}
