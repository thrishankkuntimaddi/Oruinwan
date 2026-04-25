import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'chttrix_jwt';
const USER_KEY  = 'chttrix_user';

let SecureStore = null;

if (Platform.OS !== 'web') {
  
  SecureStore = require('expo-secure-store');
}

async function secureGet(key) {
  if (SecureStore) return SecureStore.getItemAsync(key);
  return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
}

async function secureSet(key, value) {
  if (SecureStore) return SecureStore.setItemAsync(key, value);
  if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
}

async function secureDelete(key) {
  if (SecureStore) return SecureStore.deleteItemAsync(key);
  if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
}

export async function saveToken(token) {
  await secureSet(TOKEN_KEY, token);
}

export async function getToken() {
  try {
    return await secureGet(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function removeToken() {
  await secureDelete(TOKEN_KEY);
}

export async function saveUser(user) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getUser() {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function removeUser() {
  await AsyncStorage.removeItem(USER_KEY);
}

export async function cacheSet(key, value) {
  await AsyncStorage.setItem(`chttrix_cache_${key}`, JSON.stringify(value));
}

export async function cacheGet(key) {
  try {
    const raw = await AsyncStorage.getItem(`chttrix_cache_${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function cacheRemove(key) {
  await AsyncStorage.removeItem(`chttrix_cache_${key}`);
}

const QUEUE_KEY = 'chttrix_offline_queue';

export async function enqueueAction(action) {
  const existing = (await cacheGet(QUEUE_KEY)) || [];
  existing.push({ ...action, timestamp: Date.now() });
  await cacheSet(QUEUE_KEY, existing);
}

export async function getQueue() {
  return (await cacheGet(QUEUE_KEY)) || [];
}

export async function clearQueue() {
  await cacheRemove(QUEUE_KEY);
}
