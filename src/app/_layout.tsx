import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

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
          name="explore"
          options={{
            title: 'Search',
            tabBarIcon: ({ focused, size }) => (
              <MaterialCommunityIcons
                name="magnify"
                size={size}
                color={focused ? 'white' : '#888'}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="upload"
          options={{
            title: '',
            tabBarLabel: '',
            tabBarStyle: { display: 'none' },
            tabBarIcon: () => (
              <View
                style={{
                  width: 48,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: '#ff2d55',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialCommunityIcons name="plus" size={26} color="white" />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ focused, size }) => (
              <MaterialCommunityIcons
                name={focused ? 'message' : 'message-outline'}
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
      </Tabs>
    </AuthProvider>
  );
}