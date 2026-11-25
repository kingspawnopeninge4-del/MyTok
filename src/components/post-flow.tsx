import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { getImageExt, imageMime, readBytes } from '@/lib/media';
import { supabase } from '@/lib/supabase';

const MAX_IMAGES = 10;
const MAX_TAGS = 10;

export default function PostFlow({
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

  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [shareStatus, setShareStatus] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    onIdle(images.length === 0);
  }, [images.length, onIdle]);

  const pickImages = async () => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setError('You can add up to 10 photos.');
      return;
    }
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.8,
      });
      if (result.canceled || result.assets.length === 0) {
        return;
      }
      const uris = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...uris].slice(0, MAX_IMAGES));
    } catch {
      setError('Could not open your gallery.');
    }
  };

  const takePhoto = async () => {
    if (images.length >= MAX_IMAGES) {
      setError('You can add up to 10 photos.');
      return;
    }
    setError('');
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError('Allow camera access in your phone settings to take photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || result.assets.length === 0) {
        return;
      }
      setImages((prev) => [...prev, result.assets[0].uri].slice(0, MAX_IMAGES));
    } catch {
      setError('Could not open the camera.');
    }
  };

  const removeImage = (i: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
  };

  const askDiscard = () => {
    Alert.alert('Discard post?', 'Your photos and details will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          setImages([]);
          setTitle('');
          setDescription('');
          setTags([]);
          setShareStatus(false);
          setError('');
        },
      },
    ]);
  };

  const addTag = () => {
    const clean = tagDraft
      .trim()
      .replace(/^#+/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');
    setTagDraft('');
    if (clean === '' || tags.includes(clean) || tags.length >= MAX_TAGS) {
      return;
    }
    setTags([...tags, clean]);
  };

  const post = async () => {
    if (posting) {
      return;
    }
    const cleanTitle = title.trim();
    if (images.length === 0) {
      setError('Add at least one photo.');
      return;
    }
    if (cleanTitle === '') {
      setError('Add a title for your post.');
      return;
    }
    setPosting(true);
    setError('');

    const stamp = Date.now();
    const paths: string[] = [];
    const urls: string[] = [];

    try {
      for (let i = 0; i < images.length; i++) {
        const uri = images[i];
        const ext = getImageExt(uri);
        const path = userId + '/post_' + stamp + '_' + i + '.' + ext;
        const bytes = await readBytes(uri);
        const { error: upErr } = await supabase.storage
          .from('videos')
          .upload(path, bytes, { contentType: imageMime(ext) });
        if (upErr) {
          await supabase.storage.from('videos').remove(paths);
          setError('Upload failed: ' + upErr.message);
          return;
        }
        paths.push(path);
        urls.push(supabase.storage.from('videos').getPublicUrl(path).data.publicUrl);
      }

      const { error: dbErr } = await supabase.from('posts').insert({
        user_id: userId,
        title: cleanTitle,
        description: description.trim(),
        hashtags: tags,
        image_urls: urls,
      });
      if (dbErr) {
        await supabase.storage.from('videos').remove(paths);
        setError('Could not save the post: ' + dbErr.message);
        return;
      }

      if (shareStatus) {
        await supabase.from('statuses').insert({
          user_id: userId,
          media_url: urls[0],
          media_type: 'image',
          caption: cleanTitle.slice(0, 100),
        });
      }

      setImages([]);
      setTitle('');
      setDescription('');
      setTags([]);
      setShareStatus(false);
      bumpProfile();
      Alert.alert('Posted!', 'Your post is now on your profile.');
      router.navigate('/profile');
    } catch {
      if (paths.length > 0) {
        await supabase.storage.from('videos').remove(paths);
      }
      setError('Something went wrong. Check your internet and try again.');
    } finally {
      setPosting(false);
    }
  };

  if (images.length === 0) {
    return (
      <View style={styles.centerScreen}>
        <Pressable
          style={[styles.closeAbs, { top: insets.top + 10 }]}
          onPress={onClose}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="close" size={26} color="white" />
        </Pressable>
        <MaterialCommunityIcons
          name="image-multiple-outline"
          size={56}
          color="#666"
        />
        <Text style={styles.title}>Create a post</Text>
        <Text style={styles.sub}>Add 1 to 10 photos, then a title.</Text>
        {error !== '' && <Text style={styles.errorPlain}>{error}</Text>}
        <Pressable style={styles.primaryBtn} onPress={pickImages}>
          <Text style={styles.primaryText}>Choose from gallery</Text>
        </Pressable>
        <Pressable style={styles.outlineBtn} onPress={takePhoto}>
          <Text style={styles.outlineText}>Take a photo</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={styles.headerSlot}
          onPress={askDiscard}
          disabled={posting}
          hitSlop={10}
        >
          <MaterialCommunityIcons name="arrow-left" size={26} color="white" />
        </Pressable>
        <Text style={styles.headerTitle}>New post</Text>
        <View style={styles.headerSlot} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>
            Photos ({images.length}/{MAX_IMAGES})
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
          >
            {images.map((uri, i) => (
              <View key={uri + i} style={styles.thumbWrap}>
                <Image source={{ uri }} style={styles.thumb} />
                {i === 0 && (
                  <View style={styles.coverTag}>
                    <Text style={styles.coverTagText}>Cover</Text>
                  </View>
                )}
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => removeImage(i)}
                  disabled={posting}
                  hitSlop={6}
                >
                  <MaterialCommunityIcons name="close" size={14} color="white" />
                </Pressable>
              </View>
            ))}
            {images.length < MAX_IMAGES && (
              <View style={styles.addCol}>
                <Pressable style={styles.addTile} onPress={pickImages}>
                  <MaterialCommunityIcons name="plus" size={26} color="white" />
                  <Text style={styles.addText}>Gallery</Text>
                </Pressable>
                <Pressable style={styles.addTileSmall} onPress={takePhoto}>
                  <MaterialCommunityIcons
                    name="camera-outline"
                    size={22}
                    color="white"
                  />
                </Pressable>
              </View>
            )}
          </ScrollView>

          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.field}
            placeholder="Give your post a title"
            placeholderTextColor="#777"
            maxLength={80}
            value={title}
            onChangeText={setTitle}
            editable={!posting}
          />
          <Text style={styles.counter}>{title.length}/80</Text>

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.field, styles.fieldMulti]}
            placeholder="Tell people what your post is about"
            placeholderTextColor="#777"
            multiline
            maxLength={500}
            value={description}
            onChangeText={setDescription}
            editable={!posting}
          />
          <Text style={styles.counter}>{description.length}/500</Text>

          <Text style={styles.label}>Hashtags (optional)</Text>
          <View style={styles.tagInputRow}>
            <TextInput
              style={[styles.field, styles.flex]}
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
          <View style={styles.tagWrap}>
            {tags.map((t) => (
              <Pressable
                key={t}
                style={styles.tagChip}
                onPress={() => setTags(tags.filter((x) => x !== t))}
              >
                <Text style={styles.tagChipText}>#{t}</Text>
                <MaterialCommunityIcons name="close" size={14} color="#aaa" />
              </Pressable>
            ))}
          </View>

          <View style={styles.optionRow}>
            <View style={styles.flex}>
              <Text style={styles.optionLabel}>Share to status</Text>
              <Text style={styles.optionSub}>
                Your first photo shows in your status for 24 hours.
              </Text>
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  header: {
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
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  label: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  strip: { gap: 8, paddingTop: 4, paddingRight: 8 },
  thumbWrap: { width: 90, height: 120 },
  thumb: {
    width: 90,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#1c1c1e',
  },
  coverTag: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  coverTagText: { color: 'white', fontSize: 11, fontWeight: '600' },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCol: { gap: 8 },
  addTile: {
    width: 90,
    height: 78,
    borderRadius: 8,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTileSmall: {
    width: 90,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { color: 'white', fontSize: 12, marginTop: 2 },
  field: {
    borderRadius: 8,
    backgroundColor: '#1c1c1e',
    color: 'white',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  fieldMulti: { minHeight: 100, maxHeight: 180, textAlignVertical: 'top' },
  counter: { color: '#888', fontSize: 12, marginTop: 4 },
  tagInputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  addTagBtn: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTagText: { color: 'white', fontWeight: '600', fontSize: 15 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#1c1c1e',
  },
  tagChipText: { color: '#3ea6ff', fontSize: 14, fontWeight: '600' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#1c1c1e',
  },
  optionLabel: { color: 'white', fontSize: 16, fontWeight: '600' },
  optionSub: { color: '#888', fontSize: 13, marginTop: 2 },
  postError: { color: '#ff6b6b', fontSize: 14, marginTop: 16 },
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
  postingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  postText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});