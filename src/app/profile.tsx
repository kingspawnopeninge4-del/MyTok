import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AuthFlow from '@/components/auth-flow';
import ProfileView from '@/components/profile-view';
import { useAuth } from '@/lib/auth';

export default function ProfileScreen() {
  const { session, loading } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="white" />
        </View>
      ) : session ? (
        <ProfileView
          userId={session.user.id}
          email={session.user.email ?? ''}
        />
      ) : (
        <AuthFlow />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});