import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/lib/auth';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: 'black', borderTopColor: '#222' },
          tabBarActiveTintColor: 'white',
          tabBarInactiveTintColor: '#888',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused, size }) => (
              <MaterialCommunityIcons
                name="home"
                size={size}
                color={focused ? 'white' : '#888'}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused, size }) => (
              <MaterialCommunityIcons
                name="account"
                size={size}
                color={focused ? 'white' : '#888'}
              />
            ),
          }}
        />
        <Tabs.Screen name="explore" options={{ href: null }} />
      </Tabs>
    </AuthProvider>
  );
}