import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type RiskLevel = 'normal' | 'sensitive' | 'high';

export interface AnalyzedPermission {
  key: string;
  name: string;
  category: string;
  categoryIcon: string;
  riskLevel: RiskLevel;
  description: string;
  isNew?: boolean; // For future permission comparison
}

export interface PermissionCategoryGroup {
  id: string;
  name: string;
  icon: string;
  color: string;
  permissions: AnalyzedPermission[];
}

export interface PermissionAnalysisResult {
  packageName: string;
  versionCode: number;
  totalCount: number;
  highRiskCount: number;
  sensitiveCount: number;
  normalCount: number;
  categories: PermissionCategoryGroup[];
  allPermissions: AnalyzedPermission[];
  hasRiskWarning: boolean;
}

export const CATEGORY_META: Record<string, { name: string; icon: string; color: string }> = {
  internet: { name: 'Internet & Network', icon: 'web', color: '#0288D1' },
  camera: { name: 'Camera', icon: 'camera-outline', color: '#EC407A' },
  microphone: { name: 'Microphone', icon: 'microphone-outline', color: '#AB47BC' },
  location: { name: 'Location', icon: 'map-marker-outline', color: '#F57C00' },
  storage: { name: 'Storage', icon: 'folder-outline', color: '#FBC02D' },
  contacts: { name: 'Contacts', icon: 'account-multiple-outline', color: '#26A69A' },
  calendar: { name: 'Calendar', icon: 'calendar-month-outline', color: '#5C6BC0' },
  phone: { name: 'Phone', icon: 'phone-outline', color: '#29B6F6' },
  sms: { name: 'SMS', icon: 'message-processing-outline', color: '#EF5350' },
  notifications: { name: 'Notifications', icon: 'bell-ring-outline', color: '#7E57C2' },
  accessibility: { name: 'Accessibility', icon: 'eye-outline', color: '#26C6DA' },
  health: { name: 'Health', icon: 'heart-pulse', color: '#FF5252' },
  nearby: { name: 'Nearby Devices', icon: 'cellphone-wireless', color: '#66BB6A' },
  system: { name: 'System Features', icon: 'cog-outline', color: '#78909C' },
  other: { name: 'Other Permissions', icon: 'shield-outline', color: '#8D6E63' },
};

