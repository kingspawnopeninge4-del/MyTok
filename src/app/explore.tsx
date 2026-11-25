import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

type Mode = 'accounts' | 'videos';

type Account = {
  id: string;
  username: string;
  bio: string;
  avatar_url: string | null;
};

type VideoResult = {
  id: string;
  caption: string;
  username: string;
};

type RawVideo = {
  id: string;
  caption: string;
  profiles: { username: string } | { username: string }[] | null;
};

export default function SearchScreen() {
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('accounts');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Remove characters that have a special meaning in the search
    const q = query.trim().replace(/[%_,()\\]/g, '');

    if (q.length === 0) {
      setAccounts([]);
      setVideos([]);
      setSearched(false);
      setFailed(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        if (mode === 'accounts') {
          const { data, error } = await supabase
            .from('profiles')
            .select('id,username,bio,avatar_url')
            .ilike('username', `%${q}%`)
            .order('username')
            .limit(30);
          if (cancelled) {
            return;
          }
          setFailed(error !== null);
          setAccounts(error ? [] : ((data ?? []) as Account[]));
        } else {
          const { data, error } = await supabase
            .from('videos')
            .select('id,caption,profiles(username)')
            .ilike('caption', `%${q}%`)
            .order('created_at', { ascending: false })
            .limit(30);
          if (cancelled) {
            return;
          }
          setFailed(error !== null);
          const raw = (error ? [] : (data ?? [])) as unknown as RawVideo[];
          setVideos(
            raw.map((v) => {
              const owner = Array.isArray(v.profiles)
                ? v.profiles[0]
                : v.profiles;
              return {
                id: v.id,
                caption: v.caption,
                username: owner ? owner.username : '',
              };
            })
          );
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setSearched(true);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, mode]);

  const renderEmpty = () => {
    if (loading) {
      return null;
    }
    if (failed) {
      return (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptySub}>
            Check your internet connection and try again.
          </Text>
        </View>
      );
    }
    if (!searched) {
      return (
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="magnify" size={56} color="#666" />
          <Text style={styles.emptyTitle}>Search MyTok</Text>
          <Text style={styles.emptySub}>
            Find creators by username, or videos by caption.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>No results</Text>
        <Text style={styles.emptySub}>Try a different search.</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.searchBox}>
        <MaterialCommunityIcons name="magnify" size={22} color="#888" />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor="#777"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <MaterialCommunityIcons name="close-circle" size={20} color="#888" />
          </Pressable>
        )}
      </View>

      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeBtn, mode === 'accounts' && styles.modeBtnActive]}
          onPress={() => setMode('accounts')}
        >
          <Text
            style={[
              styles.modeText,
              mode === 'accounts' && styles.modeTextActive,
            ]}
          >
            Accounts
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === 'videos' && styles.modeBtnActive]}
          onPress={() => setMode('videos')}
        >
          <Text
            style={[
              styles.modeText,
              mode === 'videos' && styles.modeTextActive,
            ]}
          >
            Videos
          </Text>
        </Pressable>
      </View>

      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="white" />
        </View>
      )}

      {mode === 'accounts' ? (
        <FlatList
          data={accounts}
          keyExtractor={(a) => a.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={renderEmpty}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <Text style={styles.avatarLetter}>
                    {item.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>@{item.username}</Text>
                {item.bio !== '' && (
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {item.bio}
                  </Text>
                )}
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(v) => v.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={renderEmpty}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={[styles.thumb]}>
                <MaterialCommunityIcons name="play" size={26} color="white" />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {item.caption !== '' ? item.caption : 'Untitled video'}
                </Text>
                {item.username !== '' && (
                  <Text style={styles.rowSub}>@{item.username}</Text>
                )}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: '#1c1c1e',
    gap: 8,
  },
  input: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    height: 44,
  },
  modeRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  modeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#1c1c1e',
  },
  modeBtnActive: {
    backgroundColor: 'white',
  },
  modeText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
  },
  modeTextActive: {
    color: 'black',
  },
  loadingWrap: {
    paddingVertical: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarEmpty: {
    backgroundColor: '#3a3a3c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  thumb: {
    width: 50,
    height: 66,
    borderRadius: 6,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    marginLeft: 12,
  },
  rowTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  rowSub: {
    color: '#999',
    fontSize: 14,
    marginTop: 2,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'center',
  },
  emptySub: {
    color: '#888',
    fontSize: 15,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 22,
  },
});