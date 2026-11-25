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

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type Account = {
  id: string;
  username: string;
  bio: string;
  avatar_url: string | null;
};

type View_ = 'list' | 'picker' | 'chat';

function Avatar({ account }: { account: Account }) {
  if (account.avatar_url) {
    return <Image source={{ uri: account.avatar_url }} style={styles.avatar} />;
  }
  return (
    <View style={[styles.avatar, styles.avatarEmpty]}>
      <Text style={styles.avatarLetter}>
        {account.username.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function Picker({
  myId,
  onPick,
}: {
  myId: string;
  onPick: (a: Account) => void;
}) {
  const [query, setQuery] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Remove characters that have a special meaning in the search
    const q = query.trim().replace(/[%_,()\\]/g, '');
    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const base = supabase
          .from('profiles')
          .select('id,username,bio,avatar_url')
          .neq('id', myId);

        const { data, error } =
          q.length > 0
            ? await base
                .ilike('username', `%${q}%`)
                .order('username')
                .limit(30)
            : await base.order('username').limit(30);

        if (cancelled) {
          return;
        }
        setFailed(error !== null);
        setAccounts(error ? [] : ((data ?? []) as Account[]));
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
  }, [query, myId]);

  return (
    <View style={styles.flex}>
      <View style={styles.searchBox}>
        <MaterialCommunityIcons name="magnify" size={22} color="#888" />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search MyTok users"
          placeholderTextColor="#777"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <MaterialCommunityIcons name="close-circle" size={20} color="#888" />
          </Pressable>
        )}
      </View>

      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="white" />
        </View>
      )}

      <FlatList
        data={accounts}
        keyExtractor={(a) => a.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
                ListEmptyComponent={
          loading ? <View /> : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>
                {failed ? 'Something went wrong' : 'No users found'}
              </Text>
              <Text style={styles.emptySub}>
                {failed
                  ? 'Check your internet connection and try again.'
                  : 'Try a different username.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onPick(item)}>
            <Avatar account={item} />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>@{item.username}</Text>
              {item.bio !== '' && (
                <Text style={styles.rowSub} numberOfLines={1}>
                  {item.bio}
                </Text>
              )}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

export default function MessagesScreen() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();

  const [view, setView] = useState<View_>('list');
  const [target, setTarget] = useState<Account | null>(null);

  const goBack = () => {
    if (view === 'chat') {
      setTarget(null);
      setView('picker');
    } else {
      setView('list');
    }
  };

  const title =
    view === 'picker'
      ? 'New message'
      : view === 'chat' && target
        ? '@' + target.username
        : 'Messages';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        {view !== 'list' ? (
          <Pressable style={styles.backBtn} onPress={goBack} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={26} color="white" />
          </Pressable>
        ) : null}
        <Text style={styles.header}>{title}</Text>
      </View>

      {view === 'list' && (
        <View style={styles.center}>
          <MaterialCommunityIcons name="message-outline" size={56} color="#666" />
          {session ? (
            <>
              <Text style={styles.title}>No messages yet</Text>
              <Text style={styles.sub}>
                Your private conversations will appear here.
              </Text>
              <Pressable
                style={styles.startBtn}
                onPress={() => setView('picker')}
              >
                <MaterialCommunityIcons
                  name="message-plus-outline"
                  size={20}
                  color="white"
                />
                <Text style={styles.startText}>Start a DM</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>Log in to send messages</Text>
              <Text style={styles.sub}>
                Go to the Profile tab to create an account or log in.
              </Text>
            </>
          )}
        </View>
      )}

      {view === 'picker' && session && (
        <Picker
          myId={session.user.id}
          onPick={(a) => {
            setTarget(a);
            setView('chat');
          }}
        />
      )}

      {view === 'chat' && target && (
        <View style={styles.center}>
          <Avatar account={target} />
          <Text style={styles.title}>@{target.username}</Text>
          <Text style={styles.sub}>
            The encrypted chat screen is coming in the next step. Nothing can
            be sent yet.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 12,
    minHeight: 40,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
  },
  header: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'center',
  },
  sub: {
    color: '#888',
    fontSize: 15,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 22,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 24,
    height: 46,
    borderRadius: 8,
    backgroundColor: '#ff2d55',
  },
  startText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
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