import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MytokFlow from '@/components/mytok-flow';
import PostFlow from '@/components/post-flow';
import SoundPicker, { type SoundChoice } from '@/components/sound-picker';
import StatusFlow from '@/components/status-flow';
import { useAuth } from '@/lib/auth';
import { remixLabel, setRemix, useRemix } from '@/lib/remix';

type Mode = 'post' | 'mytok' | 'status';

const MODES: { key: Mode; label: string }[] = [
  { key: 'post', label: 'POST' },
  { key: 'mytok', label: 'MYTOK' },
  { key: 'status', label: 'STATUS' },
];

export default function UploadScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [focused, setFocused] = useState(true);
  const [mode, setMode] = useState<Mode>('mytok');
  const [idle, setIdle] = useState(true);
  const [sound, setSound] = useState<SoundChoice | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
    const remix = useRemix();
  const touch = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const unsubFocus = navigation.addListener('focus', () => setFocused(true));
    const unsubBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      unsubFocus();
      unsubBlur();
    };
  }, [navigation]);

  const close = () => {
    router.navigate('/');
  };

  const changeMode = (next: Mode) => {
    if (next === mode) {
      return;
    }
    setIdle(true);
    setMode(next);
  };

  if (!session) {
    return (
      <View style={styles.centerScreen}>
        <Pressable
          style={[styles.closeAbs, { top: insets.top + 10 }]}
          onPress={close}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="close" size={26} color="white" />
        </Pressable>
        <MaterialCommunityIcons
          name="video-plus-outline"
          size={56}
          color="#666"
        />
        <Text style={styles.title}>Log in to upload</Text>
        <Text style={styles.sub}>
          Create an account or log in to post on MyTok.
        </Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.navigate('/profile')}
        >
          <Text style={styles.primaryText}>Go to Profile</Text>
        </Pressable>
      </View>
    );
  }

  if (!focused) {
    return <View style={styles.root} />;
  }

  const onSwipeEnd = (dx: number, dy: number) => {
    if (!idle) {
      return;
    }
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) {
      return;
    }
    const i = MODES.findIndex((m) => m.key === mode);
    const next = dx < 0 ? i + 1 : i - 1;
    if (next >= 0 && next < MODES.length) {
      changeMode(MODES[next].key);
    }
  };

  return (
    <View
      style={styles.root}
      onTouchStart={(e) => {
        touch.current = {
          x: e.nativeEvent.pageX,
          y: e.nativeEvent.pageY,
        };
      }}
      onTouchEnd={(e) =>
        onSwipeEnd(
          e.nativeEvent.pageX - touch.current.x,
          e.nativeEvent.pageY - touch.current.y
        )
      }
    >
      {mode === 'mytok' && <MytokFlow sound={sound} onIdle={setIdle} />}
      {mode === 'post' && (
        <PostFlow userId={session.user.id} onIdle={setIdle} onClose={close} />
      )}
      {mode === 'status' && (
        <StatusFlow
          userId={session.user.id}
          onIdle={setIdle}
          onClose={close}
        />
      )}

      {mode === 'mytok' && idle && (
        <View
          pointerEvents="box-none"
          style={[styles.soundWrap, { top: insets.top + 18 }]}
        >
          <Pressable style={styles.soundPill} onPress={() => setPickerOpen(true)}>
            <MaterialCommunityIcons name="music-note" size={20} color="white" />
            <Text style={styles.soundText} numberOfLines={1}>
              {sound ? sound.title : 'Add sound'}
            </Text>
            {sound && (
              <Pressable onPress={() => setSound(null)} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={18} color="white" />
              </Pressable>
            )}
          </Pressable>
        </View>
      )}

      {idle && (
        <View
          pointerEvents="box-none"
          style={[styles.modeWrap, { bottom: insets.bottom + 14 }]}
        >
          <View style={styles.modeBar}>
            {MODES.map((m) => (
              <Pressable
                key={m.key}
                style={[styles.modeBtn, mode === m.key && styles.modeBtnActive]}
                onPress={() => changeMode(m.key)}
              >
                <Text
                  style={[
                    styles.modeText,
                    mode === m.key && styles.modeTextActive,
                  ]}
                >
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      {mode === 'mytok' && idle && remix && (
        <View
          pointerEvents="box-none"
          style={[styles.remixWrap, { top: insets.top + 66 }]}
        >
          <Pressable style={styles.soundPill} onPress={() => setRemix(null)}>
            <MaterialCommunityIcons
              name="layers-outline"
              size={18}
              color="white"
            />
            <Text style={styles.soundText} numberOfLines={1}>
              {remixLabel(remix)}
            </Text>
            <MaterialCommunityIcons name="close" size={18} color="white" />
          </Pressable>
        </View>
      )}
      <SoundPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(c) => setSound(c)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
  centerScreen: {
    flex: 1,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  closeAbs: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 12,
    textAlign: 'center',
  },
  sub: {
    color: '#888',
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 8,
    backgroundColor: '#ff2d55',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  primaryText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    remixWrap: {
    position: 'absolute',
    left: 40,
    right: 40,
    alignItems: 'center',
  },
  soundWrap: {
    position: 'absolute',
    left: 70,
    right: 70,
    alignItems: 'center',
  },
  soundPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    maxWidth: '100%',
  },
  soundText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  modeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  modeBar: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 24,
    backgroundColor: 'rgba(28,28,30,0.9)',
  },
  modeBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  modeBtnActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  modeText: {
    color: '#8e8e93',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  modeTextActive: { color: 'white' },
});