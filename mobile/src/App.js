import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';

import LoginScreen from './screens/LoginScreen';
import WorkspaceSelectScreen from './screens/WorkspaceSelectScreen';
import HomeScreen from './screens/HomeScreen';
import MessagesScreen from './screens/MessagesScreen';
import ChannelsScreen from './screens/ChannelsScreen';
import TasksScreen from './screens/TasksScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import { AppProvider } from './context/AppContext';
import { getToken } from './services/storage';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home: '🏠',
  DMs: '💬',
  Channels: '#',
  Tasks: '📋',
  Notifications: '🔔',
};

function TabIcon({ label, focused }) {
  const icon = TAB_ICONS[label] || '●';
  const isHash = label === 'Channels';
  return (
    <View style={{
      width: 28, height: 28,
      borderRadius: isHash ? 8 : 14,
      backgroundColor: focused ? '#6366f1' : 'transparent',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{
        fontSize: isHash ? 15 : 18,
        fontWeight: isHash ? '900' : '400',
        opacity: focused ? 1 : 0.5,
        color: focused ? '#fff' : '#94a3b8',
      }}>
        {icon}
      </Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <TabIcon label={route.name} focused={focused} />
        ),
        tabBarLabel: route.name,
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#475569',
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor: '#1e293b',
          paddingBottom: 6,
          height: 58,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#f1f5f9',
        headerTitleStyle: { fontWeight: '700' },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="DMs" component={MessagesScreen} />
      <Tab.Screen name="Channels" component={ChannelsScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const [initialRoute, setInitialRoute] = useState(null); 

  useEffect(() => {
    (async () => {
      const token = await getToken();
      setInitialRoute(token ? 'Main' : 'Login');
    })();
  }, []);

  if (initialRoute === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{
          width: 72, height: 72, borderRadius: 20,
          backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center',
          marginBottom: 14,
        }}>
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800' }}>C</Text>
        </View>
        <Text style={{ color: '#94a3b8', fontSize: 14, letterSpacing: 1 }}>CHTTRIX</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false, animation: 'fade' }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="WorkspaceSelect" component={WorkspaceSelectScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <RootNavigator />
        <StatusBar style="light" />
      </AppProvider>
    </SafeAreaProvider>
  );
}