const PERMISSION_DICTIONARY: Record<string, { name: string; category: string; riskLevel: RiskLevel; description: string }> = {
  // Internet & Network
  'android.permission.INTERNET': {
    name: 'Internet Access',
    category: 'internet',
    riskLevel: 'normal',
    description: 'Allows the app to access the internet for loading remote content, updates, or API interactions.',
  },
  'android.permission.ACCESS_NETWORK_STATE': {
    name: 'View Network Connections',
    category: 'internet',
    riskLevel: 'normal',
    description: 'Allows the app to check whether a connection to the internet is available via cellular or Wi-Fi.',
  },
  'android.permission.ACCESS_WIFI_STATE': {
    name: 'View Wi-Fi Status',
    category: 'internet',
    riskLevel: 'normal',
    description: 'Allows the app to check details about current Wi-Fi networks, such as SSID and connection strength.',
  },
  'android.permission.CHANGE_WIFI_STATE': {
    name: 'Change Wi-Fi State',
    category: 'internet',
    riskLevel: 'normal',
    description: 'Allows the app to connect to or disconnect from Wi-Fi networks and modify wireless parameters.',
  },

  // Camera
  'android.permission.CAMERA': {
    name: 'Take Photos and Videos',
    category: 'camera',
    riskLevel: 'sensitive',
    description: 'Allows the app to capture photos and record videos using your device cameras.',
  },

  // Microphone
  'android.permission.RECORD_AUDIO': {
    name: 'Record Audio',
    category: 'microphone',
    riskLevel: 'sensitive',
    description: 'Allows the app to capture sound from the built-in microphone for voice messages or features.',
  },

  // Location
  'android.permission.ACCESS_FINE_LOCATION': {
    name: 'Precise Location (GPS)',
    category: 'location',
    riskLevel: 'sensitive',
    description: 'Allows the app to pinpoint your exact location using GPS, cellular towers, and Wi-Fi networks.',
  },
  'android.permission.ACCESS_COARSE_LOCATION': {
    name: 'Approximate Location',
    category: 'location',
    riskLevel: 'sensitive',
    description: 'Allows the app to determine your rough geographic location using network sources.',
  },
  'android.permission.ACCESS_BACKGROUND_LOCATION': {
    name: 'Background Location',
    category: 'location',
    riskLevel: 'high',
    description: 'Allows the app to continuously track your device location even when you are not actively using the app.',
  },

  // Storage
  'android.permission.READ_EXTERNAL_STORAGE': {
    name: 'Read Shared Storage',
    category: 'storage',
    riskLevel: 'sensitive',
    description: 'Allows the app to view and open photos, videos, audio files, and documents stored on your device.',
  },
  'android.permission.WRITE_EXTERNAL_STORAGE': {
    name: 'Write Shared Storage',
    category: 'storage',
    riskLevel: 'sensitive',
    description: 'Allows the app to save new files, download media, or modify existing files in your local storage.',
  },
  'android.permission.MANAGE_EXTERNAL_STORAGE': {
    name: 'Full Storage Control',
    category: 'storage',
    riskLevel: 'high',
    description: 'Grants broad read and write access to all files on the device external storage. Highly privileged.',
  },

  // Contacts
  'android.permission.READ_CONTACTS': {
    name: 'Read Contacts',
    category: 'contacts',
    riskLevel: 'sensitive',
    description: 'Allows the app to access the names, phone numbers, and email addresses saved in your phone book.',
  },
  'android.permission.WRITE_CONTACTS': {
    name: 'Modify Contacts',
    category: 'contacts',
    riskLevel: 'sensitive',
    description: 'Allows the app to add new contacts, delete entries, or edit existing contact details.',
  },
  'android.permission.GET_ACCOUNTS': {
    name: 'Discover Accounts',
    category: 'contacts',
    riskLevel: 'normal',
    description: 'Allows the app to retrieve lists of account names associated with services like Google, Email, or Sync.',
  },

  // Calendar
  'android.permission.READ_CALENDAR': {
    name: 'Read Calendar',
    category: 'calendar',
    riskLevel: 'sensitive',
    description: 'Allows the app to view scheduled calendar events, appointments, and reminder times.',
  },
  'android.permission.WRITE_CALENDAR': {
    name: 'Modify Calendar',
    category: 'calendar',
    riskLevel: 'sensitive',
    description: 'Allows the app to add, reschedule, or remove events and tasks on your system calendar.',
  },

  // Phone
  'android.permission.READ_PHONE_STATE': {
    name: 'Read Phone State',
    category: 'phone',
    riskLevel: 'sensitive',
    description: 'Allows the app to read unique device identifiers, phone number, and network status.',
  },
  'android.permission.CALL_PHONE': {
    name: 'Direct Call Numbers',
    category: 'phone',
    riskLevel: 'sensitive',
    description: 'Allows the app to make direct phone calls without showing the dialer or asking for confirmation.',
  },
  'android.permission.PROCESS_OUTGOING_CALLS': {
    name: 'Intercept Outgoing Calls',
    category: 'phone',
    riskLevel: 'high',
    description: 'Allows the app to see outgoing dial events, redirect calls, or hang up calls programmatically.',
  },

  // SMS
  'android.permission.SEND_SMS': {
    name: 'Send SMS Messages',
    category: 'sms',
    riskLevel: 'high',
    description: 'Allows the app to send text messages in the background, which may incur monetary charges.',
  },
  'android.permission.RECEIVE_SMS': {
    name: 'Receive SMS Messages',
    category: 'sms',
    riskLevel: 'high',
    description: 'Allows the app to read incoming SMS text messages, frequently used for automatic verification codes.',
  },
  'android.permission.READ_SMS': {
    name: 'Read SMS Messages',
    category: 'sms',
    riskLevel: 'high',
    description: 'Allows the app to view SMS text messages, drafts, and MMS messages saved on your device.',
  },

  // Notifications
  'android.permission.POST_NOTIFICATIONS': {
    name: 'Post Notifications',
    category: 'notifications',
    riskLevel: 'normal',
    description: 'Allows the app to push updates, messages, badges, and alerts directly to your system status bar.',
  },

  // Accessibility
  'android.permission.BIND_ACCESSIBILITY_SERVICE': {
    name: 'Use Accessibility Service',
    category: 'accessibility',
    riskLevel: 'high',
    description: 'Allows the app to monitor your screen interactions, read typed text, and automate clicks. High risk.',
  },

  // Health
  'android.permission.BODY_SENSORS': {
    name: 'Access Body Sensors',
    category: 'health',
    riskLevel: 'sensitive',
    description: 'Allows access to live body vital metrics from hardware sensors like heart rate monitors or step sensors.',
  },
  'android.permission.ACTIVITY_RECOGNITION': {
    name: 'Physical Activity Tracking',
    category: 'health',
    riskLevel: 'normal',
    description: 'Allows the app to track your physical activities, such as running, biking, or steps taken.',
  },

  // Nearby Devices
  'android.permission.BLUETOOTH': {
    name: 'Bluetooth Connection',
    category: 'nearby',
    riskLevel: 'normal',
    description: 'Allows the app to discover and connect to Bluetooth accessories and nearby paired devices.',
  },
  'android.permission.BLUETOOTH_ADMIN': {
    name: 'Bluetooth Admin Control',
    category: 'nearby',
    riskLevel: 'normal',
    description: 'Allows the app to manage Bluetooth connections, trigger scans, and pairing dialogs.',
  },
  'android.permission.BLUETOOTH_SCAN': {
    name: 'Scan for Nearby Bluetooth',
    category: 'nearby',
    riskLevel: 'sensitive',
    description: 'Allows the app to locate physical Bluetooth beacons and nearby smart-home devices.',
  },
  'android.permission.BLUETOOTH_CONNECT': {
    name: 'Connect to Bluetooth Devices',
    category: 'nearby',
    riskLevel: 'sensitive',
    description: 'Allows the app to establish active data handshakes with close proximity Bluetooth accessories.',
  },
  'android.permission.NFC': {
    name: 'Near Field Communication (NFC)',
    category: 'nearby',
    riskLevel: 'normal',
    description: 'Allows the app to initiate NFC contact tags read/write transfers (e.g., smart cards, contactless).',
  },

  // System Features
  'android.permission.VIBRATE': {
    name: 'Vibrate Control',
    category: 'system',
    riskLevel: 'normal',
    description: 'Allows control of the built-in vibration haptics on user interaction events.',
  },
  'android.permission.WAKE_LOCK': {
    name: 'Prevent Device Sleeping',
    category: 'system',
    riskLevel: 'normal',
    description: 'Allows the app to keep the screen or background processor active during playback or long operations.',
  },
  'android.permission.RECEIVE_BOOT_COMPLETED': {
    name: 'Start on Device Boot',
    category: 'system',
    riskLevel: 'normal',
    description: 'Allows the app to register for the system startup signal to automatically boot background services.',
  },
  'android.permission.SYSTEM_ALERT_WINDOW': {
    name: 'Display Over other Apps',
    category: 'system',
    riskLevel: 'high',
    description: 'Allows the app to overlay floating windows or graphics on top of other active applications.',
  },
  'android.permission.REQUEST_INSTALL_PACKAGES': {
    name: 'Request App Installations',
    category: 'system',
    riskLevel: 'high',
    description: 'Allows the app to act as an installer package to prompt installations of downloaded APK files.',
  },
  'android.permission.FOREGROUND_SERVICE': {
    name: 'Run Foreground Service',
    category: 'system',
    riskLevel: 'normal',
    description: 'Allows background processes to run with a visible system notification status bar indicator.',
  },
  'android.permission.USE_BIOMETRIC': {
    name: 'Use Biometric Hardware',
    category: 'system',
    riskLevel: 'normal',
    description: 'Allows the app to present a system auth prompt utilizing fingerprint sensors or face-recognition keys.',
  },
};

