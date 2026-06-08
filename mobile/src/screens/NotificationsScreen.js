import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { registerDeviceToken } from '../services/api';
import { cacheGet, cacheSet } from '../services/storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    loadCached();
    registerForPushNotifications();

    
    notificationListener.current = Notifications.addNotificationReceivedListener((n) => {
      const item = {
        id: n.request.identifier,
        title: n.request.content.title || 'Chttrix',
        body: n.request.content.body || '',
        receivedAt: new Date().toISOString(),
      };
      setNotifications((prev) => [item, ...prev]);
      persistNotification(item);
    });

    
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[Notifications] User tapped notification:', response.notification.request.identifier);
    });

    return () => {
      if (notificationListener.current)
        Notifications.removeNotificationSubscription(notificationListener.current);
      if (responseListener.current)
        Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  async function loadCached() {
    const cached = await cacheGet('notifications_history');
    if (cached) setNotifications(cached);
  }

  async function persistNotification(item) {
    const existing = (await cacheGet('notifications_history')) || [];
    const updated = [item, ...existing].slice(0, 100); 
    await cacheSet('notifications_history', updated);
  }

  async function registerForPushNotifications() {
    if (!Device.isDevice) {
      console.warn('[Push] Not a physical device — push tokens not available on simulator');
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert('Notifications', 'Push notification permission was denied.');
      return;
    }

    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;

      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#b8956a',
        });
      }

      await registerDeviceToken(token, Platform.OS);
      setPushEnabled(true);
      console.log('[Push] Registered token:', token);
    } catch (err) {
      console.warn('[Push] Token registration failed:', err.message);
    }
  }

  async function clearAll() {
    setNotifications([]);
    await cacheSet('notifications_history', []);
    await Notifications.dismissAllNotificationsAsync();
  }

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardDot} />
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        {!!item.body && <Text style={styles.cardBody}>{item.body}</Text>}
        <Text style={styles.cardTime}>
          {new Date(item.receivedAt).toLocaleTimeString()} · {new Date(item.receivedAt).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={clearAll}>
            <Text style={styles.clearBtn}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.statusBar}>
        <View style={[styles.statusDot, { backgroundColor: pushEnabled ? '#10b981' : '#ef4444' }]} />
        <Text style={styles.statusText}>
          {pushEnabled ? 'Push notifications active' : 'Push notifications not registered'}
        </Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.empty}>No notifications yet</Text>
        }
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  heading: { color: '#e4e4e4', fontSize: 18, fontWeight: '700' },
  clearBtn: { color: '#b8956a', fontSize: 12, fontWeight: '600' },
  statusBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { color: '#7a7a7a', fontSize: 11 },
  card: { flexDirection: 'row', backgroundColor: '#111111', borderRadius: 6, marginBottom: 6, padding: 14, borderWidth: 1, borderColor: '#191919' },
  cardDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#b8956a', marginTop: 5, marginRight: 10 },
  cardContent: { flex: 1 },
  cardTitle: { color: '#e4e4e4', fontWeight: '600', fontSize: 13 },
  cardBody: { color: '#7a7a7a', fontSize: 12, marginTop: 2 },
  cardTime: { color: '#404040', fontSize: 10, marginTop: 4 },
  empty: { color: '#404040', textAlign: 'center', marginTop: 60, fontSize: 14 },
});

