import React, { useState, useCallback, useRef } from 'react';
import { View, BackHandler, StyleSheet, Dimensions, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut, useAnimatedStyle, useSharedValue, withSpring, runOnJS, interpolate, Extrapolation, useAnimatedScrollHandler, SharedValue } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SmartImage } from '@/components/SmartImage';
import { proxyUrl } from '@/lib/services/Network';
import { BlurView } from 'expo-blur';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';


interface Props {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

function ZoomableImage({ uri, onClose, index, currentIndex }: { uri: string; onClose: () => void; index: number; currentIndex: number }) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [isZoomed, setIsZoomed] = useState(false);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1.01) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(setIsZoomed)(false);
      } else {
        savedScale.value = scale.value;
        runOnJS(setIsZoomed)(true);
      }
    });

  let pan = Gesture.Pan();
  if (!isZoomed) {
    pan = pan.activeOffsetY([-15, 15]).failOffsetX([-5, 5]);
  }

  const panGesture = pan
    .onUpdate((e) => {
      if (isZoomed) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      } else {
        translateY.value = e.translationY;
        scale.value = interpolate(Math.abs(e.translationY), [0, windowHeight], [1, 0.7], Extrapolation.CLAMP);
      }
    })
    .onEnd((e) => {
      if (isZoomed) {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      } else {
        if (Math.abs(e.translationY) > 150 || Math.abs(e.velocityY) > 1000) {
           runOnJS(onClose)();
        } else {
           translateY.value = withSpring(0);
           scale.value = withSpring(1);
        }
      }
    });
      
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.01) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(setIsZoomed)(false);
      } else {
        scale.value = withSpring(2.5);
        savedScale.value = 2.5;
        runOnJS(setIsZoomed)(true);
      }
    });

  const composed = Gesture.Race(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Reset zoom when scrolled away
  React.useEffect(() => {
    if (Math.abs(currentIndex - index) > 1 && isZoomed) {
       scale.value = 1;
       savedScale.value = 1;
       translateX.value = 0;
       translateY.value = 0;
       savedTranslateX.value = 0;
       savedTranslateY.value = 0;
       setIsZoomed(false);
    }
  }, [currentIndex, index, isZoomed]);

  const isVisible = Math.abs(currentIndex - index) <= 1;
  if (!isVisible) {
    return <View style={{ width: windowWidth, height: windowHeight }} />;
  }

  return (
    <View style={{ width: windowWidth, height: windowHeight, alignItems: 'center', justifyContent: 'center' }}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[{ width: windowWidth, height: windowHeight, alignItems: 'center', justifyContent: 'center' }]}>
           {/* @ts-ignore */}
           <Animated.View sharedTransitionTag={`image-${uri}`} style={[animatedStyle, { width: '100%', height: '100%' }]}>
             <SmartImage source={{ uri: proxyUrl(uri) }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
           </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function PaginationDot({ index, scrollX }: { index: number; scrollX: SharedValue<number> }) {
  const { width: windowWidth } = useWindowDimensions();
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * windowWidth,
      index * windowWidth,
      (index + 1) * windowWidth,
    ];
    
    const scale = interpolate(scrollX.value, inputRange, [0.8, 1.2, 0.8], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, inputRange, [0.4, 1, 0.4], Extrapolation.CLAMP);
    const width = interpolate(scrollX.value, inputRange, [6, 16, 6], Extrapolation.CLAMP);
    
    return {
      width,
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View style={[styles.dot, animatedStyle]} />
  );
}

export function FullscreenGallery({ images, initialIndex, onClose }: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const scrollX = useSharedValue(initialIndex * windowWidth);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
    onMomentumEnd: (event) => {
      runOnJS(setCurrentIndex)(Math.round(event.contentOffset.x / windowWidth));
    }
  });

  React.useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      runOnJS(onClose)();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const [hasScrolled, setHasScrolled] = useState(false);

  const handleLayout = () => {
    if (!hasScrolled && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ x: initialIndex * windowWidth, animated: false });
      setHasScrolled(true);
    }
  };

  // Use a slight delay or directly pass contentOffset to scroll to initial index
  // However, contentOffset in Reanimated ScrollView sometimes doesn't work perfectly on Android
  // A safe fallback is using ``

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 1000 }]}>
       <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
          <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)' }]} />
          
          <Animated.ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: initialIndex * windowWidth, y: 0 }}
            onLayout={handleLayout}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          >
            {images.map((img, i) => (
              <ZoomableImage 
                key={img} 
                uri={img} 
                onClose={onClose} 
                index={i} 
                currentIndex={currentIndex}
              />
            ))}
          </Animated.ScrollView>

          <View style={styles.header}>
            <Pressable 
              style={styles.closeBtn} 
              onPress={onClose}
              hitSlop={20}
            >
              <MaterialCommunityIcons name="close" size={24} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.footer}>
             <View style={styles.indicatorContainer}>
                {images.map((_, i) => (
                  <PaginationDot key={i} index={i} scrollX={scrollX} />
                ))}
             </View>
          </View>

        </Animated.View>
      </GestureHandlerRootView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    paddingTop: 50,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    zIndex: 10,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  }
});
