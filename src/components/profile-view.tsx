import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import PostViewer, { PostRow } from '@/components/post-viewer';
import StatusViewer, { StatusItem } from '@/components/status-viewer';
import VideoViewer, { ViewerVideo } from '@/components/video-viewer';
import { useAuth } from '@/lib/auth';
import { uploadAvatar } from '@/lib/avatar';
import { formatCount } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Colors, useTheme } from '@/lib/theme';

type ProfileRow = {
  username: string;
  bio: string;
  avatar_url: string | null;
};

type VideoRow = ViewerVideo & {
  thumbnail_url: string | null;
  created_at: string;
};

type SoundJoin = { title: string; url: string };

type RawVideo = {
  id: string;
  url: string;
  caption: string;
  title: string;
  description: string;
  hashtags: string[];
  thumbnail_url: string | null;
  views: number;
  shares: number;
  created_at: string;
  keep_original: boolean;
  sound_start: number;
  sound_length: number;
  sounds: SoundJoin | SoundJoin[] | null;
};

type GridItem =
  | { kind: 'video'; at: string; v: VideoRow }
  | { kind: 'post'; at: string; p: PostRow };

const VIDEO_FIELDS =
  'id,url,caption,title,description,hashtags,thumbnail_url,views,shares,created_at,keep_original,sound_start,sound_length,sounds(title,url)';

