import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { Component, ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AuthFlow from '@/components/auth-flow';
import ProfileView from '@/components/profile-view';
import SettingsView from '@/components/settings-view';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

class Boundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(e: Error) {
    return { error: e.message + '\n\n' + (e.stack ?? '').slice(0, 600) };
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView
          style={{ flex: 1, backgroundColor: 'black' }}
          contentContainerStyle={{ padding: 24 }}
        >
          <Text style={{ color: '#ff6b6b', fontSize: 15 }}>
            {this.state.error}
          </Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

export default function ProfileScreen() {
  const { session, loading } = useAuth();
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focused, setFocused] = useState(true);
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsubFocus = navigation.addListener('focus', () => setFocused(true));
    const unsubBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      unsubFocus();
      unsubBlur();
    };
  }, [navigation]);

  useEffect(() => {
    setStatusBarStyle(focused && !dark && session ? 'dark' : 'light');
  }, [focused, dark, session]);

  useEffect(() => {
    if (!session) {
      setSettingsOpen(false);
      spin.setValue(0);
    }
  }, [session, spin]);

  const toggleSettings = () => {
    const next = !settingsOpen;
    setSettingsOpen(next);
    Animated.spring(spin, {
      toValue: next ? 1 : 0,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const bg = session ? colors.background : '#000000';

  return (
    <View
      style={[styles.container, { paddingTop: insets.top, backgroundColor: bg }]}
    >
      <Boundary>
        {session && (
          <View style={styles.header}>
            <Pressable
              style={styles.gearBtn}
              onPress={toggleSettings}
              hitSlop={12}
            >
              <Animated.View style={{ transform: [{ rotate }] }}>
                <MaterialCommunityIcons
                  name={settingsOpen ? 'cog' : 'cog-outline'}
                  size={28}
                  color={colors.text}
                />
              </Animated.View>
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {settingsOpen ? 'Settings' : 'Profile'}
            </Text>
          </View>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : session ? (
          <View style={styles.flex}>
            {settingsOpen ? (
              <SettingsView email={session.user.email ?? ''} />
            ) : (
              <ProfileView
                userId={session.user.id}
                email={session.user.email ?? ''}
              />
            )}
          </View>
        ) : (
          <AuthFlow />
        )}
      </Boundary>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearBtn: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
});