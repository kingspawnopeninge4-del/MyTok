import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Image,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export type StatusItem = {
  id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string;
  created_at: string;
};

const IMAGE_MS = 5000;

function timeAgo(iso: string): string {
  const mins = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  );
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + 'm ago';
  return Math.floor(mins / 60) + 'h ago';
}

function ImageSlide({
  url,
  paused,
  onProgress,
  onDone,
}: {
  url: string;
  paused: boolean;
  onProgress: (p: number) => void;
  onDone: () => void;
}) {
  const elapsed = useRef(0);
  const pausedRef = useRef(paused);
  const cb = useRef({ onProgress, onDone });
  pausedRef.current = paused;
  cb.current = { onProgress, onDone };

  useEffect(() => {
    const id = setInterval(() => {
      if (pausedRef.current) {
        return;
      }
      elapsed.current += 100;
      const p = Math.min(1, elapsed.current / IMAGE_MS);
      cb.current.onProgress(p);
      if (p >= 1) {
        clearInterval(id);
        cb.current.onDone();
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  return (
    <Image
      source={{ uri: url }}
      style={StyleSheet.absoluteFill}
      resizeMode="contain"
    />
  );
}

function VideoSlide({
  url,
  paused,
  onProgress,
  onDone,
}: {
  url: string;
  paused: boolean;
  onProgress: (p: number) => void;
  onDone: () => void;
}) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.play();
  });
  const finished = useRef(false);
  const cb = useRef({ onProgress, onDone });
  cb.current = { onProgress, onDone };

  useEffect(() => {
    try {
      if (paused) {
        player.pause();
      } else {
        player.play();
      }
    } catch {
      // released
    }
  }, [paused, player]);

  useEffect(() => {
    const id = setInterval(() => {
      try {
        const d = player.duration;
        if (d > 0) {
          const p = Math.min(1, player.currentTime / d);
          cb.current.onProgress(p);
          if (p >= 0.98 && !finished.current) {
            finished.current = true;
            cb.current.onDone();
          }
        }
      } catch {
        // not ready
      }
    }, 100);
    return () => clearInterval(id);
  }, [player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
    />
  );
}

export default function StatusViewer({
  username,
  avatarUrl,
  items,
  canDelete,
  onClose,
  onDeleted,
}: {
  username: string;
  avatarUrl: string | null;
  items: StatusItem[];
  canDelete: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const item = items[index];

  const goNext = () => {
    if (index >= items.length - 1) {
      onClose();
    } else {
      setProgress(0);
      setIndex(index + 1);
    }
  };

  const goPrev = () => {
    setProgress(0);
    if (index > 0) {
      setIndex(index - 1);
    }
  };

  const confirmDelete = () => {
    if (!item) {
      return;
    }
    setPaused(true);
    Alert.alert('Delete status?', 'This status will be removed.', [
      { text: 'Cancel', style: 'cancel', onPress: () => setPaused(false) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('statuses').delete().eq('id', item.id);
          onDeleted();
        },
      },
    ]);
  };

  if (!item) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <View key={item.id} style={StyleSheet.absoluteFill}>
        {item.media_type === 'image' ? (
          <ImageSlide
            url={item.media_url}
            paused={paused}
            onProgress={setProgress}
            onDone={goNext}
          />
        ) : (
          <VideoSlide
            url={item.media_url}
            paused={paused}
            onProgress={setProgress}
            onDone={goNext}
          />
        )}
      </View>

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={(e) =>
          e.nativeEvent.locationX < width * 0.35 ? goPrev() : goNext()
        }
        onLongPress={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        delayLongPress={200}
      />

      <View
        pointerEvents="box-none"
        style={[styles.top, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.bars}>
          {items.map((it, i) => (
            <View key={it.id} style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width:
                      i < index
                        ? '100%'
                        : i === index
                          ? `${progress * 100}%`
                          : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.headRow} pointerEvents="box-none">
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <Text style={styles.avatarLetter}>
                {username.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.name}>@{username}</Text>
          <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
          <View style={styles.flex} />
          {canDelete && (
            <Pressable onPress={confirmDelete} hitSlop={12}>
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={24}
                color="white"
              />
            </Pressable>
          )}
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={28} color="white" />
          </Pressable>
        </View>
      </View>

      {item.caption !== '' && (
        <View
          pointerEvents="none"
          style={[styles.captionWrap, { paddingBottom: insets.bottom + 24 }]}
        >
          <Text style={styles.caption}>{item.caption}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: 'black' },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  bars: { flexDirection: 'row', gap: 4, paddingHorizontal: 10 },
  barTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  barFill: { height: 3, backgroundColor: 'white' },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarEmpty: {
    backgroundColor: '#ff2d55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  name: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  time: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  closeBtn: { marginLeft: 14 },
  captionWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 40,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  caption: { color: 'white', fontSize: 17, textAlign: 'center' },
});