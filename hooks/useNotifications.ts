import { useEffect, useState } from 'react';
import { AppNotification } from '@/lib/types';
import {
  subscribeNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  clearNotifications,
  getUnreadCount,
} from '@/lib/services/NotificationService';

export function useNotifications(): {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
} {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeNotifications((next) => {
      setNotifications(next);
      setUnreadCount(next.filter((n) => !n.read).length);
    });
    getUnreadCount().then(setUnreadCount);
    return unsubscribe;
  }, []);

  return {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    deleteNotification,
    clearAll: clearNotifications,
  };
}
