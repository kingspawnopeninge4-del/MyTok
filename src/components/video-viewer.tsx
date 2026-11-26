import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ComponentProps, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { formatCount } from '@/lib/format';
import { setRemix } from '@/lib/remix';
import { supabase } from '@/lib/supabase';
import { useSoundSync } from '@/lib/use-sound-sync';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type Reaction = 'like' | 'dislike' | null;
type Panel = 'none' | 'comments' | 'menu' | 'speed';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const COMMENT_FIELDS = 'id,body,created_at,profiles(username,avatar_url)';

export type ViewerVideo = {
  id: string;
  url: string;
  caption: string;
  title: string;
  description: string;
  hashtags: string[];
  views: number;
  shares: number;
  keep_original?: boolean;
  sound?: { title: string; url: string; start: number; length: number } | null;
};

export type ViewerOwner = {
  id: string;
  username: string;
  avatar_url: string | null;
};

type CommentRow = {
  id: string;
  body: string;
  username: string;
  avatar_url: string | null;
};

type RawComment = {
  id: string;
  body: string;
  profiles:
    | { username: string; avatar_url: string | null }
    | { username: string; avatar_url: string | null }[]
    | null;
};

function toComment(r: RawComment): CommentRow {
  const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
  return {
    id: r.id,
    body: r.body,
    username: p ? p.username : 'user',
    avatar_url: p ? p.avatar_url : null,
  };
}

function speedLabel(s: number): string {
  return s === 1 ? 'Normal' : s + 'x';
}

function Avatar({
  name,
  url,
  size,
}: {
  name: string;
  url: string | null;
  size: number;
}) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (url) {
    return <Image source={{ uri: url }} style={box} />;
  }
  return (
    <View style={[box, styles.avatarEmpty]}>
      <Text style={[styles.avatarLetter, { fontSize: size * 0.42 }]}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  value,
  right,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  right?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={24} color="white" />
      <Text style={styles.menuLabel}>{label}</Text>
      {value !== undefined && <Text style={styles.menuValue}>{value}</Text>}
      {right}
    </Pressable>
  );
}

