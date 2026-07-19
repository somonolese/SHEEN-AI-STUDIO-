import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AppNotification, NotificationType } from '@/lib/types';
import { loadNotifications, saveNotifications } from './CacheService';

// ─── NotificationService ────────────────────────────────────────────────────
//
// In-app notification engine. Notifications are persisted to AsyncStorage so they
// survive restarts. A separate system-level integration (expo-notifications) can
// be layered on top without changing this interface.

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  // Configure high-importance channel on Android for head-up alerts
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6B4C9A',
    }).catch((err) => {
      console.warn('[NotificationService] failed to create notification channel:', err);
    });
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status: existingStatus } = (await Notifications.getPermissionsAsync()) as any;
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const perm = await Notifications.requestPermissionsAsync();
      finalStatus = (perm as any).status;
    }
    return finalStatus === 'granted';
  } catch (e) {
    console.warn('[NotificationService] Failed to get notification permission:', e);
    return false;
  }
}

let listeners: Set<(notifications: AppNotification[]) => void> = new Set();
let cache: AppNotification[] | null = null;
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  const state = await loadNotifications();
  cache = state.items.slice(0, 100);
  loaded = true;
}

function emit(): void {
  listeners.forEach((cb) => cb(cache ?? []));
}

async function persist(): Promise<void> {
  await saveNotifications({ items: cache ?? [] });
}

export function subscribeNotifications(cb: (notifications: AppNotification[]) => void): () => void {
  listeners.add(cb);
  ensureLoaded().then(() => cb(cache ?? []));
  return () => listeners.delete(cb);
}

export async function emitNotification(
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<AppNotification> {
  await ensureLoaded();
  const notification: AppNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    title,
    body,
    read: false,
    createdAt: Date.now(),
    data,
  };
  cache = [notification, ...(cache ?? [])].slice(0, 100);
  emit();
  await persist();

  // Layer on system-level local notification for completed downloads and errors requiring attention
  if (Platform.OS !== 'web') {
    const isImportantType = type === 'download_complete' || type === 'error' || type === 'install_complete';
    if (isImportantType) {
      requestNotificationPermission().then((hasPermission) => {
        if (hasPermission) {
          Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              sound: true,
              data: data || {},
            },
            trigger: null,
          }).catch((e) => {
            console.warn('[NotificationService] Failed to schedule local notification:', e);
          });
        }
      });
    }
  }

  return notification;
}

export async function markRead(id: string): Promise<void> {
  await ensureLoaded();
  cache = (cache ?? []).map((n) => (n.id === id ? { ...n, read: true } : n));
  emit();
  await persist();
}

export async function markAllRead(): Promise<void> {
  await ensureLoaded();
  cache = (cache ?? []).map((n) => ({ ...n, read: true }));
  emit();
  await persist();
}

export async function deleteNotification(id: string): Promise<void> {
  await ensureLoaded();
  cache = (cache ?? []).filter((n) => n.id !== id);
  emit();
  await persist();
}

export async function clearNotifications(): Promise<void> {
  await ensureLoaded();
  cache = [];
  emit();
  await persist();
}

export async function getUnreadCount(): Promise<number> {
  await ensureLoaded();
  return (cache ?? []).filter((n) => !n.read).length;
}
