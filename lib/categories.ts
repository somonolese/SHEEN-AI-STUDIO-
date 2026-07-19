import { Category } from './types';

export const PREMIUM_CATEGORIES: Category[] = [
  { id: 'multimedia', name: 'Multimedia', icon: 'play-circle-outline', color: '#E65F00', appCount: 0 },
  { id: 'video-players', name: 'Video Players', icon: 'video-outline', color: '#FF6D00', appCount: 0 },
  { id: 'music-audio', name: 'Music & Audio', icon: 'music-box-outline', color: '#BF360C', appCount: 0 },
  { id: 'photography', name: 'Photography', icon: 'camera-outline', color: '#C62828', appCount: 0 },
  { id: 'productivity', name: 'Productivity', icon: 'check-circle-outline', color: '#1E80EC', appCount: 0 },
  { id: 'office', name: 'Office', icon: 'office-building', color: '#1976D2', appCount: 0 },
  { id: 'notes', name: 'Notes', icon: 'notebook-outline', color: '#0277BD', appCount: 0 },
  { id: 'communication', name: 'Communication', icon: 'chat-outline', color: '#00838F', appCount: 0 },
  { id: 'social', name: 'Social', icon: 'account-group-outline', color: '#00897B', appCount: 0 },
  { id: 'internet', name: 'Internet', icon: 'web', color: '#00695C', appCount: 0 },
  { id: 'browsers', name: 'Browsers', icon: 'compass-outline', color: '#0D8C5A', appCount: 0 },
  { id: 'email', name: 'Email', icon: 'email-outline', color: '#2E7D32', appCount: 0 },
  { id: 'tools', name: 'Tools', icon: 'toolbox-outline', color: '#4527A0', appCount: 0 },
  { id: 'file-management', name: 'File Management', icon: 'folder-outline', color: '#3F51B5', appCount: 0 },
  { id: 'security', name: 'Security', icon: 'shield-lock-outline', color: '#6A1B9A', appCount: 0 },
  { id: 'privacy', name: 'Privacy', icon: 'eye-off-outline', color: '#8A3FFC', appCount: 0 },
  { id: 'development', name: 'Development', icon: 'code-tags', color: '#3A55B4', appCount: 0 },
  { id: 'education', name: 'Education', icon: 'school-outline', color: '#37474F', appCount: 0 },
  { id: 'reading', name: 'Reading', icon: 'book-open-outline', color: '#424242', appCount: 0 },
  { id: 'maps-navigation', name: 'Maps & Navigation', icon: 'map-outline', color: '#558B2F', appCount: 0 },
  { id: 'health-fitness', name: 'Health & Fitness', icon: 'heart-pulse', color: '#C2703D', appCount: 0 },
  { id: 'personalization', name: 'Personalization', icon: 'palette-outline', color: '#B71C1C', appCount: 0 },
  { id: 'finance', name: 'Finance', icon: 'cash-multiple', color: '#175DDC', appCount: 0 },
  { id: 'games', name: 'Games', icon: 'gamepad-variant-outline', color: '#E53935', appCount: 0 },
  { id: 'utilities', name: 'Utilities', icon: 'wrench-outline', color: '#0082C9', appCount: 0 },
];

export function inferPremiumCategory(
  appName: string,
  appDescription: string,
  appPackageName: string,
  rawCategories?: string[]
): { id: string; name: string } {
  const text = `${appName} ${appDescription} ${appPackageName} ${(rawCategories || []).join(' ')}`.toLowerCase();

  const rules: { id: string; keywords: string[] }[] = [
    { id: 'video-players', keywords: ['video player', 'mp4', 'mkv', 'vlc', 'video'] },
    { id: 'music-audio', keywords: ['music', 'audio', 'mp3', 'spotify', 'podcast', 'sound'] },
    { id: 'photography', keywords: ['camera', 'photo', 'gallery', 'image editor', 'photography'] },
    { id: 'multimedia', keywords: ['multimedia', 'media'] },
    { id: 'notes', keywords: ['note', 'markdown', 'journal', 'todo', 'task'] },
    { id: 'office', keywords: ['office', 'document', 'pdf', 'spreadsheet', 'presentation', 'word'] },
    { id: 'productivity', keywords: ['productivity', 'calendar', 'habit', 'tracker'] },
    { id: 'email', keywords: ['email', 'mail', 'imap', 'smtp'] },
    { id: 'browsers', keywords: ['browser', 'web browser', 'chromium', 'firefox', 'surf'] },
    { id: 'social', keywords: ['social', 'twitter', 'mastodon', 'reddit', 'matrix'] },
    { id: 'communication', keywords: ['chat', 'message', 'messenger', 'call', 'sms', 'telegram', 'signal', 'xmpp'] },
    { id: 'internet', keywords: ['internet', 'download', 'rss', 'feed', 'network'] },
    { id: 'file-management', keywords: ['file manager', 'file explorer', 'storage', 'sync'] },
    { id: 'security', keywords: ['security', 'password', 'encryption', '2fa', 'otp', 'vpn', 'pgp'] },
    { id: 'privacy', keywords: ['privacy', 'tracker', 'blocker', 'adblock', 'tor'] },
    { id: 'development', keywords: ['development', 'code', 'ide', 'github', 'git', 'programming'] },
    { id: 'education', keywords: ['education', 'learning', 'school', 'math', 'language', 'science'] },
    { id: 'reading', keywords: ['read', 'book', 'epub', 'comic', 'manga'] },
    { id: 'maps-navigation', keywords: ['map', 'navigation', 'gps', 'location', 'transit'] },
    { id: 'health-fitness', keywords: ['health', 'fitness', 'workout', 'exercise', 'diet', 'sleep'] },
    { id: 'personalization', keywords: ['personalization', 'theme', 'icon pack', 'wallpaper', 'launcher'] },
    { id: 'finance', keywords: ['finance', 'money', 'budget', 'crypto', 'wallet', 'bank', 'expense'] },
    { id: 'games', keywords: ['game', 'puzzle', 'arcade', 'emulator', 'play'] },
    { id: 'tools', keywords: ['tool', 'calculator', 'converter', 'weather'] },
    { id: 'utilities', keywords: ['utility', 'system', 'keyboard', 'bluetooth', 'wifi'] },
  ];

  for (const rule of rules) {
    if (rule.keywords.some(k => text.includes(k))) {
      const match = PREMIUM_CATEGORIES.find(c => c.id === rule.id);
      if (match) return { id: match.id, name: match.name };
    }
  }

  return { id: 'utilities', name: 'Utilities' }; // Fallback
}