export default function VideoViewer({
  video,
  owner,
  onClose,
  isActive = true,
  feed = false,
}: {
  video: ViewerVideo;
  owner: ViewerOwner;
  onClose?: () => void;
  isActive?: boolean;
  feed?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { session } = useAuth();
  const me = session ? session.user.id : null;
  const isOwner = me !== null && me === owner.id;

  const player = useVideoPlayer(video.url, (p) => {
    p.loop = true;
    if (isActive) {
      p.play();
    }
  });

  const [views, setViews] = useState(video.views);
  const [likes, setLikes] = useState(0);
  const [reaction, setReaction] = useState<Reaction>(null);
  const [commentCount, setCommentCount] = useState(0);
  const [shares, setShares] = useState(video.shares);
  const [reposts, setReposts] = useState(0);
  const [reposted, setReposted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);

  const [paused, setPaused] = useState(false);
  const [fast, setFast] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);
  const [muted, setMuted] = useState(false);
  const [panel, setPanel] = useState<Panel>('none');

  useSoundSync(video.sound, player, paused || !isActive, muted);

  useEffect(() => {
    if (isActive) {
      player.play();
      setPaused(false);
    } else {
      player.pause();
      player.currentTime = 0;
    }
  }, [isActive, player]);

  const [comments, setComments] = useState<CommentRow[]>([]);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const popOpacity = useRef(new Animated.Value(0)).current;
  const popScale = useRef(new Animated.Value(0.3)).current;
  const counted = useRef(false);
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    player.loop = loop;
  }, [loop, player]);

  const originalMuted = muted || video.keep_original === false;
  useEffect(() => {
    player.muted = originalMuted;
  }, [originalMuted, player]);

  useEffect(() => {
    if (!fast) {
      player.playbackRate = speed;
    }
  }, [speed, fast, player]);

  useEffect(() => {
    const id = setInterval(() => {
      try {
        const d = player.duration;
        if (d > 0) {
          setProgress(Math.min(1, player.currentTime / d));
        }
      } catch {
        // player not ready yet
      }
    }, 200);
    return () => clearInterval(id);
  }, [player]);

  useEffect(() => {
    return () => {
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
      }
    };
  }, []);

  // Count one view when the video is opened
  useEffect(() => {
    let cancelled = false;
    async function countView() {
      try {
        const { error } = await supabase.rpc('increment_views', {
          video_id: video.id,
        });
        if (!cancelled && !error) {
          setViews((v) => v + 1);
        }
      } catch {
        // the view just isn't counted
      }
    }
    if (isActive && !counted.current) {
      counted.current = true;
      countView();
    }
    return () => {
      cancelled = true;
    };
  }, [video.id, isActive]);

  // Load the real numbers for this video
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const l = await supabase
          .from('video_reactions')
          .select('*', { count: 'exact', head: true })
          .eq('video_id', video.id)
          .eq('kind', 'like');
        const c = await supabase
          .from('video_comments')
          .select('*', { count: 'exact', head: true })
          .eq('video_id', video.id);
        const rp = await supabase
          .from('video_reposts')
          .select('*', { count: 'exact', head: true })
          .eq('video_id', video.id);
        if (cancelled) {
          return;
        }
        setLikes(l.count ?? 0);
        setCommentCount(c.count ?? 0);
        setReposts(rp.count ?? 0);

        if (me) {
          const r = await supabase
            .from('video_reactions')
            .select('kind')
            .eq('video_id', video.id)
            .eq('user_id', me)
            .maybeSingle();
          const sv = await supabase
            .from('saved_videos')
            .select('video_id')
            .eq('video_id', video.id)
            .eq('user_id', me)
            .maybeSingle();
          const mine = await supabase
            .from('video_reposts')
            .select('video_id')
            .eq('video_id', video.id)
            .eq('user_id', me)
            .maybeSingle();
          if (cancelled) {
            return;
          }
          setReaction(r.data ? (r.data.kind as Reaction) : null);
          setSaved(sv.data !== null);
          setReposted(mine.data !== null);

          if (owner.id !== me) {
            const f = await supabase
              .from('follows')
              .select('follower_id')
              .eq('follower_id', me)
              .eq('following_id', owner.id)
              .maybeSingle();
            if (!cancelled) {
              setFollowing(f.data !== null);
            }
          }
        }
      } catch {
        // keep what we have
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [video.id, me, owner.id]);

  const needLogin = (): boolean => {
    if (me) {
      return false;
    }
    Alert.alert(
      'Log in to MyTok',
      'You need to be logged in to like, comment, save or follow.'
    );
    return true;
  };

  const applyReaction = async (next: Reaction) => {
    if (!me) {
      return;
    }
    const prev = reaction;
    setReaction(next);
    setLikes(
      (l) => l + (next === 'like' ? 1 : 0) - (prev === 'like' ? 1 : 0)
    );
    try {
      const res =
        next === null
          ? await supabase
              .from('video_reactions')
              .delete()
              .eq('video_id', video.id)
              .eq('user_id', me)
          : await supabase
              .from('video_reactions')
              .upsert(
                { video_id: video.id, user_id: me, kind: next },
                { onConflict: 'video_id,user_id' }
              );
      if (res.error) {
        throw res.error;
      }
    } catch {
      setReaction(prev);
      setLikes(
        (l) => l - (next === 'like' ? 1 : 0) + (prev === 'like' ? 1 : 0)
      );
    }
  };

  const onLike = () => {
    if (needLogin()) {
      return;
    }
    applyReaction(reaction === 'like' ? null : 'like');
  };

  const onDislike = () => {
    if (needLogin()) {
      return;
    }
    applyReaction(reaction === 'dislike' ? null : 'dislike');
  };

  const toggleSave = async () => {
    if (needLogin() || !me) {
      return;
    }
    const next = !saved;
    setSaved(next);
    try {
      const res = next
        ? await supabase
            .from('saved_videos')
            .insert({ video_id: video.id, user_id: me })
        : await supabase
            .from('saved_videos')
            .delete()
            .eq('video_id', video.id)
            .eq('user_id', me);
      if (res.error) {
        throw res.error;
      }
    } catch {
      setSaved(!next);
    }
  };

  const toggleRepost = async () => {
    if (needLogin() || !me) {
      return;
    }
    const next = !reposted;
    setReposted(next);
    setReposts((n) => n + (next ? 1 : -1));
    try {
      const res = next
        ? await supabase
            .from('video_reposts')
            .insert({ video_id: video.id, user_id: me })
        : await supabase
            .from('video_reposts')
            .delete()
            .eq('video_id', video.id)
            .eq('user_id', me);
      if (res.error) {
        throw res.error;
      }
    } catch {
      setReposted(!next);
      setReposts((n) => n + (next ? -1 : 1));
    }
  };

  const toggleFollow = async () => {
    if (needLogin() || !me || isOwner) {
      return;
    }
    const next = !following;
    setFollowing(next);
    try {
      const res = next
        ? await supabase
            .from('follows')
            .insert({ follower_id: me, following_id: owner.id })
        : await supabase
            .from('follows')
            .delete()
            .eq('follower_id', me)
            .eq('following_id', owner.id);
      if (res.error) {
        throw res.error;
      }
    } catch {
      setFollowing(!next);
    }
  };

  const remixSound = () => {
    setPanel('none');
    if (needLogin()) {
      return;
    }
    if (!video.sound) {
      Alert.alert('No sound', 'This video has no sound you can use.');
      return;
    }
    setRemix({
      videoId: video.id,
      username: owner.username,
      sound: video.sound,
    });
    player.pause();
    router.navigate('/upload');
  };

  const doShare = async () => {
    try {
      const result = await Share.share({
        message: `Check out @${owner.username} on MyTok: ${video.url}`,
      });
      if (result.action === Share.sharedAction) {
        const { error } = await supabase.rpc('increment_shares', {
          video_id: video.id,
        });
        if (!error) {
          setShares((n) => n + 1);
        }
      }
    } catch {
      // sharing was cancelled or failed
    }
  };

  const openComments = async () => {
    setPanel('comments');
    try {
      const { data } = await supabase
        .from('video_comments')
        .select(COMMENT_FIELDS)
        .eq('video_id', video.id)
        .order('created_at', { ascending: false })
        .limit(100);
      const raw = (data ?? []) as unknown as RawComment[];
      setComments(raw.map(toComment));
      setCommentCount(raw.length);
    } catch {
      // keep what we have
    }
  };

  const postComment = async () => {
    const text = draft.trim();
    if (text === '' || posting) {
      return;
    }
    if (needLogin() || !me) {
      return;
    }
    setPosting(true);
    try {
      const { data, error } = await supabase
        .from('video_comments')
        .insert({ video_id: video.id, user_id: me, body: text })
        .select(COMMENT_FIELDS)
        .single();
      if (error || !data) {
        Alert.alert('Could not post', 'Please try again.');
        return;
      }
      setComments((prev) => [toComment(data as unknown as RawComment), ...prev]);
      setCommentCount((n) => n + 1);
      setDraft('');
    } catch {
      Alert.alert('Could not post', 'Check your internet and try again.');
    } finally {
      setPosting(false);
    }
  };

  const report = () => {
    setPanel('none');
    Alert.alert(
      'Report',
      'Thanks for letting us know. Reports are not reviewed yet, because moderation is not built.'
    );
  };

  const togglePlay = () => {
    if (player.playing) {
      player.pause();
      setPaused(true);
    } else {
      player.play();
      setPaused(false);
    }
  };

  const popLike = () => {
    popOpacity.setValue(1);
    popScale.setValue(0.3);
    Animated.sequence([
      Animated.spring(popScale, { toValue: 1, useNativeDriver: true }),
      Animated.timing(popOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      lastTap.current = 0;
      if (needLogin()) {
        return;
      }
      if (reaction !== 'like') {
        applyReaction('like');
      }
      popLike();
    } else {
      lastTap.current = now;
      tapTimer.current = setTimeout(() => {
        togglePlay();
        tapTimer.current = null;
      }, 300);
    }
  };

  const startFast = () => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
    }
    player.playbackRate = 2;
    setFast(true);
  };

  const stopFast = () => {
    if (!fast) {
      return;
    }
    player.playbackRate = speed;
    setFast(false);
  };

  const heading = video.title !== '' ? video.title : video.caption;

  return (
    <View style={styles.root}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handleTap}
        onLongPress={startFast}
        onPressOut={stopFast}
        delayLongPress={250}
      />

      {paused && (
        <View pointerEvents="none" style={styles.centerWrap}>
          <View style={styles.pausedCircle}>
            <MaterialCommunityIcons name="play" size={44} color="white" />
          </View>
        </View>
      )}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.centerWrap,
          { opacity: popOpacity, transform: [{ scale: popScale }] },
        ]}
      >
        <MaterialCommunityIcons name="thumb-up" size={100} color="#3ea6ff" />
      </Animated.View>

      {fast && (
        <View
          pointerEvents="none"
          style={[styles.fastWrap, { top: insets.top + 60 }]}
        >
          <View style={styles.fastBadge}>
            <MaterialCommunityIcons name="fast-forward" size={16} color="white" />
            <Text style={styles.fastText}>2x</Text>
          </View>
        </View>
      )}

      <Pressable
        style={[styles.backBtn, { top: insets.top + 10 }, feed && styles.hidden]}
        onPress={onClose}
        hitSlop={10}
      >
        <MaterialCommunityIcons name="arrow-left" size={26} color="white" />
      </Pressable>

      <View
        pointerEvents="none"
        style={[styles.info, { paddingBottom: insets.bottom + 24 }]}
      >
        <Text style={styles.username}>@{owner.username}</Text>
        <View style={styles.viewsRow}>
          <MaterialCommunityIcons name="play" size={18} color="white" />
          <Text style={styles.viewsText}>{formatCount(views)} views</Text>
        </View>
        {heading !== '' && <Text style={styles.title}>{heading}</Text>}
        {video.sound && (
          <Text style={styles.soundLine} numberOfLines={1}>
            ♫ {video.sound.title}
          </Text>
        )}
        {video.description !== '' && (
          <Text style={styles.desc} numberOfLines={3}>
            {video.description}
          </Text>
        )}
        {video.hashtags.length > 0 && (
          <Text style={styles.tags}>
            {video.hashtags.map((t) => '#' + t).join(' ')}
          </Text>
        )}
      </View>

      <View
        pointerEvents="box-none"
        style={[styles.actions, { bottom: insets.bottom + 20 }]}
      >
        <Pressable style={styles.avatarWrap} onPress={toggleFollow}>
          <View style={styles.avatarRing}>
            <Avatar name={owner.username} url={owner.avatar_url} size={46} />
          </View>
          {!isOwner && !following && (
            <View style={styles.plusBadge}>
              <Text style={styles.plusText}>+</Text>
            </View>
          )}
        </Pressable>

        <Pressable style={styles.actionBtn} onPress={onLike}>
          <MaterialCommunityIcons
            name={reaction === 'like' ? 'thumb-up' : 'thumb-up-outline'}
            size={28}
            color={reaction === 'like' ? '#3ea6ff' : 'white'}
          />
          <Text style={styles.actionLabel}>
            {likes > 0 ? formatCount(likes) : 'Like'}
          </Text>
        </Pressable>

        <Pressable style={styles.actionBtn} onPress={onDislike}>
          <MaterialCommunityIcons
            name={reaction === 'dislike' ? 'thumb-down' : 'thumb-down-outline'}
            size={28}
            color={reaction === 'dislike' ? '#3ea6ff' : 'white'}
          />
          <Text style={styles.actionLabel}>Dislike</Text>
        </Pressable>

        <Pressable style={styles.actionBtn} onPress={openComments}>
          <MaterialCommunityIcons name="comment-outline" size={26} color="white" />
          <Text style={styles.actionLabel}>
            {commentCount > 0 ? formatCount(commentCount) : 'Comments'}
          </Text>
        </Pressable>

        <Pressable style={styles.actionBtn} onPress={toggleRepost}>
          <MaterialCommunityIcons
            name="repeat-variant"
            size={32}
            color={reposted ? '#00d68f' : 'white'}
          />
          <Text style={styles.actionLabel}>
            {reposts > 0 ? formatCount(reposts) : 'Repost'}
          </Text>
        </Pressable>

        <Pressable style={styles.actionBtn} onPress={doShare}>
          <MaterialCommunityIcons name="share-outline" size={30} color="white" />
          <Text style={styles.actionLabel}>
            {shares > 0 ? formatCount(shares) : 'Share'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.moreBtn}
          onPress={() => setPanel('menu')}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="dots-horizontal" size={28} color="white" />
        </Pressable>
      </View>

      <View pointerEvents="none" style={styles.progressTrack}>
        <View style={{ flex: progress, backgroundColor: 'white' }} />
        <View style={{ flex: 1 - progress }} />
      </View>

      {panel === 'comments' && (
        <KeyboardAvoidingView style={styles.overlay} behavior="padding">
          <Pressable style={styles.backdrop} onPress={() => setPanel('none')} />
          <View style={[styles.sheet, { height: height * 0.6 }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {formatCount(commentCount)} comments
              </Text>
              <Pressable
                style={styles.sheetClose}
                onPress={() => setPanel('none')}
                hitSlop={12}
              >
                <Text style={styles.sheetCloseText}>✕</Text>
              </Pressable>
            </View>

            <FlatList
              style={styles.commentList}
              data={comments}
              keyExtractor={(c) => c.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No comments yet. Be the first!
                </Text>
              }
              renderItem={({ item }) => (
                <View style={styles.commentRow}>
                  <Avatar name={item.username} url={item.avatar_url} size={36} />
                  <View style={styles.commentBody}>
                    <Text style={styles.commentUser}>@{item.username}</Text>
                    <Text style={styles.commentText}>{item.body}</Text>
                  </View>
                </View>
              )}
            />

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder="Add comment..."
                placeholderTextColor="#888"
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={postComment}
              />
              <Pressable
                style={[styles.postBtn, posting && styles.disabled]}
                onPress={postComment}
                disabled={posting}
              >
                <Text style={styles.postText}>Post</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {(panel === 'menu' || panel === 'speed') && (
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setPanel('none')} />
          <View
            style={[styles.menuSheet, { paddingBottom: insets.bottom + 12 }]}
          >
            {panel === 'menu' && (
              <View>
                <MenuRow
                  icon="speedometer"
                  label="Playback speed"
                  value={speedLabel(speed)}
                  onPress={() => setPanel('speed')}
                />
                <MenuRow
                  icon="repeat"
                  label="Loop"
                  onPress={() => setLoop((l) => !l)}
                  right={
                    <View pointerEvents="none">
                      <Switch value={loop} />
                    </View>
                  }
                />
                <MenuRow
                  icon={muted ? 'volume-mute' : 'volume-high'}
                  label="Mute"
                  onPress={() => setMuted((m) => !m)}
                  right={
                    <View pointerEvents="none">
                      <Switch value={muted} />
                    </View>
                  }
                />
                <MenuRow
                  icon="music-note"
                  label="Use this sound"
                  onPress={remixSound}
                />
                <MenuRow
                  icon={saved ? 'bookmark' : 'bookmark-outline'}
                  label={saved ? 'Saved' : 'Save'}
                  onPress={toggleSave}
                />
                <MenuRow icon="flag-outline" label="Report" onPress={report} />
              </View>
            )}

            {panel === 'speed' && (
              <View>
                <Pressable
                  style={styles.menuBack}
                  onPress={() => setPanel('menu')}
                >
                  <MaterialCommunityIcons
                    name="arrow-left"
                    size={24}
                    color="white"
                  />
                  <Text style={styles.menuTitle}>Playback speed</Text>
                </Pressable>
                {SPEEDS.map((sp) => (
                  <Pressable
                    key={sp}
                    style={styles.menuRow}
                    onPress={() => {
                      setSpeed(sp);
                      setPanel('menu');
                    }}
                  >
                    <View style={styles.checkSlot}>
                      {speed === sp && (
                        <MaterialCommunityIcons
                          name="check"
                          size={22}
                          color="white"
                        />
                      )}
                    </View>
                    <Text style={styles.menuLabel}>{speedLabel(sp)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const shadow = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
} as const;

const styles = StyleSheet.create({
  hidden: { display: 'none' },
  root: { flex: 1, backgroundColor: 'black' },
  centerWrap: {
   ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pausedCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  fastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
  },
  fastText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    position: 'absolute',
    left: 0,
    right: 80,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 30,
  },
  username: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 6,
    ...shadow,
  },
  viewsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  viewsText: { color: 'white', fontSize: 13, fontWeight: '600', ...shadow },
  title: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    ...shadow,
  },
  soundLine: { color: 'white', fontSize: 14, marginTop: 4, ...shadow },
  desc: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
    ...shadow,
  },
  tags: { color: '#8ecbff', fontSize: 14, fontWeight: '600', ...shadow },
  actions: {
    position: 'absolute',
    right: 0,
    alignItems: 'center',
    width: 64,
  },
  avatarWrap: { alignItems: 'center', marginBottom: 24 },
  avatarRing: {
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 26,
    overflow: 'hidden',
  },
  avatarEmpty: {
    backgroundColor: '#ff2d55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: 'white', fontWeight: 'bold' },
  plusBadge: {
    position: 'absolute',
    bottom: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff2d55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: { color: 'white', fontSize: 15, fontWeight: 'bold', lineHeight: 17 },
  actionBtn: { alignItems: 'center', marginBottom: 16 },
  actionLabel: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  moreBtn: { alignItems: 'center', marginTop: -2 },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
 overlay: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 12,
  },
  sheetHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#3a3a3c',
  },
  sheetTitle: { color: 'white', fontSize: 15, fontWeight: '600' },
  sheetClose: { position: 'absolute', right: 16, top: 12 },
  sheetCloseText: { color: 'white', fontSize: 18 },
  commentList: { flex: 1, paddingHorizontal: 14 },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 40 },
  commentRow: { flexDirection: 'row', paddingVertical: 10, gap: 10 },
  commentBody: { flex: 1 },
  commentUser: { color: '#aaa', fontSize: 13, marginBottom: 2 },
  commentText: { color: 'white', fontSize: 15 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 10,
  },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 16,
    backgroundColor: '#2c2c2e',
    color: 'white',
  },
  postBtn: {
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ff2d55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postText: { color: 'white', fontWeight: 'bold' },
  disabled: { opacity: 0.5 },
  menuSheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingVertical: 8,
    paddingHorizontal: 20,
    gap: 16,
  },
  menuLabel: { flex: 1, color: 'white', fontSize: 16 },
  menuValue: { color: '#aaa', fontSize: 14 },
  menuBack: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: 20,
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#3a3a3c',
  },
  menuTitle: { color: 'white', fontSize: 16, fontWeight: '600' },
  checkSlot: { width: 24, alignItems: 'center', justifyContent: 'center' },
});