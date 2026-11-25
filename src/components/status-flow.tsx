import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    CameraView,
    useCameraPermissions,
    useMicrophonePermissions,
} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Linking,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { getExt, getImageExt, imageMime, mimeFor, readBytes } from '@/lib/media';
import { supabase } from '@/lib/supabase';

type Media = { uri: string; type: 'image' | 'video' };

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 60;
const RECORD_SECONDS = 15;

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

function StatusCamera({
  error,
  onCaptured,
  onGallery,
  onClose,
  onRecording,
}: {
  error: string;
  onCaptured: (m: Media) => void;
  onGallery: () => void;
  onClose: () => void;
  onRecording: (r: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const camRef = useRef<CameraView>(null);

  const [kind, setKind] = useState<'photo' | 'video'>('photo');
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [light, setLight] = useState(false);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  useEffect(() => {
    onRecording(recording);
  }, [recording, onRecording]);

  useEffect(() => {
    if (!recording) {
      return;
    }
    const id = setInterval(() => {
      setElapsed((Date.now() - startedAt.current) / 1000);
    }, 200);
    return () => clearInterval(id);
  }, [recording]);

  const switchKind = (k: 'photo' | 'video') => {
    if (k === kind || recording) {
      return;
    }
    setReady(false);
    setKind(k);
  };

  const shoot = async () => {
    const cam = camRef.current;
    if (!cam || !ready) {
      return;
    }
    if (kind === 'photo') {
      try {
        const p = await cam.takePictureAsync({ quality: 0.8 });
        if (p && p.uri) {
          onCaptured({ uri: p.uri, type: 'image' });
        }
      } catch {
        Alert.alert('Could not take the photo', 'Please try again.');
      }
      return;
    }
    if (recording) {
      cam.stopRecording();
      return;
    }
    startedAt.current = Date.now();
    setElapsed(0);
    setRecording(true);
    try {
      const r = await cam.recordAsync({ maxDuration: RECORD_SECONDS });
      if (r && r.uri) {
        onCaptured({ uri: r.uri, type: 'video' });
      }
    } catch {
      Alert.alert('Recording failed', 'Could not record the video. Try again.');
    } finally {
      setRecording(false);
      setElapsed(0);
    }
  };

  const progress = Math.min(1, elapsed / RECORD_SECONDS);

  return (
    <View style={styles.black}>
      <CameraView
        key={kind}
        ref={camRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode={kind === 'photo' ? 'picture' : 'video'}
        flash={light ? 'on' : 'off'}
        enableTorch={light && kind === 'video' && facing === 'back'}
        videoQuality="720p"
        videoBitrate={3000000}
        onCameraReady={() => setReady(true)}
      />

      {recording && (
        <View
          pointerEvents="none"
          style={[styles.progressTrack, { top: insets.top + 6 }]}
        >
          <View
            style={[styles.progressFill, { width: `${progress * 100}%` }]}
          />
        </View>
      )}

      <View style={[styles.topRow, { top: insets.top + 18 }]}>
        <Pressable
          style={styles.roundBtn}
          onPress={onClose}
          disabled={recording}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="close" size={26} color="white" />
        </Pressable>
        <Text style={styles.topTitle}>New status</Text>
        <View style={styles.roundBtnSpace} />
      </View>

      {error !== '' && (
        <View style={[styles.errorBanner, { top: insets.top + 74 }]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={[styles.tools, { top: insets.top + 90 }]}>
        <Pressable
          style={styles.tool}
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          disabled={recording}
        >
          <MaterialCommunityIcons
            name="camera-flip-outline"
            size={30}
            color="white"
          />
          <Text style={styles.toolLabel}>Flip</Text>
        </Pressable>
        <Pressable style={styles.tool} onPress={() => setLight((l) => !l)}>
          <MaterialCommunityIcons
            name={light ? 'flash' : 'flash-off'}
            size={30}
            color="white"
          />
          <Text style={styles.toolLabel}>Flash</Text>
        </Pressable>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 84 }]}>
        {!recording ? (
          <View style={styles.kindRow}>
            <Pressable
              style={[styles.kindChip, kind === 'photo' && styles.kindActive]}
              onPress={() => switchKind('photo')}
            >
              <Text
                style={[
                  styles.kindText,
                  kind === 'photo' && styles.kindTextActive,
                ]}
              >
                Photo
              </Text>
            </Pressable>
            <Pressable
              style={[styles.kindChip, kind === 'video' && styles.kindActive]}
              onPress={() => switchKind('video')}
            >
              <Text
                style={[
                  styles.kindText,
                  kind === 'video' && styles.kindTextActive,
                ]}
              >
                Video 15s
              </Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.recText}>
            {Math.floor(elapsed)}s / {RECORD_SECONDS}s
          </Text>
        )}

        <View style={styles.controlsRow}>
          <View style={styles.sideSlot}>
            {!recording && (
              <Pressable style={styles.galleryBtn} onPress={onGallery}>
                <MaterialCommunityIcons
                  name="image-multiple-outline"
                  size={26}
                  color="white"
                />
                <Text style={styles.toolLabel}>Gallery</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            style={[styles.shutterOuter, !ready && styles.disabled]}
            onPress={shoot}
            disabled={!ready}
          >
            <View
              style={[
                styles.shutterInner,
                kind === 'video' && styles.shutterVideo,
                recording && styles.shutterActive,
              ]}
            />
          </Pressable>

          <View style={styles.sideSlot} />
        </View>
      </View>
    </View>
  );
}

function StatusPreview({
  media,
  userId,
  onBack,
  onPosted,
}: {
  media: Media;
  userId: string;
  onBack: () => void;
  onPosted: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const share = async () => {
    if (posting) {
      return;
    }
    setPosting(true);
    setError('');

    const isVideo = media.type === 'video';
    const ext = isVideo ? getExt(media.uri) : getImageExt(media.uri);
    const mime = isVideo ? mimeFor(ext) : imageMime(ext);
    const path = userId + '/status_' + Date.now() + '.' + ext;

    try {
      const bytes = await readBytes(media.uri);
      const { error: upErr } = await supabase.storage
        .from('videos')
        .upload(path, bytes, { contentType: mime });
      if (upErr) {
        setError('Upload failed: ' + upErr.message);
        return;
      }
      const url = supabase.storage.from('videos').getPublicUrl(path).data
        .publicUrl;
      const { error: dbErr } = await supabase.from('statuses').insert({
        user_id: userId,
        media_url: url,
        media_type: media.type,
        caption: caption.trim(),
      });
      if (dbErr) {
        await supabase.storage.from('videos').remove([path]);
        setError('Could not share the status: ' + dbErr.message);
        return;
      }
      onPosted();
    } catch {
      setError('Something went wrong. Check your internet and try again.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <View style={styles.black}>
      {media.type === 'image' ? (
        <Image
          source={{ uri: media.uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <VideoPreview uri={media.uri} />
      )}

      <View style={[styles.topRow, { top: insets.top + 10 }]}>
        <Pressable
          style={styles.roundBtn}
          onPress={onBack}
          disabled={posting}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="arrow-left" size={26} color="white" />
        </Pressable>
        <View style={styles.roundBtnSpace} />
        <View style={styles.roundBtnSpace} />
      </View>

      <KeyboardAvoidingView behavior="padding" style={styles.postAvoid}>
        <View style={[styles.postPanel, { paddingBottom: insets.bottom + 14 }]}>
          <TextInput
            style={styles.captionInput}
            placeholder="Add a caption (optional)"
            placeholderTextColor="#aaa"
            maxLength={100}
            value={caption}
            onChangeText={setCaption}
            editable={!posting}
          />
          {error !== '' && <Text style={styles.postError}>{error}</Text>}
          <Pressable
            style={[styles.shareBtn, posting && styles.disabled]}
            onPress={share}
            disabled={posting}
          >
            {posting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.shareText}>Share to status</Text>
            )}
          </Pressable>
          <Text style={styles.noteText}>Visible for 24 hours</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function StatusFlow({
  userId,
  onIdle,
  onClose,
}: {
  userId: string;
  onIdle: (idle: boolean) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { bumpProfile } = useAuth();

  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [media, setMedia] = useState<Media | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    onIdle(media === null && !recording);
  }, [media, recording, onIdle]);

  const pickFromGallery = async () => {
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || result.assets.length === 0) {
        return;
      }
      const a = result.assets[0];
      if (a.type === 'video') {
        if (a.duration && a.duration > MAX_VIDEO_SECONDS * 1000) {
          setError('Status videos can be up to 60 seconds.');
          return;
        }
        if (a.fileSize && a.fileSize > MAX_BYTES) {
          setError('That video is over 50 MB. Pick a smaller one.');
          return;
        }
        setMedia({ uri: a.uri, type: 'video' });
      } else {
        setMedia({ uri: a.uri, type: 'image' });
      }
    } catch {
      setError('Could not open your gallery.');
    }
  };

  const allowAccess = async () => {
    const blocked =
      (camPerm && !camPerm.granted && !camPerm.canAskAgain) ||
      (micPerm && !micPerm.granted && !micPerm.canAskAgain);
    if (blocked) {
      Linking.openSettings();
      return;
    }
    await requestCam();
    await requestMic();
  };

  if (media) {
    return (
      <StatusPreview
        key={media.uri}
        media={media}
        userId={userId}
        onBack={() => setMedia(null)}
        onPosted={() => {
          setMedia(null);
          bumpProfile();
          Alert.alert(
            'Status shared!',
            'It stays for 24 hours. Tap your profile picture to see it.'
          );
          router.navigate('/profile');
        }}
      />
    );
  }

  if (camPerm === null || micPerm === null) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color="white" />
      </View>
    );
  }

  if (!camPerm.granted || !micPerm.granted) {
    const blocked =
      (!camPerm.granted && !camPerm.canAskAgain) ||
      (!micPerm.granted && !micPerm.canAskAgain);
    return (
      <View style={styles.centerScreen}>
        <Pressable
          style={[styles.roundBtn, styles.closeAbs, { top: insets.top + 10 }]}
          onPress={onClose}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="close" size={26} color="white" />
        </Pressable>
        <MaterialCommunityIcons name="camera-outline" size={56} color="#666" />
        <Text style={styles.title}>Allow camera and microphone</Text>
        <Text style={styles.sub}>
          MyTok needs your camera for photos and your microphone for video
          sound.
        </Text>
        {error !== '' && <Text style={styles.errorPlain}>{error}</Text>}
        <Pressable style={styles.primaryBtn} onPress={allowAccess}>
          <Text style={styles.primaryText}>
            {blocked ? 'Open settings' : 'Allow access'}
          </Text>
        </Pressable>
        <Pressable style={styles.outlineBtn} onPress={pickFromGallery}>
          <Text style={styles.outlineText}>Choose from gallery instead</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <StatusCamera
      error={error}
      onCaptured={(m) => {
        setError('');
        setMedia(m);
      }}
      onGallery={pickFromGallery}
      onClose={onClose}
      onRecording={setRecording}
    />
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: 'black' },
  centerScreen: {
    flex: 1,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  closeAbs: { position: 'absolute', left: 16 },
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
  errorPlain: {
    color: '#ff6b6b',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
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
  outlineBtn: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  outlineText: { color: 'white', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  progressTrack: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: '#ff2d55' },
  topRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtnSpace: { width: 40, height: 40 },
  errorBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  errorText: { color: '#ff6b6b', fontSize: 14, textAlign: 'center' },
  tools: {
    position: 'absolute',
    right: 14,
    alignItems: 'center',
    gap: 18,
  },
  tool: { alignItems: 'center' },
  toolLabel: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  kindRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  kindChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  kindActive: { backgroundColor: 'white' },
  kindText: { color: 'white', fontSize: 14, fontWeight: '600' },
  kindTextActive: { color: 'black' },
  recText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 18,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: 24,
  },
  sideSlot: { width: 64, alignItems: 'center', justifyContent: 'center' },
  galleryBtn: { alignItems: 'center' },
  shutterOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 5,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'white',
  },
  shutterVideo: { backgroundColor: '#ff2d55' },
  shutterActive: { width: 32, height: 32, borderRadius: 8 },
  postAvoid: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  postPanel: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  captionInput: {
    height: 46,
    borderRadius: 8,
    backgroundColor: '#1c1c1e',
    color: 'white',
    paddingHorizontal: 12,
    fontSize: 16,
  },
  postError: { color: '#ff6b6b', fontSize: 14, marginTop: 8 },
  shareBtn: {
    height: 50,
    borderRadius: 8,
    backgroundColor: '#ff2d55',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  shareText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  noteText: {
    color: '#aaa',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});