import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  GestureResponderEvent,
  KeyboardAvoidingView,
  Modal,
  Platform,
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

/* ----------------------------- Icons ----------------------------- */

type IconName =
  | 'thumb-up'
  | 'thumb-up-off-alt'
  | 'thumb-down'
  | 'thumb-down-off-alt'
  | 'comment'
  | 'more-horiz'
  | 'speed'
  | 'repeat'
  | 'high-quality'
  | 'volume-off'
  | 'volume-up'
  | 'fast-forward'
  | 'bookmark'
  | 'bookmark-border'
  | 'flag'
  | 'arrow-back'
  | 'check'
  | 'share';

const ICON_NAMES: Record<IconName, string> = {
  'thumb-up': 'thumb-up',
  'thumb-up-off-alt': 'thumb-up-outline',
  'thumb-down': 'thumb-down',
  'thumb-down-off-alt': 'thumb-down-outline',
  comment: 'comment-outline',
  'more-horiz': 'dots-horizontal',
  speed: 'speedometer',
  repeat: 'repeat',
  'high-quality': 'high-definition',
  'volume-off': 'volume-mute',
  'volume-up': 'volume-high',
  'fast-forward': 'fast-forward',
  bookmark: 'bookmark',
  'bookmark-border': 'bookmark-outline',
  flag: 'flag-outline',
  'arrow-back': 'arrow-left',
  check: 'check',
  share: 'share-outline',
};

function Icon({
  name,
  size = 24,
  color = 'black',
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <MaterialCommunityIcons
      name={ICON_NAMES[name] as any}
      size={size}
      color={color}
    />
  );
}

/* ------------------------------ Types ---------------------------- */

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
  disliked: boolean;
  saved: boolean;
  following: boolean;
  comments: CommentData[];
};

type Tab = 'following' | 'foryou';
type MenuScreen = 'main' | 'speed' | 'quality';

/* ----------------------------- Constants ------------------------- */

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
// Quality is a joke option for now, it does not change the video
const QUALITIES = ['Auto', '1080p', '720p', '480p', '360p'];
const LIKE_SIZE = 100;

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
    disliked: false,
    saved: false,
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
    disliked: false,
    saved: false,
    following: false,
    comments: [],
  },
];

/* ----------------------------- Helpers --------------------------- */

function formatCount(n: number): string {
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return String(n);
}

function speedLabel(s: number): string {
  return s === 1 ? 'Normal' : s + 'x';
}

/* ---------------------------- OptionRow -------------------------- */

function OptionRow({
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
    <Pressable style={styles.optionRow} onPress={onPress}>
      <Icon name={icon} size={24} color="white" />
      <Text style={styles.optionLabel}>{label}</Text>
      {value !== undefined && <Text style={styles.optionValue}>{value}</Text>}
      {right}
    </Pressable>
  );
}

/* ---------------------------- VideoItem -------------------------- */

type VideoItemProps = {
  video: VideoData;
  height: number;
  isActive: boolean;
  speed: number;
  loop: boolean;
  muted: boolean;
  onLike: (id: string) => void;
  onDislike: (id: string) => void;
  onDoubleTapLike: (id: string) => void;
  onFollow: (id: string) => void;
  onOpenComments: (id: string) => void;
  onShare: (id: string) => void;
  onOpenMenu: (id: string) => void;
};