class PermissionAnalyzerService {
  private memoryCache: Map<string, PermissionAnalysisResult> = new Map();

  constructor() {
  }

  /**
   * Helper to clean up Android permission strings (e.g. "android.permission.CAMERA")
   */
  private formatPermissionName(rawPermission: string): string {
    const parts = rawPermission.split('.');
    const lastPart = parts[parts.length - 1];
    // Replace underscores with spaces and capitalize words
    return lastPart
      .replace(/_/g, ' ')
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Determines the category for an unknown permission based on keywords.
   */
  private detectCategory(rawPermission: string): string {
    const upper = rawPermission.toUpperCase();
    if (upper.includes('LOCATION')) return 'location';
    if (upper.includes('CAMERA')) return 'camera';
    if (upper.includes('MICROPHONE') || upper.includes('RECORD_AUDIO')) return 'microphone';
    if (upper.includes('STORAGE') || upper.includes('WRITE_FILES') || upper.includes('READ_FILES')) return 'storage';
    if (upper.includes('CONTACTS')) return 'contacts';
    if (upper.includes('CALENDAR')) return 'calendar';
    if (upper.includes('PHONE') || upper.includes('CALL')) return 'phone';
    if (upper.includes('SMS') || upper.includes('MMS') || upper.includes('WAP')) return 'sms';
    if (upper.includes('NOTIFICATION') || upper.includes('POST_NOTIF')) return 'notifications';
    if (upper.includes('ACCESSIBILITY')) return 'accessibility';
    if (upper.includes('HEALTH') || upper.includes('BODY_SENSORS') || upper.includes('FITNESS')) return 'health';
    if (upper.includes('BLUETOOTH') || upper.includes('NFC') || upper.includes('NEARBY') || upper.includes('WIFI_DIRECT')) return 'nearby';
    if (upper.includes('INTERNET') || upper.includes('NETWORK') || upper.includes('WIFI')) return 'internet';
    if (
      upper.includes('BOOT') ||
      upper.includes('VIBRATE') ||
      upper.includes('WAKE_LOCK') ||
      upper.includes('BIOMETRIC') ||
      upper.includes('FINGERPRINT') ||
      upper.includes('OVERLAY') ||
      upper.includes('FOREGROUND') ||
      upper.includes('INSTALL')
    ) {
      return 'system';
    }
    return 'other';
  }

  /**
   * Determines the risk level for an unknown permission based on keywords.
   */
  private detectRiskLevel(rawPermission: string, category: string): RiskLevel {
    const upper = rawPermission.toUpperCase();
    
    // High Risk Indicators
    if (
      upper.includes('BACKGROUND_LOCATION') ||
      upper.includes('BIND_ACCESSIBILITY_SERVICE') ||
      upper.includes('SYSTEM_ALERT_WINDOW') ||
      upper.includes('REQUEST_INSTALL_PACKAGES') ||
      upper.includes('MANAGE_EXTERNAL_STORAGE') ||
      category === 'sms' ||
      upper.includes('PROCESS_OUTGOING_CALLS')
    ) {
      return 'high';
    }

    // Sensitive Indicators
    if (
      category === 'location' ||
      category === 'camera' ||
      category === 'microphone' ||
      category === 'contacts' ||
      category === 'calendar' ||
      category === 'phone' ||
      category === 'health' ||
      upper.includes('STORAGE') ||
      upper.includes('SCAN') ||
      upper.includes('CONNECT')
    ) {
      return 'sensitive';
    }

    // Default
    return 'normal';
  }

  /**
   * Analyzes an array of raw permissions strings and returns structured information.
   * Leverages caching to return instantly on subsequent queries.
   */
  async analyzePermissions(
    packageName: string,
    versionCode: number,
    rawPermissions: string[]
  ): Promise<PermissionAnalysisResult> {
    const cacheKey = `${packageName}:${versionCode}`;

    // 1. Check in-memory cache
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey)!;
    }