function toVideo(r: RawVideo): VideoRow {
  const snd = Array.isArray(r.sounds) ? r.sounds[0] : r.sounds;
  return {
    id: r.id,
    url: r.url,
    caption: r.caption,
    title: r.title,
    description: r.description,
    hashtags: r.hashtags,
    thumbnail_url: r.thumbnail_url,
    views: r.views,
    shares: r.shares,
    created_at: r.created_at,
    keep_original: r.keep_original,
    sound: snd
      ? {
          title: snd.title,
          url: snd.url,
          start: r.sound_start,
          length: r.sound_length,
        }
      : null,
  };
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { paddingBottom: 40 },
    top: { alignItems: 'center', paddingTop: 16, paddingHorizontal: 20 },
    ring: {
      padding: 3,
      borderWidth: 3,
      borderColor: 'transparent',
      borderRadius: 56,
    },
    ringActive: { borderColor: c.accent },
    avatar: { width: 100, height: 100, borderRadius: 50 },
    avatarEmpty: {
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarLetter: { color: c.text, fontSize: 40, fontWeight: 'bold' },
    cameraBadge: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    username: {
      color: c.text,
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 12,
    },
    statsRow: { flexDirection: 'row', marginTop: 18, gap: 36 },
    stat: { alignItems: 'center' },
    statNumber: { color: c.text, fontSize: 18, fontWeight: 'bold' },
    statLabel: { color: c.subtext, fontSize: 13, marginTop: 2 },
    editWrap: { alignSelf: 'stretch', alignItems: 'center', marginTop: 16 },
    bio: {
      color: c.text,
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 21,
    },
    bioInput: {
      alignSelf: 'stretch',
      minHeight: 80,
      borderRadius: 8,
      backgroundColor: c.surface,
      color: c.text,
      padding: 12,
      fontSize: 15,
      textAlignVertical: 'top',
    },
    buttonRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
    smallBtn: {
      minWidth: 120,
      height: 40,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    cancelBtn: { backgroundColor: c.surfaceAlt },
    cancelText: { color: c.text, fontWeight: '600', fontSize: 15 },
    saveBtn: { backgroundColor: c.accent },
    saveText: { color: 'white', fontWeight: '600', fontSize: 15 },
    disabled: { opacity: 0.6 },
    error: { color: '#ff6b6b', marginTop: 10, fontSize: 14 },
    tabBar: {
      marginTop: 24,
      paddingVertical: 12,
      alignItems: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    emptyWrap: { alignItems: 'center', paddingTop: 40 },
    emptyTitle: {
      color: c.text,
      fontSize: 16,
      fontWeight: '600',
      marginTop: 10,
    },
    emptySub: { color: c.subtext, fontSize: 14, marginTop: 4 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    tileOuter: { width: '33.3333%', padding: 1 },
    tile: {
      aspectRatio: 9 / 16,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    tileImage: { ...StyleSheet.absoluteFill },
    tileFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 6,
    },
    tileCaption: {
      color: c.subtext,
      fontSize: 11,
      marginTop: 6,
      textAlign: 'center',
    },
    tileViews: {
      position: 'absolute',
      left: 6,
      bottom: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    tileViewsText: {
      color: 'white',
      fontSize: 13,
      fontWeight: '700',
      textShadowColor: 'rgba(0,0,0,0.8)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    tileBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      textShadowColor: 'rgba(0,0,0,0.8)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
  });
}

export default function ProfileView({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const { profileVersion, bumpProfile } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [openedVideo, setOpenedVideo] = useState<VideoRow | null>(null);
  const [openedPost, setOpenedPost] = useState<PostRow | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);

  const [editing, setEditing] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [newUri, setNewUri] = useState<string | null>(null);
  const [newB64, setNewB64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = async (): Promise<void> => {
    try {
      const [p, fr, fg, v, po, st] = await Promise.all([
        supabase
          .from('profiles')
          .select('username,bio,avatar_url')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', userId),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', userId),
        supabase
          .from('videos')
          .select(VIDEO_FIELDS)
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('posts')
          .select('id,title,description,hashtags,image_urls,created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('statuses')
          .select('id,media_url,media_type,caption,created_at')
          .eq('user_id', userId)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: true }),
      ]);
      setProfile(p.data ?? null);
      setFollowers(fr.count ?? 0);
      setFollowing(fg.count ?? 0);
      setVideos(((v.data ?? []) as unknown as RawVideo[]).map(toVideo));
      setPosts((po.data ?? []) as PostRow[]);
      setStatuses((st.data ?? []) as StatusItem[]);
    } catch {
      // keep whatever we have
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId, profileVersion]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const closeVideo = () => {
    setOpenedVideo(null);
    loadData();
  };

  const startEdit = () => {
    setBioDraft(profile ? profile.bio : '');
    setNewUri(null);
    setNewB64(null);
    setError('');
    setEditing(true);
  };

  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setNewUri(asset.uri);
        setNewB64(asset.base64 ?? null);
      }
    } catch {
      setError('Could not open your photos.');
    }
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const changes: { bio: string; avatar_url?: string } = {
        bio: bioDraft.trim(),
      };
      if (newB64) {
        const url = await uploadAvatar(userId, newB64);
        if (!url) {
          setError('Could not upload the photo.');
          return;
        }
        changes.avatar_url = url;
      }
      const { error: err } = await supabase
        .from('profiles')
        .update(changes)
        .eq('id', userId);
      if (err) {
        setError(err.message);
        return;
      }
      setEditing(false);
      bumpProfile();
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  const name = profile ? profile.username : email.split('@')[0];
  const shownAvatar = newUri ?? (profile ? profile.avatar_url : null);
  const hasStatus = statuses.length > 0;

  const items: GridItem[] = [
    ...videos.map((v) => ({ kind: 'video' as const, at: v.created_at, v })),
    ...posts.map((p) => ({ kind: 'post' as const, at: p.created_at, p })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
          />
        }
      >
        <View style={s.top}>
          <Pressable
            onPress={
              editing
                ? pickPhoto
                : hasStatus
                  ? () => setStatusOpen(true)
                  : undefined
            }
            disabled={!editing && !hasStatus}
          >
            <View
              style={[s.ring, hasStatus && !editing && s.ringActive]}
            >
              {shownAvatar ? (
                <Image source={{ uri: shownAvatar }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.avatarEmpty]}>
                  <Text style={s.avatarLetter}>
                    {name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            {editing && (
              <View style={s.cameraBadge}>
                <MaterialCommunityIcons name="camera" size={16} color="white" />
              </View>
            )}
          </Pressable>

          <Text style={s.username}>@{name}</Text>

          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statNumber}>{following}</Text>
              <Text style={s.statLabel}>Following</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statNumber}>{followers}</Text>
              <Text style={s.statLabel}>Followers</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statNumber}>{items.length}</Text>
              <Text style={s.statLabel}>Posts</Text>
            </View>
          </View>

          {editing ? (
            <View style={s.editWrap}>
              <TextInput
                style={s.bioInput}
                placeholder="Write a short bio"
                placeholderTextColor="#777"
                multiline
                maxLength={150}
                value={bioDraft}
                onChangeText={setBioDraft}
              />
              {error !== '' && <Text style={s.error}>{error}</Text>}
              <View style={s.buttonRow}>
                <Pressable
                  style={[s.smallBtn, s.cancelBtn]}
                  onPress={() => setEditing(false)}
                  disabled={saving}
                >
                  <Text style={s.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[s.smallBtn, s.saveBtn, saving && s.disabled]}
                  onPress={save}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={s.saveText}>Save</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={s.editWrap}>
              <Text style={s.bio}>
                {profile && profile.bio !== '' ? profile.bio : 'No bio yet.'}
              </Text>
              <View style={s.buttonRow}>
                <Pressable
                  style={[s.smallBtn, s.cancelBtn]}
                  onPress={startEdit}
                >
                  <Text style={s.cancelText}>Edit profile</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <View style={s.tabBar}>
          <MaterialCommunityIcons
            name="view-grid-outline"
            size={24}
            color={colors.text}
          />
        </View>

        {items.length === 0 ? (
          <View style={s.emptyWrap}>
            <MaterialCommunityIcons
              name="video-outline"
              size={44}
              color="#888"
            />
            <Text style={s.emptyTitle}>No posts yet</Text>
            <Text style={s.emptySub}>
              Videos and photos you post will show up here.
            </Text>
          </View>
        ) : (
          <View style={s.grid}>
            {items.map((it) =>
              it.kind === 'video' ? (
                <View key={'v' + it.v.id} style={s.tileOuter}>
                  <Pressable
                    style={s.tile}
                    onPress={() => setOpenedVideo(it.v)}
                  >
                    {it.v.thumbnail_url ? (
                      <Image
                        source={{ uri: it.v.thumbnail_url }}
                        style={s.tileImage}
                      />
                    ) : (
                      <View style={s.tileFallback}>
                        <MaterialCommunityIcons
                          name="play"
                          size={30}
                          color={colors.text}
                        />
                        <Text style={s.tileCaption} numberOfLines={2}>
                          {it.v.title !== '' ? it.v.title : it.v.caption}
                        </Text>
                      </View>
                    )}
                    <View style={s.tileViews}>
                      <MaterialCommunityIcons
                        name="play-outline"
                        size={16}
                        color="white"
                      />
                      <Text style={s.tileViewsText}>
                        {formatCount(it.v.views)}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              ) : (
                <View key={'p' + it.p.id} style={s.tileOuter}>
                  <Pressable
                    style={s.tile}
                    onPress={() => setOpenedPost(it.p)}
                  >
                    <Image
                      source={{ uri: it.p.image_urls[0] }}
                      style={s.tileImage}
                    />
                    <MaterialCommunityIcons
                      name={
                        it.p.image_urls.length > 1
                          ? 'image-multiple'
                          : 'image'
                      }
                      size={18}
                      color="white"
                      style={s.tileBadge}
                    />
                  </Pressable>
                </View>
              )
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={openedVideo !== null}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeVideo}
      >
        {openedVideo && (
          <VideoViewer
            video={openedVideo}
            owner={{
              id: userId,
              username: name,
              avatar_url: profile ? profile.avatar_url : null,
            }}
            onClose={closeVideo}
          />
        )}
      </Modal>

      <Modal
        visible={openedPost !== null}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setOpenedPost(null)}
      >
        {openedPost && (
          <PostViewer
            post={openedPost}
            username={name}
            onClose={() => setOpenedPost(null)}
          />
        )}
      </Modal>

      <Modal
        visible={statusOpen && hasStatus}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setStatusOpen(false)}
      >
        {statusOpen && hasStatus && (
          <StatusViewer
            username={name}
            avatarUrl={profile ? profile.avatar_url : null}
            items={statuses}
            canDelete
            onClose={() => setStatusOpen(false)}
            onDeleted={() => {
              setStatusOpen(false);
              loadData();
            }}
          />
        )}
      </Modal>
    </>
  );
}