const VideoItem = memo(function VideoItem({
  video,
  height,
  isActive,
  speed,
  loop,
  muted,
  onLike,
  onDislike,
  onDoubleTapLike,
  onFollow,
  onOpenComments,
  onShare,
  onOpenMenu,
}: VideoItemProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const player = useVideoPlayer(video.url, (p) => {
    p.loop = loop;
    p.muted = muted;
  });

  const [icon, setIcon] = useState<'pause' | 'play'>('play');
  const [fastForward, setFastForward] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const likeOpacity = useRef(new Animated.Value(0)).current;
  const likeScale = useRef(new Animated.Value(0.3)).current;
  const likeX = useRef(new Animated.Value(0)).current;
  const likeY = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fastForwardRef = useRef(false);
  const longPressed = useRef(false);

  useEffect(() => {
    player.loop = loop;
  }, [loop, player]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (!fastForward) {
      player.playbackRate = speed;
    }
  }, [speed, fastForward, player]);

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
      player.currentTime = 0;
      fastForwardRef.current = false;
      setFastForward(false);
      progress.setValue(0);
    }
  }, [isActive, player, progress]);

  // Progress only runs for the video you are watching
  useEffect(() => {
    if (!isActive) {
      return;
    }
    const id = setInterval(() => {
      try {
        const d = player.duration;
        if (d > 0) {
          progress.setValue(Math.min(1, player.currentTime / d));
        }
      } catch {
        // player not ready yet
      }
    }, 100);
    return () => clearInterval(id);
  }, [isActive, player, progress]);

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

  const popLike = (x: number, y: number) => {
    const half = LIKE_SIZE / 2;
    likeX.setValue(Math.max(half, Math.min(x, width - half)));
    likeY.setValue(Math.max(half, Math.min(y, height - half)));
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
      setIcon('play');
    } else {
      player.play();
      setIcon('pause');
    }
    flashIcon();
  };

  const handleTap = (e: GestureResponderEvent) => {
    // A long press (2x hold) must never count as a tap
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    const { locationX, locationY } = e.nativeEvent;
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      lastTap.current = 0;
      onDoubleTapLike(video.id);
      popLike(locationX, locationY);
    } else {
      lastTap.current = now;
      tapTimer.current = setTimeout(() => {
        togglePlay();
        tapTimer.current = null;
      }, 300);
    }
  };

  // Hold the video to temporarily play at 2x speed
  const startFastForward = () => {
    if (!isActive) return;

    longPressed.current = true;

    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
    }
    lastTap.current = 0;

    player.playbackRate = 2;
    fastForwardRef.current = true;
    setFastForward(true);
  };

  const stopFastForward = () => {
    if (!fastForwardRef.current) return;

    player.playbackRate = speed;
    fastForwardRef.current = false;
    setFastForward(false);
  };

  return (
    <View style={{ height, backgroundColor: 'black' }}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
      />

      <Pressable
        style={styles.tapArea}
        onPressIn={() => {
          longPressed.current = false;
        }}
        onPress={handleTap}
        onLongPress={startFastForward}
        onPressOut={stopFastForward}
        delayLongPress={250}
      />

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

      {/* Big thumbs-up on double tap, shown where you tapped */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.bigLikeWrap,
          {
            opacity: likeOpacity,
            transform: [
              { translateX: Animated.subtract(likeX, LIKE_SIZE / 2) },
              { translateY: Animated.subtract(likeY, LIKE_SIZE / 2) },
              { scale: likeScale },
            ],
          },
        ]}
      >
        <Icon name="thumb-up" size={LIKE_SIZE} color="#3ea6ff" />
      </Animated.View>

      {/* Small YouTube-style 2x indicator at the top */}
      {fastForward && (
        <View
          pointerEvents="none"
          style={[styles.fastForwardWrap, { top: insets.top + 48 }]}
        >
          <View style={styles.fastForwardBadge}>
            <Icon name="fast-forward" size={16} color="white" />
            <Text style={styles.fastForwardText}>2x</Text>
          </View>
        </View>
      )}

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

        {/* Like */}
        <Pressable style={styles.actionBtn} onPress={() => onLike(video.id)}>
          <Icon
            name={video.liked ? 'thumb-up' : 'thumb-up-off-alt'}
            size={28}
            color={video.liked ? '#3ea6ff' : 'white'}
          />
          <Text style={styles.actionLabel}>
            {video.likes > 0 ? formatCount(video.likes) : 'Like'}
          </Text>
        </Pressable>

        {/* Dislike */}
        <Pressable
          style={styles.actionBtn}
          onPress={() => onDislike(video.id)}
        >
          <Icon
            name={video.disliked ? 'thumb-down' : 'thumb-down-off-alt'}
            size={28}
            color={video.disliked ? '#3ea6ff' : 'white'}
          />
          <Text style={styles.actionLabel}>Dislike</Text>
        </Pressable>

        {/* Comments */}
        <Pressable
          style={styles.actionBtn}
          onPress={() => onOpenComments(video.id)}
        >
          <Icon name="comment" size={26} color="white" />
          <Text style={styles.actionLabel}>
            {video.comments.length > 0
              ? formatCount(video.comments.length)
              : 'Comments'}
          </Text>
        </Pressable>

        {/* Share */}
        <Pressable style={styles.actionBtn} onPress={() => onShare(video.id)}>
          <Icon name="share" size={30} color="white" />
          <Text style={styles.actionLabel}>Share</Text>
        </Pressable>

        {/* More options */}
        <Pressable
          style={styles.moreBtn}
          onPress={() => onOpenMenu(video.id)}
          hitSlop={8}
        >
          <Icon name="more-horiz" size={28} color="white" />
        </Pressable>
      </View>

      {/* Progress bar */}
      <View pointerEvents="none" style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
});