    // 2. Check AsyncStorage for persistent caching
    try {
      const saved = await AsyncStorage.getItem(`sheen:permissions:${cacheKey}`);
      if (saved) {
        const parsed = JSON.parse(saved) as PermissionAnalysisResult;
        this.memoryCache.set(cacheKey, parsed);
        return parsed;
      }
    } catch (e) {
      console.warn('[PermissionAnalyzerService] AsyncStorage read failed:', e);
    }

    // 3. Complete fresh parsing
    // Deduplicate unique permissions
    const uniqueRaw = Array.from(new Set(rawPermissions));
    const allPermissions: AnalyzedPermission[] = uniqueRaw.map((p) => {
      const dict = PERMISSION_DICTIONARY[p];
      if (dict) {
        const meta = CATEGORY_META[dict.category];
        return {
          key: p,
          name: dict.name,
          category: meta.name,
          categoryIcon: meta.icon,
          riskLevel: dict.riskLevel,
          description: dict.description,
        };
      }

      // Rollback parsing for custom/unknown permissions
      const catId = this.detectCategory(p);
      const risk = this.detectRiskLevel(p, catId);
      const meta = CATEGORY_META[catId];
      const friendlyName = this.formatPermissionName(p);

      return {
        key: p,
        name: friendlyName,
        category: meta.name,
        categoryIcon: meta.icon,
        riskLevel: risk,
        description: `This permission allows the app to access the device's '${friendlyName}' system capability.`,
      };
    });

