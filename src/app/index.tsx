import { useVideoPlayer, VideoView } from 'expo-video';
import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

const VIDEO_URL =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

export default function HomeScreen() {
  const player = useVideoPlayer(VIDEO_URL, (p) => {
    p.loop = true;
    p.play();
  });

  const [icon, setIcon] = useState<'pause' | 'play'>('pause');
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

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
    <View style={styles.container}>
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