import './services/queueHandlers';
import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaProvider, SafeAreaInsetsContext, useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import WorkspaceSelectScreen from './screens/WorkspaceSelectScreen';
import HomeScreen from './screens/HomeScreen';
import MessagesScreen from './screens/MessagesScreen';
import ChannelsScreen from './screens/ChannelsScreen';
import TasksScreen from './screens/TasksScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import ChannelChatScreen from './screens/ChannelChatScreen';
import DMChatScreen from './screens/DMChatScreen';
import NotesScreen from './screens/NotesScreen';
import NoteEditorScreen from './screens/NoteEditorScreen';
import FilesScreen from './screens/FilesScreen';
import KnowledgeScreen from './screens/KnowledgeScreen';
import KnowledgePageScreen from './screens/KnowledgePageScreen';
import SettingsScreen from './screens/SettingsScreen';
import UnlockScreen from './screens/UnlockScreen';
import ToastHost from './components/ToastHost';
import ConnectivityBanner, { useConnectivityBanner } from './components/ConnectivityBanner';
import { AppProvider, useApp } from './context/AppContext';
import { fetchUnreadCount } from './services/api/notifications';
import { on } from './services/events';
import { useSocketEvent } from './hooks/useSocketEvent';
import { T } from './theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef();

const NAV_THEME = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: T.bgBase, card: T.bgBase, text: T.textPrimary, border: T.borderSubtle, primary: T.accent },
};

const TAB_ICONS = { Home: '🏠', DMs: '💬', Channels: '#', Tasks: '📋', Notifications: '🔔' };

function TabIcon({ label, focused }) {
  const isHash = label === 'Channels';
  return (
    <View style={{
      width: 28, height: 28, borderRadius: isHash ? 6 : 14,
      backgroundColor: focused ? T.accent : 'transparent', alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{
        fontSize: isHash ? 15 : 18, fontWeight: isHash ? '900' : '400',
        opacity: focused ? 1 : 0.45, color: focused ? T.bgBase : T.textSecondary,
      }}>
        {TAB_ICONS[label] || '●'}
      </Text>
    </View>
  );
}

function useUnreadNotifications() {
  const { workspace } = useApp();
  const wsId = workspace?._id;
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!wsId) return undefined;
    let cancelled = false;
    const refresh = () => fetchUnreadCount(wsId)
      .then(({ data }) => { if (!cancelled) setCount(data?.count ?? data?.unreadCount ?? 0); })
      .catch(() => {});
    refresh();
    const a = on('notifications:changed', refresh);
    const b = on('notifications:count', (n) => { if (typeof n === 'number') setCount(n); });
    const c = on('socket:reconnect', refresh);
    return () => { cancelled = true; a(); b(); c(); };
  }, [wsId]);
  useSocketEvent('notification:new', ({ notification } = {}) => {
    if (!notification?.workspaceId || String(notification.workspaceId) === String(wsId)) setCount((n) => n + 1);
  }, !!wsId);
  return count;
}

function MainTabs() {
  const unread = useUnreadNotifications();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
        tabBarActiveTintColor: T.accent,
        tabBarInactiveTintColor: T.textMuted,
        tabBarStyle: { backgroundColor: T.bgBase, borderTopColor: T.borderSubtle, borderTopWidth: 1 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="DMs" component={MessagesScreen} />
      <Tab.Screen name="Channels" component={ChannelsScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined, tabBarBadgeStyle: { backgroundColor: T.accent, color: T.bgBase } }}
      />
    </Tab.Navigator>
  );
}

function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: T.bgBase, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 72, height: 72, borderRadius: 16, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Text style={{ color: T.bgBase, fontSize: 32, fontWeight: '800' }}>C</Text>
      </View>
      <Text style={{ color: T.textMuted, fontSize: 12, letterSpacing: 2, fontWeight: '600' }}>CHTTRIX</Text>
    </View>
  );
}

function RootNavigator() {
  const { status, workspace } = useApp();
  const insets = useSafeAreaInsets();
  const banner = useConnectivityBanner();
  const pendingNav = useRef(null);

  // Tapping a push notification opens the Notifications tab.
  useEffect(() => {
    const go = () => {
      if (navigationRef.isReady() && status === 'signedIn' && workspace) {
        navigationRef.navigate('Main', { screen: 'Notifications' });
      } else {
        pendingNav.current = 'Notifications';
      }
    };
    const sub = Notifications.addNotificationResponseReceivedListener(go);
    return () => sub.remove();
  }, [status, workspace]);

  if (status === 'loading') return <Splash />;

  // When the banner occupies the status-bar area, screens must not pad for it again.
  const screenInsets = banner ? { ...insets, top: 0 } : insets;

  return (
    <View style={{ flex: 1, backgroundColor: T.bgBase }}>
      <ConnectivityBanner banner={banner} topInset={insets.top} />
      <SafeAreaInsetsContext.Provider value={screenInsets}>
        <NavigationContainer
          ref={navigationRef}
          theme={NAV_THEME}
          onReady={() => {
            if (pendingNav.current && status === 'signedIn' && workspace) {
              navigationRef.navigate('Main', { screen: pendingNav.current });
              pendingNav.current = null;
            }
          }}
        >
          <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: T.bgBase } }}>
            {status !== 'signedIn' ? (
              <>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
              </>
            ) : (
              <>
                {workspace ? (
                  <>
                    <Stack.Screen name="Main" component={MainTabs} />
                    <Stack.Screen name="WorkspaceSelect" component={WorkspaceSelectScreen} />
                  </>
                ) : (
                  <>
                    <Stack.Screen name="WorkspaceSelect" component={WorkspaceSelectScreen} />
                    <Stack.Screen name="Main" component={MainTabs} />
                  </>
                )}
                <Stack.Screen name="ChannelChat" component={ChannelChatScreen} options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="DMChat" component={DMChatScreen} options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="Notes" component={NotesScreen} options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="NoteEditor" component={NoteEditorScreen} options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="Files" component={FilesScreen} options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="Knowledge" component={KnowledgeScreen} options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="KnowledgePage" component={KnowledgePageScreen} options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="Unlock" component={UnlockScreen} options={{ presentation: 'modal' }} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaInsetsContext.Provider>
      <ToastHost />
    </View>
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
