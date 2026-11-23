import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet, View } from 'react-native';

const VIDEO_URL =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

export default function HomeScreen() {
  const player = useVideoPlayer(VIDEO_URL, (p) => {
    p.loop = true;
    p.play();
  });

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
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
});