    // Counts
    let highRiskCount = 0;
    let sensitiveCount = 0;
    let normalCount = 0;

    // Grouping by categories
    const groupMap = new Map<string, AnalyzedPermission[]>();
    for (const p of allPermissions) {
      // Find category key from category name
      const catKey = Object.keys(CATEGORY_META).find((k) => CATEGORY_META[k].name === p.category) || 'other';
      if (!groupMap.has(catKey)) {
        groupMap.set(catKey, []);
      }
      groupMap.get(catKey)!.push(p);

      if (p.riskLevel === 'high') highRiskCount++;
      else if (p.riskLevel === 'sensitive') sensitiveCount++;
      else normalCount++;
    }

    const categories: PermissionCategoryGroup[] = [];
    for (const [catKey, perms] of groupMap.entries()) {
      const meta = CATEGORY_META[catKey];
      // Sort permissions inside categories: High risk first, then sensitive, then normal
      const sortedPerms = [...perms].sort((a, b) => {
        const riskScore = { high: 3, sensitive: 2, normal: 1 };
        return riskScore[b.riskLevel] - riskScore[a.riskLevel];
      });

      categories.push({
        id: catKey,
        name: meta.name,
        icon: meta.icon,
        color: meta.color,
        permissions: sortedPerms,
      });
    }

    // Sort categories alphabetically but keep 'Other' at the end
    categories.sort((a, b) => {
      if (a.id === 'other') return 1;
      if (b.id === 'other') return -1;
      return a.name.localeCompare(b.name);
    });

    // Notice Warning System: If requests several high-risk permissions (e.g. 2 or more high risk)
    const hasRiskWarning = highRiskCount >= 2;

    const result: PermissionAnalysisResult = {
      packageName,
      versionCode,
      totalCount: uniqueRaw.length,
      highRiskCount,
      sensitiveCount,
      normalCount,
      categories,
      allPermissions,
      hasRiskWarning,
    };

    // Save to caches
    this.memoryCache.set(cacheKey, result);
    try {
      await AsyncStorage.setItem(`sheen:permissions:${cacheKey}`, JSON.stringify(result));
    } catch (e) {
      console.warn('[PermissionAnalyzerService] AsyncStorage save failed:', e);
    }

    return result;
  }

  /**
   * Future feature compatibility: Compares permissions of the currently installed version
   * vs. the incoming/new version code. Returns added, removed, and matching permissions list.
   */
  async compareVersions(
    packageName: string,
    oldVersionCode: number,
    oldRawPerms: string[],
    newVersionCode: number,
    newRawPerms: string[]
  ): Promise<{
    added: AnalyzedPermission[];
    removed: string[];
    common: AnalyzedPermission[];
  }> {
    const oldAnalyzed = await this.analyzePermissions(packageName, oldVersionCode, oldRawPerms);
    const newAnalyzed = await this.analyzePermissions(packageName, newVersionCode, newRawPerms);

    const oldKeys = new Set(oldRawPerms);
    const newKeys = new Set(newRawPerms);

    const added: AnalyzedPermission[] = newAnalyzed.allPermissions
      .filter((p) => !oldKeys.has(p.key))
      .map((p) => ({ ...p, isNew: true }));

    const removed = oldRawPerms.filter((k) => !newKeys.has(k));

    const common = newAnalyzed.allPermissions.filter((p) => oldKeys.has(p.key));

    return {
      added,
      removed,
      common,
    };
  }
}

export const permissionAnalyzerService = new PermissionAnalyzerService();
