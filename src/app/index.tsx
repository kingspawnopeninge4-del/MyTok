import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

const VIDEOS = [
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4',
];

function VideoItem({
  url,
  height,
  isActive,
}: {
  url: string;
  height: number;
  isActive: boolean;
}) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
  });

  const [icon, setIcon] = useState<'pause' | 'play'>('pause');
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  // Autoplay when this video is on screen, pause and rewind when it is not
  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
      player.currentTime = 0;
    }
  }, [isActive, player]);

  const flashIcon = () => {
    opacity.setValue(1);
    scale.setValue(0.8);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1.2,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const togglePlay = () => {
    if (player.playing) {
      player.pause();
      setIcon('pause');
    } else {
      player.play();
      setIcon('play');
    }
    flashIcon();
  };

  return (
    <View style={{ height, backgroundColor: 'black' }}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
      />
      <Pressable style={styles.tapArea} onPress={togglePlay} />

      <Animated.View
        pointerEvents="none"
        style={[styles.iconWrap, { opacity, transform: [{ scale }] }]}
      >
        <View style={styles.circle}>
          {icon === 'pause' ? (
            <View style={styles.pauseRow}>
              <View style={styles.pauseBar} />
              <View style={styles.pauseBar} />
            </View>
          ) : (
            <View style={styles.triangle} />
          )}
        </View>
      </Animated.View>
    </View>
  );
}

export default function HomeScreen() {
  const { height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [listHeight, setListHeight] = useState(height);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
      const first = viewableItems[0];
      if (first && first.index !== null && first.index !== undefined) {
        setActiveIndex(first.index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  return (
    <View
      style={styles.container}
      onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
    >
      <FlatList
        data={VIDEOS}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => (
          <VideoItem
            url={item}
            height={listHeight}
            isActive={index === activeIndex}
          />
        )}
        showsVerticalScrollIndicator={false}
        snapToInterval={listHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        bounces={false}
        overScrollMode="never"
        getItemLayout={(_, i) => ({
          length: listHeight,
          offset: listHeight * i,
          index: i,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  video: {
    flex: 1,
  },
  tapArea: {
    ...StyleSheet.absoluteFill,
  },
  iconWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pauseBar: {
    width: 8,
    height: 32,
    borderRadius: 2,
    backgroundColor: 'white',
  },
  triangle: {
    width: 0,
    height: 0,
    marginLeft: 6,
    borderTopWidth: 18,
    borderBottomWidth: 18,
    borderLeftWidth: 30,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'white',
  },
});