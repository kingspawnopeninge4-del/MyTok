import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import type { SoundChoice } from '@/components/sound-picker';
import { useSoundSync } from '@/lib/use-sound-sync';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform, // NEW
  Pressable,
  ScrollView,
  Switch,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { getExt, mimeFor, readBytes } from '@/lib/media';
import { supabase } from '@/lib/supabase';

// CHANGED: Supabase free plan allows 50 MB per file, so stay a bit under it
const MAX_MB = 45;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const MAX_PICK_SECONDS = 180;
const DURATIONS = [15, 30, 60];
const THUMB_COUNT = 8;
const MAX_TAGS = 10;

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return m + ':' + (r < 10 ? '0' : '') + r;
}

// NEW: one place to clean a hashtag, used by Add and by Post
function cleanTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

function CameraStage({
  error,
  onRecorded,
  onRecording,
  onGallery,
  onClose,
}: {
  error: string;
  onRecorded: (uri: string) => void;
  onRecording: (r: boolean) => void;
  onGallery: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);

  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [torch, setTorch] = useState(false);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [maxSeconds, setMaxSeconds] = useState(60);
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

  const start = async () => {
    const cam = cameraRef.current;
    if (!cam || !ready || recording) {
      return;
    }
    startedAt.current = Date.now();
    setElapsed(0);
    setRecording(true);
    try {
      const result = await cam.recordAsync({ maxDuration: maxSeconds });
      if (result && result.uri) {
        onRecorded(result.uri);
      }
    } catch {
      Alert.alert('Recording failed', 'Could not record the video. Try again.');
    } finally {
      setRecording(false);
      setElapsed(0);
    }
  };

  const stop = () => {
    const cam = cameraRef.current;
    if (cam) {
      cam.stopRecording();
    }
  };

  const progress = Math.min(1, elapsed / maxSeconds);

  return (
    <View style={styles.black}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="video"
        enableTorch={torch && facing === 'back'}
        videoQuality="720p"
        videoBitrate={3000000}
        onCameraReady={() => setReady(true)}
      />

      <View
        pointerEvents="none"
        style={[styles.progressTrack, { top: insets.top + 6 }]}
      >
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={[styles.topRow, { top: insets.top + 18 }]}>
        <Pressable
          style={styles.roundBtn}
          onPress={onClose}
          disabled={recording}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="close" size={26} color="white" />
        </Pressable>
        {recording && (
          <View style={styles.timerBadge}>
            <View style={styles.redDot} />
            <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
          </View>
        )}
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
        {facing === 'back' && (
          <Pressable style={styles.tool} onPress={() => setTorch((t) => !t)}>
            <MaterialCommunityIcons
              name={torch ? 'flash' : 'flash-off'}
              size={30}
              color="white"
            />
            <Text style={styles.toolLabel}>Flash</Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 84 }]}>
        {!recording && (
          <View style={styles.durationRow}>
            {DURATIONS.map((d) => (
              <Pressable
                key={d}
                style={[
                  styles.durationChip,
                  maxSeconds === d && styles.durationChipActive,
                ]}
                onPress={() => setMaxSeconds(d)}
              >
                <Text
                  style={[
                    styles.durationText,
                    maxSeconds === d && styles.durationTextActive,
                  ]}
                >
                  {d}s
                </Text>
              </Pressable>
            ))}
          </View>
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
                <Text style={styles.toolLabel}>Upload</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            style={[styles.recordOuter, !ready && styles.disabled]}
            onPress={recording ? stop : start}
            disabled={!ready}
          >
            <View
              style={[
                styles.recordInner,
                recording && styles.recordInnerActive,
              ]}
            />
          </Pressable>

          <View style={styles.sideSlot} />
        </View>
      </View>
    </View>
  );
}

function PreviewStage({
  uri,
  sound,
  onDone,
  onDiscard,
}: {
  uri: string;
  sound: SoundChoice | null;
  onDone: () => void;
  onDiscard: () => void;
}) {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  useSoundSync(sound, player, false);

  const askDiscard = () => {
    Alert.alert('Discard video?', 'Your video will not be posted.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onDiscard },
    ]);
  };

  return (
    <View style={styles.black}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />

      <View style={[styles.topRow, { top: insets.top + 10 }]}>
        <Pressable style={styles.roundBtn} onPress={askDiscard} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={26} color="white" />
        </Pressable>
        <View style={styles.roundBtnSpace} />
        <View style={styles.roundBtnSpace} />
      </View>

      <View style={[styles.doneWrap, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable style={styles.doneBtn} onPress={onDone}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DetailsStage({
  uri,
  userId,
  sound,
  onBack,
  onPosted,
}: {
  uri: string;
  userId: string;
  sound: SoundChoice | null;
  onBack: () => void;
  onPosted: () => void;
}) {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(uri);

  const [thumbs, setThumbs] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [loadingThumbs, setLoadingThumbs] = useState(true);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [keepOriginal, setKeepOriginal] = useState(true);
  const [shareStatus, setShareStatus] = useState(false);

  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  // NEW: blocks a second Post tap before state has updated
  const postingRef = useRef(false);

  // Make cover choices from frames of the video itself
  useEffect(() => {
    let cancelled = false;
    let tries = 0;

    async function generate(seconds: number) {
      const made: string[] = [];
      for (let i = 0; i < THUMB_COUNT; i++) {
        if (cancelled) {
          return;
        }
        const ms = Math.max(
          0,
          Math.floor(((i + 0.5) / THUMB_COUNT) * seconds * 1000)
        );
        try {
          const t = await VideoThumbnails.getThumbnailAsync(uri, {
            time: ms,
            quality: 0.7,
          });
          made.push(t.uri);
          if (!cancelled) {
            setThumbs([...made]);
          }
        } catch {
          // skip a frame that can't be read
        }
      }
      if (!cancelled) {
        setLoadingThumbs(false);
      }
    }

    const timer = setInterval(() => {
      tries += 1;
      let d = 0;
      try {
        d = player.duration;
      } catch {
        d = 0;
      }
      if (d > 0 || tries > 25) {
        clearInterval(timer);
        generate(d > 0 ? d : 5);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [uri, player]);

  // CHANGED: uses cleanTag
  const addTag = () => {
    const clean = cleanTag(tagDraft);
    setTagDraft('');
    if (clean === '' || tags.includes(clean) || tags.length >= MAX_TAGS) {
      return;
    }
    setTags([...tags, clean]);
  };

  const removeTag = (t: string) => {
    setTags(tags.filter((x) => x !== t));
  };

  const post = async () => {
    // CHANGED: ref check stops double taps
    if (postingRef.current) {
      return;
    }

    // NEW: include a hashtag that was typed but never added
    const pending = cleanTag(tagDraft);
    const finalTags =
      pending !== '' && !tags.includes(pending) && tags.length < MAX_TAGS
        ? [...tags, pending]
        : tags;

    const cleanTitle = title.trim();
    if (cleanTitle === '') {
      setError('Add a title for your video.');
      return;
    }

    postingRef.current = true;
    setPosting(true);
    setError('');
    setTags(finalTags);
    setTagDraft('');

    const ext = getExt(uri);
    const mime = mimeFor(ext);
    const stamp = Date.now();
    const videoPath = userId + '/' + stamp + '.' + ext;
    const thumbPath = userId + '/' + stamp + '_cover.jpg';

    try {
      const bytes = await readBytes(uri);

      // NEW: final size check (free plan limit is 50 MB per file)
      if (bytes.byteLength > MAX_BYTES) {
        setError(
          'That video is over ' + MAX_MB + ' MB. Pick a smaller or shorter one.'
        );
        return;
      }

      const { error: upErr } = await supabase.storage
        .from('videos')
        .upload(videoPath, bytes, { contentType: mime });
      if (upErr) {
        setError('Upload failed: ' + upErr.message);
        return;
      }

      let thumbUrl: string | null = null;
      let uploadedThumb = false;
      const chosen = thumbs[selected];
      if (chosen) {
        try {
          const tb = await readBytes(chosen);
          const { error: thErr } = await supabase.storage
            .from('videos')
            .upload(thumbPath, tb, { contentType: 'image/jpeg' });
          if (!thErr) {
            uploadedThumb = true;
            thumbUrl = supabase.storage
              .from('videos')
              .getPublicUrl(thumbPath).data.publicUrl;
          }
        } catch {
          // post without a cover
        }
      }

      const { data: pub } = supabase.storage
        .from('videos')
        .getPublicUrl(videoPath);

      const caption = [cleanTitle, ...finalTags.map((t) => '#' + t)].join(' ');

      const { error: dbErr } = await supabase.from('videos').insert({
        user_id: userId,
        url: pub.publicUrl,
        caption,
        title: cleanTitle,
        description: description.trim(),
        hashtags: finalTags,
        thumbnail_url: thumbUrl,
        sound_id: sound ? sound.id : null,
        sound_start: sound ? sound.start : 0,
        sound_length: sound ? sound.length : 0,
        keep_original: sound ? keepOriginal : true,
      });
      if (dbErr) {
        const toRemove = uploadedThumb ? [videoPath, thumbPath] : [videoPath];
        await supabase.storage.from('videos').remove(toRemove);
        setError('Could not save the post: ' + dbErr.message);
        return;
      }

      if (shareStatus) {
        await supabase.from('statuses').insert({
          user_id: userId,
          media_url: pub.publicUrl,
          media_type: 'video',
          caption: cleanTitle.slice(0, 100),
        });
      }

      onPosted();
    } catch {
      setError('Something went wrong. Check your internet and try again.');
    } finally {
      postingRef.current = false;
      setPosting(false);
    }
  };

  const cover = thumbs[selected];

  return (
    <View style={styles.detailsRoot}>
      <View style={[styles.detailsHeader, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={styles.headerSlot}
          onPress={onBack}
          disabled={posting}
          hitSlop={10}
        >
          <MaterialCommunityIcons name="arrow-left" size={26} color="white" />
        </Pressable>
        <Text style={styles.detailsTitle}>Post details</Text>
        <View style={styles.headerSlot} />
      </View>

      {/* CHANGED: padding only on iOS */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.detailsContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>Cover</Text>
          <View style={styles.coverWrap}>
            {cover ? (
              <Image source={{ uri: cover }} style={styles.coverBig} />
            ) : (
              <View style={[styles.coverBig, styles.coverEmpty]}>
                {loadingThumbs ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.coverEmptyText}>No cover available</Text>
                )}
              </View>
            )}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbStrip}
          >
            {thumbs.map((t, i) => (
              <Pressable key={t} onPress={() => setSelected(i)}>
                <Image
                  source={{ uri: t }}
                  style={[
                    styles.thumb,
                    selected === i && styles.thumbSelected,
                  ]}
                />
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.sectionLabel}>Title</Text>
          <TextInput
            style={styles.field}
            placeholder="Give your video a title"
            placeholderTextColor="#777"
            maxLength={80}
            value={title}
            onChangeText={setTitle}
            editable={!posting}
          />
          <Text style={styles.counter}>{title.length}/80</Text>

          <Text style={styles.sectionLabel}>Description</Text>
          <TextInput
            style={[styles.field, styles.fieldMulti]}
            placeholder="Tell people what your video is about"
            placeholderTextColor="#777"
            multiline
            maxLength={500}
            value={description}
            onChangeText={setDescription}
            editable={!posting}
          />
          <Text style={styles.counter}>{description.length}/500</Text>

          <Text style={styles.sectionLabel}>Hashtags</Text>
          <View style={styles.tagInputRow}>
            <TextInput
              style={[styles.field, styles.tagInput]}
              placeholder="Type a hashtag"
              placeholderTextColor="#777"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
              value={tagDraft}
              onChangeText={setTagDraft}
              onSubmitEditing={addTag}
              returnKeyType="done"
              editable={!posting}
            />
            <Pressable style={styles.addTagBtn} onPress={addTag}>
              <Text style={styles.addTagText}>Add</Text>
            </Pressable>
          </View>
          <Text style={styles.counter}>
            {tags.length}/{MAX_TAGS} hashtags. Letters, numbers and _ only.
          </Text>
          <View style={styles.tagWrap}>
            {tags.map((t) => (
              <Pressable
                key={t}
                style={styles.tagChip}
                onPress={() => removeTag(t)}
              >
                <Text style={styles.tagChipText}>#{t}</Text>
                <MaterialCommunityIcons name="close" size={14} color="#aaa" />
              </Pressable>
            ))}
          </View>

          {sound && (
            <View style={styles.optionBox}>
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionTitle}>Keep original sound</Text>
                <Text style={styles.optionSub} numberOfLines={1}>
                  ♫ {sound.title}
                </Text>
              </View>
              <Switch
                value={keepOriginal}
                onValueChange={setKeepOriginal}
                trackColor={{ false: '#3a3a3c', true: '#ff2d55' }}
                thumbColor="white"
                disabled={posting}
              />
            </View>
          )}

          <View style={styles.optionBox}>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>Share to status</Text>
              <Text style={styles.optionSub}>Visible for 24 hours</Text>
            </View>
            <Switch
              value={shareStatus}
              onValueChange={setShareStatus}
              trackColor={{ false: '#3a3a3c', true: '#ff2d55' }}
              thumbColor="white"
              disabled={posting}
            />
          </View>
          {error !== '' && <Text style={styles.postError}>{error}</Text>}
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={[styles.postBtn, posting && styles.disabled]}
            onPress={post}
            disabled={posting}
          >
            {posting ? (
              <View style={styles.postingRow}>
                <ActivityIndicator color="white" />
                <Text style={styles.postText}>Posting...</Text>
              </View>
            ) : (
              <Text style={styles.postText}>Post</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function MytokFlow({
  sound,
  onIdle,
}: {
  sound: SoundChoice | null;
  onIdle: (idle: boolean) => void;
}) {
  const { session, bumpProfile } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [focused, setFocused] = useState(true);
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [step, setStep] = useState<'preview' | 'details'>('preview');
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(''); // CHANGED: moved up with the other state

  useEffect(() => {
    onIdle(videoUri === null && !recording);
  }, [videoUri, recording, onIdle]);

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

  const startWith = (uri: string) => {
    setError('');
    setStep('preview');
    setVideoUri(uri);
  };

  const pickFromGallery = async () => {
    setError('');
    try {
      await ImagePicker.requestMediaLibraryPermissionsAsync();

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled || result.assets.length === 0) {
        return;
      }
      const asset = result.assets[0];
      if (asset.duration && asset.duration > MAX_PICK_SECONDS * 1000) {
        setError('That video is longer than 3 minutes.');
        return;
      }
      if (asset.fileSize && asset.fileSize > MAX_BYTES) {
        setError(
          'That video is over ' + MAX_MB + ' MB. Pick a smaller or shorter one.'
        );
        return;
      }
      startWith(asset.uri);
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

  const closeButton = (
    <Pressable
      style={[styles.roundBtn, styles.closeAbsolute, { top: insets.top + 10 }]}
      onPress={close}
      hitSlop={8}
    >
      <MaterialCommunityIcons name="close" size={26} color="white" />
    </Pressable>
  );

  if (!session) {
    return (
      <View style={styles.centerScreen}>
        {closeButton}
        <MaterialCommunityIcons
          name="video-plus-outline"
          size={56}
          color="#666"
        />
        <Text style={styles.title}>Log in to upload</Text>
        <Text style={styles.sub}>
          Create an account or log in to post videos on MyTok.
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
    return <View style={styles.black} />;
  }

  if (videoUri) {
    if (step === 'details') {
      return (
        <DetailsStage
          key={'details-' + videoUri}
          uri={videoUri}
          userId={session.user.id}
          sound={sound}
          onBack={() => setStep('preview')}
          onPosted={() => {
            setVideoUri(null);
            setStep('preview');
            bumpProfile();
            Alert.alert('Posted!', 'Your video is now on your profile.');
            router.navigate('/profile');
          }}
        />
      );
    }
    return (
      <PreviewStage
        key={'preview-' + videoUri}
        uri={videoUri}
        sound={sound}
        onDone={() => setStep('details')}
        onDiscard={() => setVideoUri(null)}
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
        {closeButton}
        <MaterialCommunityIcons name="camera-outline" size={56} color="#666" />
        <Text style={styles.title}>Allow camera and microphone</Text>
        <Text style={styles.sub}>
          MyTok needs your camera to record video and your microphone to record
          sound.
        </Text>
        {error !== '' && <Text style={styles.errorPlain}>{error}</Text>}
        <Pressable style={styles.primaryBtn} onPress={allowAccess}>
          <Text style={styles.primaryText}>
            {blocked ? 'Open settings' : 'Allow access'}
          </Text>
        </Pressable>
        <Pressable style={styles.outlineBtn} onPress={pickFromGallery}>
          <Text style={styles.outlineText}>Upload from gallery instead</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <CameraStage
      error={error}
      onRecorded={startWith}
      onRecording={setRecording}
      onGallery={pickFromGallery}
      onClose={close}
    />
  );
}

const styles = StyleSheet.create({
  optionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#1c1c1e',
  },
  optionTextWrap: { flex: 1 },
  optionTitle: { color: 'white', fontSize: 16, fontWeight: '600' },
  optionSub: { color: '#888', fontSize: 13, marginTop: 2 },
  flex: {
    flex: 1,
  },
  black: {
    flex: 1,
    backgroundColor: 'black',
  },
  centerScreen: {
    flex: 1,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  closeAbsolute: {
    position: 'absolute',
    left: 16,
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
  primaryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
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
  outlineText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  progressTrack: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: '#ff2d55',
  },
  topRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtnSpace: {
    width: 40,
    height: 40,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff2d55',
  },
  timerText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  errorBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    textAlign: 'center',
  },
  tools: {
    position: 'absolute',
    right: 14,
    alignItems: 'center',
    gap: 18,
  },
  tool: {
    alignItems: 'center',
  },
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
  durationRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  durationChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  durationChipActive: {
    backgroundColor: 'white',
  },
  durationText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  durationTextActive: {
    color: 'black',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: 24,
  },
  sideSlot: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryBtn: {
    alignItems: 'center',
  },
  recordOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 5,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#ff2d55',
  },
  recordInnerActive: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  doneWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
  },
  doneBtn: {
    height: 52,
    borderRadius: 8,
    backgroundColor: '#ff2d55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  detailsRoot: {
    flex: 1,
    backgroundColor: 'black',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2c2c2e',
  },
  headerSlot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  detailsContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionLabel: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  coverWrap: {
    alignItems: 'center',
  },
  coverBig: {
    width: 150,
    height: 266,
    borderRadius: 10,
    backgroundColor: '#1c1c1e',
  },
  coverEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmptyText: {
    color: '#888',
    fontSize: 13,
  },
  thumbStrip: {
    gap: 8,
    paddingTop: 12,
  },
  thumb: {
    width: 54,
    height: 96,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#1c1c1e',
  },
  thumbSelected: {
    borderColor: '#ff2d55',
  },
  field: {
    borderRadius: 8,
    backgroundColor: '#1c1c1e',
    color: 'white',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  fieldMulti: {
    minHeight: 100,
    maxHeight: 180,
    textAlignVertical: 'top',
  },
  counter: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  tagInput: {
    flex: 1,
  },
  addTagBtn: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTagText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#1c1c1e',
  },
  tagChipText: {
    color: '#3ea6ff',
    fontSize: 14,
    fontWeight: '600',
  },
  postError: {
    color: '#ff6b6b',
    fontSize: 14,
    marginTop: 16,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2c2c2e',
    backgroundColor: 'black',
  },
  postBtn: {
    height: 50,
    borderRadius: 8,
    backgroundColor: '#ff2d55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  postText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});