import { Share, Platform } from 'react-native';
import { App } from '@/lib/types';
import { emitNotification } from '@/lib/services/NotificationService';

export const shareApp = async (app: App) => {
  try {
    let message = `📦 ${app.name}\n`;
    message += `👨💻 Developer: ${app.developer}\n`;
    message += `📝 ${app.shortDescription || app.description.substring(0, 100) + '...'}\n\n`;
    message += `Repository: ${app.source}\n`;
    message += `Package: ${app.packageName}\n`;

    if (app.sourceRepo) {
      message += `\nSource: ${app.sourceRepo}`;
    }
    if (app.website) {
      message += `\nWebsite: ${app.website}`;
    }

    const result = await Share.share({
      message: message,
      title: `Share ${app.name}`,
    });
    if (result.action === Share.sharedAction) {
      emitNotification('app_shared', 'App Shared', `Successfully shared ${app.name}!`, { appId: app.id, appIcon: app.iconUrl, packageName: app.packageName }).catch(() => {});
    }
  } catch (error: any) {
    const errorStr = String(error?.message || error);
    if (!errorStr.toLowerCase().includes('cancel') && !errorStr.toLowerCase().includes('abort') && !errorStr.toLowerCase().includes('dismiss')) {
      console.warn('Error sharing app:', error);
    } else {
    }
  }
};

export const shareBasket = async (apps: App[]) => {
  try {
    let message = `📦 SHEEN Basket (${apps.length} apps)\n\n`;
    for (const app of apps) {
      message += `• ${app.name} (${app.packageName})\n`;
    }
    
    message += `\nShared from SHEEN.`;

    const result = await Share.share({
      message: message,
      title: `Share Basket`,
    });
    if (result.action === Share.sharedAction) {
      emitNotification('app_shared', 'Basket Shared', `Successfully shared a basket of ${apps.length} apps!`).catch(() => {});
    }
  } catch (error: any) {
    const errorStr = String(error?.message || error);
    if (!errorStr.toLowerCase().includes('cancel') && !errorStr.toLowerCase().includes('abort') && !errorStr.toLowerCase().includes('dismiss')) {
      console.warn('Error sharing basket:', error);
    } else {
    }
  }
};
