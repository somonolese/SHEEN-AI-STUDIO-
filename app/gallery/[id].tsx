import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FullscreenGallery } from '@/components/FullscreenGallery';
import { useCatalog } from '@/contexts/CatalogContext';
import { View } from 'react-native';

export default function GalleryScreen() {
  const { id, index } = useLocalSearchParams();
  const { getAppById } = useCatalog();
  const router = useRouter();

  const app = getAppById(id as string);

  if (!app || !app.screenshotUrls || app.screenshotUrls.length === 0) {
    return <View style={{ flex: 1, backgroundColor: 'black' }} />;
  }

  const initialIndex = index ? parseInt(index as string, 10) : 0;

  return (
    <FullscreenGallery 
      images={app.screenshotUrls} 
      initialIndex={initialIndex} 
      onClose={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/');
        }
      }} 
    />
  );
}
