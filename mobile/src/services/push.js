/**
 * Push notifications: register once per signed-in session, unregister on logout.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerDeviceToken, unregisterDeviceToken } from './api/notifications';

const PUSH_TOKEN_KEY = 'chttrix_push_token';
let registerPromise = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function obtainToken() {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  // Android: the channel must exist before the permission prompt (Android 13+).
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#b8956a',
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return data || null;
}

/** Idempotent for the lifetime of the session. */
export function registerForPush() {
  if (!registerPromise) {
    registerPromise = (async () => {
      const token = await obtainToken();
      if (!token) return null;
      await registerDeviceToken(token, Platform.OS);
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
      return token;
    })().catch((err) => {
      console.warn('[Push] registration failed:', err?.message);
      registerPromise = null;
      return null;
    });
  }
  return registerPromise;
}

export async function unregisterPush() {
  registerPromise = null;
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (token) await unregisterDeviceToken(token);
  } catch (_) {
    // best effort — the session is being torn down anyway
  } finally {
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => {});
  }
}
