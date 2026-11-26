import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import VideoViewer, {
  ViewerOwner,
  ViewerVideo,
} from '@/components/video-viewer';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type Tab = 'following' | 'foryou';
type FeedItem = { video: ViewerVideo; owner: ViewerOwner };

type SoundRow = { id: string; title: string; url: string };
type ProfileRow = { id: string; username: string; avatar_url: string | null };

type Raw = {
  id: string;
  url: string;
  caption: string;
  title: string;
  description: string;
  hashtags: string[];
  views: number;
  shares: number;
  user_id: string;
  keep_original: boolean;
  sound_id: string | null;
  sound_start: number;
  sound_length: number;
};

const PAGE = 8;

function toItem(
  r: Raw,
  profiles: Map<string, ProfileRow>,
  sounds: Map<string, SoundRow>
): FeedItem {
  const snd = r.sound_id ? sounds.get(r.sound_id) : undefined;
  const prof = profiles.get(r.user_id);
  return {
    video: {
      id: r.id,
      url: r.url,
      caption: r.caption,
      title: r.title,
      description: r.description,
      hashtags: r.hashtags ?? [],
      views: r.views ?? 0,
      shares: r.shares ?? 0,
      keep_original: r.keep_original,
      sound: snd
        ? {
            title: snd.title,
            url: snd.url,
            start: r.sound_start,
            length: r.sound_length,
          }
        : null,
    },
    owner: {
      id: r.user_id,
      username: prof ? prof.username : 'user',
      avatar_url: prof ? prof.avatar_url : null,
    },
  };
}

export default function HomeScreen() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { session, profileVersion } = useAuth();
  const me = session ? session.user.id : null;

  const [focused, setFocused] = useState(true);
  const [tab, setTab] = useState<Tab>('foryou');
  const [items, setItems] = useState<FeedItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [listHeight, setListHeight] = useState(height);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const reqId = useRef(0);
  const busy = useRef(false);
  const doneRef = useRef(false);
  const itemsRef = useRef<FeedItem[]>([]);
  itemsRef.current = items;
  const followIds = useRef<string[]>([]);

  useEffect(() => {
    const unsubFocus = navigation.addListener('focus', () => setFocused(true));
    const unsubBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      unsubFocus();
      unsubBlur();
    };
  }, [navigation]);

  const load = useCallback(
    async (reset: boolean) => {
      if (!reset && (busy.current || doneRef.current)) return;
      if (reset) {
        reqId.current += 1;
        doneRef.current = false;
        setLoading(true);
        setFailed(false);
      }
      const id = reqId.current;
      busy.current = true;

      try {
        let ids: string[] | null = null;

        if (tab === 'following') {
          if (!me) {
            setItems([]);
            doneRef.current = true;
            return;
          }
          if (reset) {
            const f = await supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', me);
            if (id !== reqId.current) return;
            if (f.error) throw f.error;
            followIds.current = (f.data ?? []).map(
              (r: { following_id: string }) => r.following_id
            );
          }
          ids = followIds.current;
          if (ids.length === 0) {
            setItems([]);
            doneRef.current = true;
            return;
          }
        }

        const from = reset ? 0 : itemsRef.current.length;
        let q = supabase
          .from('videos')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1);
        if (ids) q = q.in('user_id', ids);

        const { data, error } = await q;
        if (id !== reqId.current) return;
        if (error) throw error;

        const videos = (data ?? []) as unknown as Raw[];

        const userIds = [...new Set(videos.map((v) => v.user_id))];
        const soundIds = [
          ...new Set(videos.map((v) => v.sound_id).filter(Boolean)),
        ] as string[];

        const profiles = new Map<string, ProfileRow>();
        const sounds = new Map<string, SoundRow>();

        if (userIds.length > 0) {
          const p = await supabase
            .from('profiles')
            .select('id,username,avatar_url')
            .in('id', userIds);
          if (p.error) console.log('PROFILES ERROR', p.error.message);
          (p.data ?? []).forEach((r: ProfileRow) => profiles.set(r.id, r));
        }

        if (soundIds.length > 0) {
          const s = await supabase
            .from('sounds')
            .select('id,title,url')
            .in('id', soundIds);
          if (s.error) console.log('SOUNDS ERROR', s.error.message);
          (s.data ?? []).forEach((r: SoundRow) => sounds.set(r.id, r));
        }

        if (id !== reqId.current) return;

        const rows = videos.map((v) => toItem(v, profiles, sounds));
        if (rows.length < PAGE) doneRef.current = true;

        setItems((prev) => {
          if (reset) return rows;
          const have = new Set(prev.map((p) => p.video.id));
          return [...prev, ...rows.filter((r) => !have.has(r.video.id))];
        });
      } catch (e: any) {
        console.log(
          'FEED LOAD ERROR',
          e?.message ?? e,
          e?.code,
          e?.details,
          e?.hint
        );
        if (id === reqId.current && reset) setFailed(true);
      } finally {
        if (id === reqId.current) {
          busy.current = false;
          setLoading(false);
        }
      }
    },
    [tab, me]
  );

  // Reload when the tab changes, someone logs in or out, or a video is posted
  useEffect(() => {
    setActiveIndex(0);
    setItems([]);
    load(true);
  }, [load, profileVersion]);

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

  const switchTab = (next: Tab) => {
    if (next !== tab) setTab(next);
  };

  const renderItem = useCallback(
    ({ item, index }: { item: FeedItem; index: number }) => (
      <View style={{ height: listHeight }}>
        <VideoViewer
          video={item.video}
          owner={item.owner}
          feed
          isActive={focused && index === activeIndex}
        />
      </View>
    ),
    [listHeight, focused, activeIndex]
  );

  const getItemLayout = useCallback(
    (_: unknown, i: number) => ({
      length: listHeight,
      offset: listHeight * i,
      index: i,
    }),
    [listHeight]
  );

  let body;
  if (loading && items.length === 0) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color="white" />
      </View>
    );
  } else if (failed && items.length === 0) {
    body = (
      <View style={styles.center}>
        <Text style={styles.title}>Could not load videos</Text>
        <Text style={styles.sub}>Check your internet connection.</Text>
        <Pressable style={styles.retryBtn} onPress={() => load(true)}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  } else if (items.length === 0) {
    let title = 'No videos yet';
    let sub = 'Tap the + button to post the first one.';
    if (tab === 'following') {
      if (!me) {
        title = 'Log in to see your Following feed';
        sub = 'Videos from people you follow show up here.';
      } else if (followIds.current.length === 0) {
        title = 'You are not currently following any accounts';
        sub =
          "Follow some accounts to use this feature. Go to For You and tap the + on a creator's profile picture.";
      } else {
        title = 'No videos yet';
        sub = 'The people you follow have not posted anything.';
      }
    }
    body = (
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
    );
  } else {
    body = (
      <FlatList
        key={tab}
        data={items}
        keyExtractor={(it) => it.video.id}
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
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        onEndReached={() => load(false)}
        onEndReachedThreshold={2}
      />
    );
  }

  return (
    <View
      style={styles.container}
      onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
    >
      {body}

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  sub: { color: '#aaa', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#ff2d55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
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
  headerDivider: { color: 'rgba(255,255,255,0.4)', fontSize: 15 },
  headerActive: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});