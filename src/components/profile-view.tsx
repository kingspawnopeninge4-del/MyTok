import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { useAuth } from '@/lib/auth';
import { uploadAvatar } from '@/lib/avatar';
import { supabase } from '@/lib/supabase';

type ProfileRow = {
  username: string;
  bio: string;
  avatar_url: string | null;
};

type VideoRow = {
  id: string;
  caption: string;
};

export default function ProfileView({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const { profileVersion, bumpProfile } = useAuth();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [newUri, setNewUri] = useState<string | null>(null);
  const [newB64, setNewB64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [p, fr, fg, v] = await Promise.all([
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
            .select('id,caption')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
        ]);
        if (cancelled) {
          return;
        }
        setProfile(p.data ?? null);
        setFollowers(fr.count ?? 0);
        setFollowing(fg.count ?? 0);
        setVideos(v.data ?? []);
      } catch {
        // keep whatever we have
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, profileVersion]);

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

  const logOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="white" />
      </View>
    );
  }

  const name = profile ? profile.username : email.split('@')[0];
  const shownAvatar = newUri ?? (profile ? profile.avatar_url : null);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.top}>
        <Pressable onPress={editing ? pickPhoto : undefined} disabled={!editing}>
          {shownAvatar ? (
            <Image source={{ uri: shownAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <Text style={styles.avatarLetter}>
                {name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {editing && (
            <View style={styles.cameraBadge}>
              <MaterialCommunityIcons name="camera" size={16} color="white" />
            </View>
          )}
        </Pressable>

        <Text style={styles.username}>@{name}</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{following}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{followers}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{videos.length}</Text>
            <Text style={styles.statLabel}>Videos</Text>
          </View>
        </View>

        {editing ? (
          <View style={styles.editWrap}>
            <TextInput
              style={styles.bioInput}
              placeholder="Write a short bio"
              placeholderTextColor="#777"
              multiline
              maxLength={150}
              value={bioDraft}
              onChangeText={setBioDraft}
            />
            {error !== '' && <Text style={styles.error}>{error}</Text>}
            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.smallBtn, styles.cancelBtn]}
                onPress={() => setEditing(false)}
                disabled={saving}
              >
                <Text style={styles.smallBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.smallBtn, styles.saveBtn, saving && styles.disabled]}
                onPress={save}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.smallBtnText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.editWrap}>
            <Text style={styles.bio}>
              {profile && profile.bio !== '' ? profile.bio : 'No bio yet.'}
            </Text>
            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.smallBtn, styles.cancelBtn]}
                onPress={startEdit}
              >
                <Text style={styles.smallBtnText}>Edit profile</Text>
              </Pressable>
              <Pressable
                style={[styles.smallBtn, styles.cancelBtn]}
                onPress={logOut}
              >
                <Text style={styles.smallBtnText}>Log out</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <View style={styles.tabBar}>
        <MaterialCommunityIcons name="view-grid-outline" size={24} color="white" />
      </View>

      {videos.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="video-outline" size={44} color="#666" />
          <Text style={styles.emptyTitle}>No videos yet</Text>
          <Text style={styles.emptySub}>Videos you upload will show up here.</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {videos.map((v) => (
            <View key={v.id} style={styles.tileOuter}>
              <View style={styles.tile}>
                <MaterialCommunityIcons name="play" size={30} color="white" />
                <Text style={styles.tileCaption} numberOfLines={2}>
                  {v.caption}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 40,
  },
  top: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarEmpty: {
    backgroundColor: '#3a3a3c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: 'white',
    fontSize: 40,
    fontWeight: 'bold',
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ff2d55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 18,
    gap: 36,
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 2,
  },
  editWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 16,
  },
  bio: {
    color: 'white',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
  },
  bioInput: {
    alignSelf: 'stretch',
    minHeight: 80,
    borderRadius: 8,
    backgroundColor: '#1c1c1e',
    color: 'white',
    padding: 12,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  smallBtn: {
    minWidth: 120,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cancelBtn: {
    backgroundColor: '#2c2c2e',
  },
  saveBtn: {
    backgroundColor: '#ff2d55',
  },
  smallBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    color: '#ff6b6b',
    marginTop: 10,
    fontSize: 14,
  },
  tabBar: {
    marginTop: 24,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#3a3a3c',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
  },
  emptySub: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tileOuter: {
    width: '33.3333%',
    padding: 1,
  },
  tile: {
    aspectRatio: 9 / 16,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  tileCaption: {
    color: '#ccc',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
});