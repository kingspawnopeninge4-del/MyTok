import { MaterialCommunityIcons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { readBytes } from '@/lib/media';
import { supabase } from '@/lib/supabase';

export type SoundChoice = {
  id: string;
  title: string;
  artist: string;
  url: string;
  start: number;
  length: number;
};

type SoundRow = { id: string; title: string; artist: string; url: string };

const ALLOWED = ['mp3', 'm4a', 'aac', 'wav', 'ogg'];
const LENGTHS = [15, 30, 60];
const MAX_SOUND_BYTES = 20 * 1024 * 1024;
const TICKS = Array.from({ length: 44 }, (_, i) =>
  Math.round(8 + Math.abs(Math.sin(i * 0.9) * 20 + Math.cos(i * 0.37) * 12))
);

function mimeOf(ext: string): string {
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'm4a') return 'audio/mp4';
  if (ext === 'aac') return 'audio/aac';
  if (ext === 'wav') return 'audio/wav';
  return 'audio/ogg';
}

function fmt(s: number): string {
  const total = Math.max(0, Math.floor(s));
  const m = Math.floor(total / 60);
  const r = total % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

function TrimView({
  sound,
  onBack,
  onUse,
}: {
  sound: SoundRow;
  onBack: () => void;
  onUse: (c: SoundChoice) => void;
}) {
  const player = useAudioPlayer(sound.url);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [len, setLen] = useState(15);
  const [playing, setPlaying] = useState(false);

  const dims = useRef({ w: 0, d: 0, l: 15 });
  const playingRef = useRef(false);
  const applyStart = useRef((_s: number) => {});

  const eff = duration > 0 ? Math.min(len, duration) : len;
  const maxStart = Math.max(0, duration - eff);

  dims.current.d = duration;
  dims.current.l = len;
  playingRef.current = playing;
  applyStart.current = (s: number) => {
    const c = Math.max(0, Math.min(maxStart, s));
    setStart(c);
    if (playingRef.current) {
      try {
        player.seekTo(c);
      } catch {
        // not ready
      }
    }
  };

  const fromX = (x: number) => {
    const { w, d, l } = dims.current;
    if (w <= 0 || d <= 0) {
      return;
    }
    const e = Math.min(l, d);
    applyStart.current((x / w) * d - e / 2);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => fromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => fromX(e.nativeEvent.locationX),
    })
  ).current;

  useEffect(() => {
    const id = setInterval(() => {
      try {
        const d = player.duration;
        if (d > 0) {
          setDuration((prev) => (prev === d ? prev : d));
        }
      } catch {
        // not loaded yet
      }
    }, 300);
    return () => clearInterval(id);
  }, [player]);

  useEffect(() => {
    if (start > maxStart) {
      setStart(maxStart);
    }
  }, [maxStart, start]);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const id = setInterval(() => {
      try {
        if (player.currentTime >= start + eff) {
          player.seekTo(start);
        }
      } catch {
        // released
      }
    }, 200);
    return () => clearInterval(id);
  }, [playing, start, eff, player]);

  const toggle = () => {
    try {
      if (playing) {
        player.pause();
        setPlaying(false);
      } else {
        player.seekTo(start);
        player.play();
        setPlaying(true);
      }
    } catch {
      // not ready
    }
  };

  const use = () => {
    try {
      player.pause();
    } catch {
      // ignore
    }
    onUse({
      id: sound.id,
      title: sound.title,
      artist: sound.artist,
      url: sound.url,
      start,
      length: eff,
    });
  };

  return (
    <View style={styles.flex}>
      <View style={styles.headerRow}>
        <Pressable style={styles.headerLeft} onPress={onBack} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={26} color="white" />
        </Pressable>
        <Text style={styles.headerTitle}>Choose a part</Text>
      </View>

      <View style={styles.trimBody}>
        <View style={styles.songIcon}>
          <MaterialCommunityIcons name="music-note" size={44} color="white" />
        </View>
        <Text style={styles.songTitle} numberOfLines={2}>
          {sound.title}
        </Text>
        {sound.artist !== '' && (
          <Text style={styles.songArtist}>{sound.artist}</Text>
        )}

        <Text style={styles.hint}>Drag the bar to pick where it starts</Text>
        <View
          style={styles.track}
          onLayout={(e) => {
            dims.current.w = e.nativeEvent.layout.width;
          }}
          {...pan.panHandlers}
        >
          <View pointerEvents="none" style={styles.ticks}>
            {TICKS.map((h, i) => (
              <View key={i} style={[styles.tick, { height: h }]} />
            ))}
          </View>
          {duration > 0 && (
            <View
              pointerEvents="none"
              style={[
                styles.windowBox,
                {
                  left: `${(start / duration) * 100}%`,
                  width: `${(eff / duration) * 100}%`,
                },
              ]}
            />
          )}
        </View>

        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{fmt(start)}</Text>
          <Text style={styles.timeText}>
            {duration > 0 ? fmt(duration) : 'Loading...'}
          </Text>
        </View>

        <View style={styles.nudgeRow}>
          <Pressable
            style={styles.nudgeBtn}
            onPress={() => applyStart.current(start - 5)}
          >
            <Text style={styles.nudgeText}>-5s</Text>
          </Pressable>
          <Pressable style={styles.playBtn} onPress={toggle}>
            <MaterialCommunityIcons
              name={playing ? 'pause' : 'play'}
              size={34}
              color="white"
            />
          </Pressable>
          <Pressable
            style={styles.nudgeBtn}
            onPress={() => applyStart.current(start + 5)}
          >
            <Text style={styles.nudgeText}>+5s</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>Clip length</Text>
        <View style={styles.lenRow}>
          {LENGTHS.map((l) => (
            <Pressable
              key={l}
              style={[styles.lenChip, len === l && styles.lenChipActive]}
              onPress={() => setLen(l)}
            >
              <Text
                style={[styles.lenText, len === l && styles.lenTextActive]}
              >
                {l}s
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.rangeText}>
          Using {fmt(start)} to {fmt(start + eff)}
        </Text>
      </View>

      <Pressable
        style={[styles.useBtn, duration <= 0 && styles.disabled]}
        onPress={use}
        disabled={duration <= 0}
      >
        <Text style={styles.useText}>Use this sound</Text>
      </Pressable>
    </View>
  );
}

export default function SoundPicker({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (c: SoundChoice) => void;
}) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const me = session ? session.user.id : null;

  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<SoundRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [trial, setTrial] = useState<SoundRow | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});

    const q = query.trim().replace(/[%_,()\\.]/g, '');
    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const base = supabase
          .from('sounds')
          .select('id,title,artist,url')
          .order('created_at', { ascending: false })
          .limit(50);
        const { data, error } =
          q.length > 0
            ? await base.or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
            : await base;
        if (cancelled) {
          return;
        }
        setFailed(error !== null);
        setRows(error ? [] : ((data ?? []) as SoundRow[]));
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, query]);

  const doUpload = async (asset: DocumentPicker.DocumentPickerAsset) => {
    if (!me) {
      return;
    }
    const dot = asset.name.lastIndexOf('.');
    const ext = dot >= 0 ? asset.name.slice(dot + 1).toLowerCase() : '';
    if (!ALLOWED.includes(ext)) {
      Alert.alert('Unsupported file', 'Use an mp3, m4a, aac, wav or ogg file.');
      return;
    }
    setUploading(true);
    try {
      const bytes = await readBytes(asset.uri);
      const path = me + '/' + Date.now() + '.' + ext;
      const { error: upErr } = await supabase.storage
        .from('sounds')
        .upload(path, bytes, { contentType: mimeOf(ext) });
      if (upErr) {
        Alert.alert('Upload failed', upErr.message);
        return;
      }
      const url = supabase.storage.from('sounds').getPublicUrl(path).data
        .publicUrl;
      const prof = await supabase
        .from('profiles')
        .select('username')
        .eq('id', me)
        .maybeSingle();
      const artist = prof.data ? '@' + prof.data.username : '';
      const title = (dot > 0 ? asset.name.slice(0, dot) : asset.name).slice(
        0,
        80
      );
      const { data, error: dbErr } = await supabase
        .from('sounds')
        .insert({ user_id: me, title, artist, url })
        .select('id,title,artist,url')
        .single();
      if (dbErr || !data) {
        await supabase.storage.from('sounds').remove([path]);
        Alert.alert('Could not save the sound', dbErr ? dbErr.message : '');
        return;
      }
      const row = data as SoundRow;
      setRows((prev) => [row, ...prev]);
      setTrial(row);
    } catch {
      Alert.alert('Something went wrong', 'Check your internet and try again.');
    } finally {
      setUploading(false);
    }
  };

  const uploadOwn = async () => {
    if (!me) {
      Alert.alert('Log in to MyTok', 'Log in to upload your own sounds.');
      return;
    }
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || res.assets.length === 0) {
        return;
      }
      const asset = res.assets[0];
      if (asset.size && asset.size > MAX_SOUND_BYTES) {
        Alert.alert('File too big', 'Sounds can be up to 20 MB.');
        return;
      }
      Alert.alert(
        'Do you have the rights?',
        'Only upload sounds you made or have permission to use. Sounds you upload are public and anyone on MyTok can use them.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'I have the rights', onPress: () => doUpload(asset) },
        ]
      );
    } catch {
      Alert.alert('Could not open your files', 'Please try again.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {
        if (trial) {
          setTrial(null);
        } else {
          onClose();
        }
      }}
    >
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 },
        ]}
      >
        {trial ? (
          <TrimView
            key={trial.id}
            sound={trial}
            onBack={() => setTrial(null)}
            onUse={(c) => {
              setTrial(null);
              onSelect(c);
              onClose();
            }}
          />
        ) : (
          <View style={styles.flex}>
            <View style={styles.headerRow}>
              <Pressable
                style={styles.headerLeft}
                onPress={onClose}
                hitSlop={12}
              >
                <MaterialCommunityIcons name="close" size={26} color="white" />
              </Pressable>
              <Text style={styles.headerTitle}>Sounds</Text>
            </View>

            <View style={styles.searchBox}>
              <MaterialCommunityIcons name="magnify" size={22} color="#888" />
              <TextInput
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                placeholder="Search sounds"
                placeholderTextColor="#777"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={10}>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={20}
                    color="#888"
                  />
                </Pressable>
              )}
            </View>

            <Pressable
              style={[styles.uploadBtn, uploading && styles.disabled]}
              onPress={uploadOwn}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="white" />
              ) : (
                <MaterialCommunityIcons
                  name="upload"
                  size={20}
                  color="white"
                />
              )}
              <Text style={styles.uploadText}>
                {uploading ? 'Uploading...' : 'Upload your own sound'}
              </Text>
            </Pressable>

            {loading && (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color="white" />
              </View>
            )}

            <FlatList
              data={rows}
              keyExtractor={(r) => r.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              ListEmptyComponent={
                loading ? (
                  <View />
                ) : (
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyTitle}>
                      {failed ? 'Something went wrong' : 'No sounds yet'}
                    </Text>
                    <Text style={styles.emptySub}>
                      {failed
                        ? 'Check your internet connection and try again.'
                        : 'Upload the first one with the button above.'}
                    </Text>
                  </View>
                )
              }
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => setTrial(item)}>
                  <View style={styles.rowIcon}>
                    <MaterialCommunityIcons
                      name="music-note"
                      size={24}
                      color="white"
                    />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.artist !== '' && (
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {item.artist}
                      </Text>
                    )}
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={22}
                    color="#888"
                  />
                </Pressable>
              )}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: 'black' },
  headerRow: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLeft: { position: 'absolute', left: 16 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: '#1c1c1e',
    gap: 8,
  },
  input: { flex: 1, color: 'white', fontSize: 16, height: 44 },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: '#ff2d55',
  },
  uploadText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  disabled: { opacity: 0.5 },
  loadingWrap: { paddingVertical: 16 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptySub: {
    color: '#888',
    fontSize: 15,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, marginLeft: 12 },
  rowTitle: { color: 'white', fontSize: 16, fontWeight: '600' },
  rowSub: { color: '#999', fontSize: 14, marginTop: 2 },
  trimBody: { flex: 1, alignItems: 'center', paddingHorizontal: 20 },
  songIcon: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  songTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 14,
    textAlign: 'center',
  },
  songArtist: { color: '#999', fontSize: 15, marginTop: 4 },
  hint: { color: '#888', fontSize: 13, marginTop: 24, marginBottom: 8 },
  track: {
    alignSelf: 'stretch',
    height: 64,
    borderRadius: 8,
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ticks: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  tick: { width: 3, borderRadius: 2, backgroundColor: '#555' },
  windowBox: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: '#ff2d55',
    borderRadius: 8,
    backgroundColor: 'rgba(255,45,85,0.25)',
  },
  timeRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: { color: '#aaa', fontSize: 12 },
  nudgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 20,
  },
  nudgeBtn: {
    width: 64,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeText: { color: 'white', fontSize: 15, fontWeight: '600' },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ff2d55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lenRow: { flexDirection: 'row', gap: 10 },
  lenChip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#2c2c2e',
  },
  lenChipActive: { backgroundColor: 'white' },
  lenText: { color: 'white', fontSize: 14, fontWeight: '600' },
  lenTextActive: { color: 'black' },
  rangeText: { color: '#aaa', fontSize: 14, marginTop: 14 },
  useBtn: {
    height: 50,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#ff2d55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  useText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});