/* ---------------------------- HomeScreen ------------------------- */

export default function HomeScreen() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [focused, setFocused] = useState(true);

  useEffect(() => {
    const unsubFocus = navigation.addListener('focus', () => setFocused(true));
    const unsubBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      unsubFocus();
      unsubBlur();
    };
  }, [navigation]);

  const [videos, setVideos] = useState<VideoData[]>(INITIAL_VIDEOS);
  const [tab, setTab] = useState<Tab>('foryou');
  const [activeIndex, setActiveIndex] = useState(0);
  const [listHeight, setListHeight] = useState(height);
  const [commentsId, setCommentsId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  // Settings from the three-dot menu
  const [menu, setMenu] = useState<MenuScreen | null>(null);
  const [menuVideoId, setMenuVideoId] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);
  const [muted, setMuted] = useState(false);
  const [quality, setQuality] = useState('Auto');

  // Lets stable callbacks read the latest videos without changing identity
  const videosRef = useRef(videos);
  videosRef.current = videos;

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

  const toggleLike = useCallback((id: string) => {
    setVideos((prev) =>
      prev.map((v) => {
        if (v.id !== id) {
          return v;
        }
        if (v.liked) {
          return { ...v, liked: false, likes: v.likes - 1 };
        }
        return { ...v, liked: true, likes: v.likes + 1, disliked: false };
      })
    );
  }, []);

  const toggleDislike = useCallback((id: string) => {
    setVideos((prev) =>
      prev.map((v) => {
        if (v.id !== id) {
          return v;
        }
        if (v.disliked) {
          return { ...v, disliked: false };
        }
        return {
          ...v,
          disliked: true,
          liked: false,
          likes: v.liked ? v.likes - 1 : v.likes,
        };
      })
    );
  }, []);

  // Double tap only likes, it never removes a like
  const likeOnly = useCallback((id: string) => {
    setVideos((prev) =>
      prev.map((v) =>
        v.id === id && !v.liked
          ? { ...v, liked: true, likes: v.likes + 1, disliked: false }
          : v
      )
    );
  }, []);

  const toggleFollow = useCallback((id: string) => {
    setVideos((prev) =>
      prev.map((v) => (v.id === id ? { ...v, following: !v.following } : v))
    );
  }, []);

  const toggleSave = (id: string) => {
    setVideos((prev) =>
      prev.map((v) => (v.id === id ? { ...v, saved: !v.saved } : v))
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

  const shareVideo = useCallback(async (id: string) => {
    const v = videosRef.current.find((x) => x.id === id);
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
  }, []);

  const openComments = useCallback((id: string) => {
    setCommentsId(id);
  }, []);

  const closeComments = () => {
    setCommentsId(null);
    setDraft('');
  };

  const openMenu = useCallback((id: string) => {
    setMenuVideoId(id);
    setMenu('main');
  }, []);

  const closeMenu = () => {
    setMenu(null);
  };

  const reportVideo = () => {
    setMenu(null);
    Alert.alert(
      'Report',
      'Thanks for letting us know. There is no server yet, so this report is not sent anywhere.'
    );
  };

  const openVideo = videos.find((v) => v.id === commentsId) ?? null;
  const menuVideo = videos.find((v) => v.id === menuVideoId) ?? null;

  const renderItem = useCallback(
    ({ item, index }: { item: VideoData; index: number }) => (
      <VideoItem
        video={item}
        height={listHeight}
        isActive={focused && index === activeIndex}
        speed={speed}
        loop={loop}
        muted={muted}
        onLike={toggleLike}
        onDislike={toggleDislike}
        onDoubleTapLike={likeOnly}
        onFollow={toggleFollow}
        onOpenComments={openComments}
        onShare={shareVideo}
        onOpenMenu={openMenu}
      />
    ),
    [
      listHeight,
      focused,
      activeIndex,
      speed,
      loop,
      muted,
      toggleLike,
      toggleDislike,
      likeOnly,
      toggleFollow,
      openComments,
      shareVideo,
      openMenu,
    ]
  );

  const getItemLayout = useCallback(
    (_: unknown, i: number) => ({
      length: listHeight,
      offset: listHeight * i,
      index: i,
    }),
    [listHeight]
  );

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
          renderItem={renderItem}
          extraData={activeIndex}
          showsVerticalScrollIndicator={false}
          snapToInterval={listHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          bounces={false}
          overScrollMode="never"
          getItemLayout={getItemLayout}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          removeClippedSubviews={false}
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
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
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
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

      {/* Options menu (the three dots) */}
      <Modal
        visible={menu !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeMenu}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closeMenu} />
          <View
            style={[
              styles.menuSheet,
              { paddingBottom: insets.bottom + 12 },
            ]}
          >
            {menu === 'main' && (
              <View>
                <OptionRow
                  icon="speed"
                  label="Playback speed"
                  value={speedLabel(speed)}
                  onPress={() => setMenu('speed')}
                />
                <OptionRow
                  icon="repeat"
                  label="Loop"
                  onPress={() => setLoop((l) => !l)}
                  right={
                    <View pointerEvents="none">
                      <Switch value={loop} />
                    </View>
                  }
                />
                <OptionRow
                  icon="high-quality"
                  label="Quality"
                  value={quality}
                  onPress={() => setMenu('quality')}
                />
                <OptionRow
                  icon={muted ? 'volume-off' : 'volume-up'}
                  label="Mute"
                  onPress={() => setMuted((m) => !m)}
                  right={
                    <View pointerEvents="none">
                      <Switch value={muted} />
                    </View>
                  }
                />
                <OptionRow
                  icon={
                    menuVideo && menuVideo.saved ? 'bookmark' : 'bookmark-border'
                  }
                  label={menuVideo && menuVideo.saved ? 'Saved' : 'Save'}
                  onPress={() => {
                    if (menuVideoId) {
                      toggleSave(menuVideoId);
                    }
                  }}
                />
                <OptionRow icon="flag" label="Report" onPress={reportVideo} />
              </View>
            )}

            {menu === 'speed' && (
              <View>
                <Pressable
                  style={styles.menuBack}
                  onPress={() => setMenu('main')}
                >
                  <Icon name="arrow-back" size={24} color="white" />
                  <Text style={styles.menuTitle}>Playback speed</Text>
                </Pressable>
                {SPEEDS.map((s) => (
                  <Pressable
                    key={s}
                    style={styles.optionRow}
                    onPress={() => {
                      setSpeed(s);
                      setMenu('main');
                    }}
                  >
                    <View style={styles.checkSlot}>
                      {speed === s && (
                        <Icon name="check" size={22} color="white" />
                      )}
                    </View>
                    <Text style={styles.optionLabel}>{speedLabel(s)}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {menu === 'quality' && (
              <View>
                <Pressable
                  style={styles.menuBack}
                  onPress={() => setMenu('main')}
                >
                  <Icon name="arrow-back" size={24} color="white" />
                  <Text style={styles.menuTitle}>Quality</Text>
                </Pressable>
                {QUALITIES.map((q) => (
                  <Pressable
                    key={q}
                    style={styles.optionRow}
                    onPress={() => {
                      setQuality(q);
                      setMenu('main');
                    }}
                  >
                    <View style={styles.checkSlot}>
                      {quality === q && (
                        <Icon name="check" size={22} color="white" />
                      )}
                    </View>
                    <Text style={styles.optionLabel}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ------------------------------ Styles --------------------------- */

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
  bigLikeWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: LIKE_SIZE,
    height: LIKE_SIZE,
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
    right: 0,
    bottom: 20,
    alignItems: 'center',
    width: 64,
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
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
  plusText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    lineHeight: 17,
  },
  actionBtn: {
    alignItems: 'center',
    marginBottom: 16,
  },
  actionLabel: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  moreBtn: {
    alignItems: 'center',
    marginTop: -2,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressFill: {
    height: 3,
    backgroundColor: 'white',
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
  menuSheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 16,
  },
  optionLabel: {
    flex: 1,
    color: 'white',
    fontSize: 16,
  },
  optionValue: {
    color: '#aaa',
    fontSize: 14,
  },
  menuBack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#3a3a3c',
  },
  menuTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  checkSlot: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Small top 2x indicator
  fastForwardWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fastForwardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
  },
  fastForwardText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});