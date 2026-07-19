import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Material3TabBar } from '@/components/Material3TabBar';
import { useColors } from '@/hooks/useColors';
import { TopAppBar } from '@/components/TopAppBar';
import { SeasonalEffectsOverlay } from '@/components/SeasonalEffectsOverlay';
import { useTranslation } from '@/lib/i18n';

export default function TabLayout() {
  const colors = useColors();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isRailMode = width >= 600;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SeasonalEffectsOverlay />
      <Tabs 
        tabBar={(props) => <Material3TabBar {...props} />}
        screenOptions={{
          header: (props: any) => <TopAppBar {...props} />,
          headerShown: true,
          sceneStyle: {
            paddingLeft: isRailMode ? 80 : 0,
            backgroundColor: colors.background,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.home'),
            headerShown: false,
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="home-variant" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="downloads"
          options={{
            title: t('settings.downloads'),
            headerShown: false,
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="download-multiple-outline" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="categories"
          options={{
            title: t('tabs.categories'),
            headerShown: false,
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="view-grid-outline" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: t('tabs.search'),
            headerShown: false,
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="magnify" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="favorites"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs.settings'),
            headerShown: false,
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="cog-outline" size={24} color={color} />
            ),
          }}
        />
        
        <Tabs.Screen
          name="updates"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
