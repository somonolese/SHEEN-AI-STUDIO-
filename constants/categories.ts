import { type ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface Category {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  color: string;
  appsCount: number;
}

export const POPULAR_CATEGORIES = [
  'multimedia',
  'social',
  'privacy',
  'development',
  'games',
  'productivity'
];
