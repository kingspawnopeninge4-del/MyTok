import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type CommentData = {
  id: string;
  user: string;
  text: string;
};

type VideoData = {
  id: string;
  url: string;
  username: string;
  caption: string;
  music: string;
  color: string;
  likes: number;
  liked: boolean;
  following: boolean;
  comments: CommentData[];
};

type Tab = 'following' | 'foryou';

const INITIAL_VIDEOS: VideoData[] = [
  {
    id: 'v1',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    username: 'sample_user_1',
    caption: 'Sample video 1',
    music: 'original sound - sample_user_1',
    color: '#e8590c',
    likes: 0,
    liked: false,
    following: false,
    comments: [],
  },
  {
    id: 'v2',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4',
    username: 'sample_user_2',
    caption: 'Sample video 2',
    music: 'original sound - sample_user_2',
    color: '#1971c2',
    likes: 0,
    liked: false,
    following: false,
    comments: [],
  },
];

function formatCount(n: number): string {
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return String(n);
}

function VideoItem({
  video,
  height,
  isActive,
  onLike,
  onDoubleTapLike,
  onFollow,
  onOpenComments,
  onShare,
}: {
  video: VideoData;
  height: number;
  isActive: boolean;
  onLike: (id: string) => void;
  onDoubleTapLike: (id: string) => void;
  onFollow: (id: string) => void;
  onOpenComments: (id: string) => void;
  onShare: (id: string) => void;
}) {
  const player = useVideoPlayer(video.url, (p) => {
    p.loop = true;
  });

  const [icon, setIcon] = useState<'pause' | 'play'>('pause');
  const [progress, setProgress] = useState(0);

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const likeOpacity = useRef(new Animated.Value(0)).current;
  const likeScale = useRef(new Animated.Value(0.3)).current;

  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autoplay when on screen, pause and rewind when not
  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
      player.currentTime = 0;
    }
  }, [isActive, player]);

  // Update the progress bar
  useEffect(() => {
    const id = setInterval(() => {
      if (!isActive) {
        setProgress(0);
        return;
      }
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
  }, [isActive, player]);

  // Clean up the tap timer
  useEffect(() => {
    return () => {
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
      }
    };
  }, []);

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

  const popLike = () => {
    likeOpacity.setValue(1);
    likeScale.setValue(0.3);
    Animated.sequence([
      Animated.spring(likeScale, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(likeOpacity, {
        toValue: 0,
        duration: 400,
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

  // One tap = pause/play, two quick taps = like
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      lastTap.current = 0;
      onDoubleTapLike(video.id);
      popLike();
    } else {
      lastTap.current = now;
      tapTimer.current = setTimeout(() => {
        togglePlay();
        tapTimer.current = null;
      }, 300);
    }
  };

  return (
    <View style={{ height, backgroundColor: 'black' }}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
      />
      <Pressable style={styles.tapArea} onPress={handleTap} />

      {/* Pause / play icon flash */}
      <Animated.View
        pointerEvents="none"
        style={[styles.centerWrap, { opacity, transform: [{ scale }] }]}
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

      {/* Big thumbs-up on double tap */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.centerWrap,
          { opacity: likeOpacity, transform: [{ scale: likeScale }] },
        ]}
      >
        <Text style={styles.bigLike}>👍</Text>
      </Animated.View>

      {/* Username, caption, music */}
      <View pointerEvents="none" style={styles.infoWrap}>
        <Text style={styles.username}>@{video.username}</Text>
        <Text style={styles.caption}>{video.caption}</Text>
        <Text style={styles.music}>♫ {video.music}</Text>
      </View>

      {/* Right side buttons */}
      <View pointerEvents="box-none" style={styles.actions}>
        <Pressable
          style={styles.avatarWrap}
          onPress={() => onFollow(video.id)}
        >
          <View style={[styles.avatar, { backgroundColor: video.color }]}>
            <Text style={styles.avatarLetter}>
              {video.username.charAt(0).toUpperCase()}
            </Text>
          </View>
          {!video.following && (
            <View style={styles.plusBadge}>
              <Text style={styles.plusText}>+</Text>
            </View>
          )}
        </Pressable>

        {/* Like (thumbs up) */}
        <Pressable style={styles.actionBtn} onPress={() => onLike(video.id)}>
          <View
            style={[
              styles.actionCircle,
              video.liked && styles.actionCircleLiked,
            ]}
          >
            <Text style={styles.actionEmoji}>👍</Text>
          </View>
          <Text style={styles.actionCount}>{formatCount(video.likes)}</Text>
        </Pressable>

        {/* Comments */}
        <Pressable
          style={styles.actionBtn}
          onPress={() => onOpenComments(video.id)}
        >
          <View style={styles.actionCircle}>
            <Text style={styles.actionEmoji}>💬</Text>
          </View>
          <Text style={styles.actionCount}>
            {formatCount(video.comments.length)}
          </Text>
        </Pressable>

        {/* Share (YouTube style) */}
        <Pressable style={styles.actionBtn} onPress={() => onShare(video.id)}>
          <View style={styles.actionCircle}>
            <Text style={styles.shareArrow}>↪</Text>
          </View>
          <Text style={styles.actionCount}>Share</Text>
        </Pressable>
      </View>

      {/* Progress bar */}
      <View pointerEvents="none" style={styles.progressTrack}>
        <View style={{ flex: progress, backgroundColor: 'white' }} />
        <View style={{ flex: 1 - progress }} />
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [videos, setVideos] = useState<VideoData[]>(INITIAL_VIDEOS);
  const [tab, setTab] = useState<Tab>('foryou');
  const [activeIndex, setActiveIndex] = useState(0);
  const [listHeight, setListHeight] = useState(height);
  const [commentsId, setCommentsId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
      const first = viewableItems[0];
      if (first && first.index !== null && first.index !== undefined) {
        setActiveIndex(first.index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const feed =
    tab === 'following' ? videos.filter((v) => v.following) : videos;

  const switchTab = (next: Tab) => {
    if (next === tab) {
      return;
    }
    setTab(next);
    setActiveIndex(0);
  };

  const toggleLike = (id: string) => {
    setVideos((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              liked: !v.liked,
              likes: v.liked ? v.likes - 1 : v.likes + 1,
            }
          : v
      )
    );
  };

  // Double tap only likes, it never removes a like
  const likeOnly = (id: string) => {
    setVideos((prev) =>
      prev.map((v) =>
        v.id === id && !v.liked ? { ...v, liked: true, likes: v.likes + 1 } : v
      )
    );
  };

  const toggleFollow = (id: string) => {
    setVideos((prev) =>
      prev.map((v) => (v.id === id ? { ...v, following: !v.following } : v))
    );
  };

  const addComment = () => {
    const text = draft.trim();
    if (!text || commentsId === null) {
      return;
    }
    const newComment: CommentData = {
      id: String(Date.now()),
      user: 'you',
      text,
    };
    setVideos((prev) =>
      prev.map((v) =>
        v.id === commentsId
          ? { ...v, comments: [newComment, ...v.comments] }
          : v
      )
    );
    setDraft('');
  };

  const shareVideo = async (id: string) => {
    const v = videos.find((x) => x.id === id);
    if (!v) {
      return;
    }
    try {
      await Share.share({
        message: `Check out @${v.username} on MyTok: ${v.url}`,
      });
    } catch {
      // sharing was cancelled or failed
    }
  };

  const closeComments = () => {
    setCommentsId(null);
    setDraft('');
  };

  const openVideo = videos.find((v) => v.id === commentsId) ?? null;

  return (
    <View
      style={styles.container}
      onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
    >
      {feed.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>
            You are not currently following any accounts
          </Text>
          <Text style={styles.emptySub}>
            Follow some accounts to use this feature. Go to For You and tap
            the + on a creator's profile picture.
          </Text>
        </View>
      ) : (
        <FlatList
          key={tab}
          data={feed}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <VideoItem
              video={item}
              height={listHeight}
              isActive={index === activeIndex}
              onLike={toggleLike}
              onDoubleTapLike={likeOnly}
              onFollow={toggleFollow}
              onOpenComments={setCommentsId}
              onShare={shareVideo}
            />
          )}
          showsVerticalScrollIndicator={false}
          snapToInterval={listHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          bounces={false}
          overScrollMode="never"
          getItemLayout={(_, i) => ({
            length: listHeight,
            offset: listHeight * i,
            index: i,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={1}
        />
      )}

      {/* Top tabs */}
      <View
        pointerEvents="box-none"
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <Pressable onPress={() => switchTab('following')} hitSlop={10}>
          <Text
            style={
              tab === 'following' ? styles.headerActive : styles.headerInactive
            }
          >
            Following
          </Text>
        </Pressable>
        <Text style={styles.headerDivider}>|</Text>
        <Pressable onPress={() => switchTab('foryou')} hitSlop={10}>
          <Text
            style={
              tab === 'foryou' ? styles.headerActive : styles.headerInactive
            }
          >
            For You
          </Text>
        </Pressable>
      </View>

      {/* Comments sheet */}
      <Modal
        visible={commentsId !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeComments}
      >
        <KeyboardAvoidingView style={styles.modalRoot} behavior="padding">
          <Pressable style={styles.backdrop} onPress={closeComments} />
          <View style={[styles.sheet, { height: height * 0.6 }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {openVideo ? formatCount(openVideo.comments.length) : 0}{' '}
                comments
              </Text>
              <Pressable
                style={styles.sheetCloseBtn}
                onPress={closeComments}
                hitSlop={12}
              >
                <Text style={styles.sheetClose}>✕</Text>
              </Pressable>
            </View>

            <FlatList
              style={styles.commentList}
              data={openVideo ? openVideo.comments : []}
              keyExtractor={(c) => c.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No comments yet. Be the first!
                </Text>
              }
              renderItem={({ item }) => (
                <View style={styles.commentRow}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarLetter}>
                      {item.user.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.commentBody}>
                    <Text style={styles.commentUser}>{item.user}</Text>
                    <Text style={styles.commentText}>{item.text}</Text>
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
                returnKeyType="send"
                onSubmitEditing={addComment}
              />
              <Pressable style={styles.postBtn} onPress={addComment}>
                <Text style={styles.postText}>Post</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  centerWrap: {
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
  bigLike: {
    fontSize: 100,
  },
  infoWrap: {
    position: 'absolute',
    left: 12,
    right: 90,
    bottom: 24,
  },
  username: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  caption: {
    color: 'white',
    fontSize: 15,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  music: {
    color: 'white',
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  actions: {
    position: 'absolute',
    right: 10,
    bottom: 24,
    alignItems: 'center',
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  plusBadge: {
    position: 'absolute',
    bottom: -11,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ff2d55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  actionBtn: {
    alignItems: 'center',
    marginBottom: 18,
  },
  actionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCircleLiked: {
    backgroundColor: '#3ea6ff',
  },
  actionEmoji: {
    fontSize: 26,
  },
  shareArrow: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 38,
  },
  actionCount: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  headerInactive: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 17,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  headerDivider: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
  },
  headerActive: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptySub: {
    color: '#aaa',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#3a3a3c',
  },
  sheetTitle: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  sheetCloseBtn: {
    position: 'absolute',
    right: 16,
    top: 12,
  },
  sheetClose: {
    color: 'white',
    fontSize: 18,
  },
  commentList: {
    flex: 1,
    paddingHorizontal: 14,
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 40,
  },
  commentRow: {
    flexDirection: 'row',
    paddingVertical: 10,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3a3a3c',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  commentAvatarLetter: {
    color: 'white',
    fontWeight: 'bold',
  },
  commentBody: {
    flex: 1,
  },
  commentUser: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 2,
  },
  commentText: {
    color: 'white',
    fontSize: 15,
  },
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
  postText: {
    color: 'white',
    fontWeight: 'bold',
  },
});