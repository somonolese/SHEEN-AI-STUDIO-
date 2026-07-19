import { useMemo } from 'react';
import { App } from '@/lib/types';
import { useCatalog } from '@/contexts/CatalogContext';

export interface CatalogLists {
  featured: App[];
  popular: App[];
  recentlyUpdated: App[];
  trending: App[];
  recommended: App[];
  isLoading: boolean;
  hasApps: boolean;
}

// Simple deterministic PRNG
function mulberry32(a: number) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export function useCatalogLists(): CatalogLists {
  const { apps, isLoading } = useCatalog();

  return useMemo(() => {
    if (!apps.length) {
      return { featured: [], popular: [], recentlyUpdated: [], trending: [], recommended: [], isLoading, hasApps: false };
    }

    const sortedByUpdated = [...apps].sort((a, b) => b.lastUpdated - a.lastUpdated);
    const sortedByAdded = [...apps].sort((a, b) => b.added - a.added);

    // Rotate selection every 12 hours
    const d = new Date();
    const seed = d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate() + (d.getHours() >= 12 ? 1 : 0);
    const rand = mulberry32(seed);

    // Filter high-quality apps (has screenshots and a decent description)
    const highQualityApps = apps.filter(a => (a.screenshotUrls?.length ?? 0) > 0 && (a.description?.length ?? 0) > 100);
    // Prioritize high-quality apps if we have at least 3, otherwise prioritize apps with any visuals (screenshot or icon)
    const pool = highQualityApps.length >= 3
      ? highQualityApps
      : (apps.filter(a => (a.screenshotUrls?.length ?? 0) > 0 || a.iconUrl).length >= 3
          ? apps.filter(a => (a.screenshotUrls?.length ?? 0) > 0 || a.iconUrl)
          : apps);

    // Shuffle the pool for featured
    const shuffledFeatured = [...pool].sort(() => rand() - 0.5);
    const featuredApps = shuffledFeatured.length > 0 ? shuffledFeatured.slice(0, 6) : apps.slice(0, 6);

    // Create a different seed for popular / recommended
    const randPop = mulberry32(seed + 100);
    const shuffledPopular = [...apps].sort(() => randPop() - 0.5);
    const popularApps = shuffledPopular.slice(0, 6);

    const randRec = mulberry32(seed + 200);
    const shuffledRec = [...apps].sort(() => randRec() - 0.5);
    const recommendedApps = shuffledRec.slice(0, 10);

    return {
      featured: featuredApps,
      popular: popularApps,
      recentlyUpdated: sortedByUpdated.slice(0, 10),
      trending: sortedByAdded.slice(0, 10),
      recommended: recommendedApps,
      isLoading,
      hasApps: true,
    };
  }, [apps, isLoading]);
}
