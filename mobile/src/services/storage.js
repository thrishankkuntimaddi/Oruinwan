/**
 * Chttrix Mobile — Secure Storage Service
 * Wraps expo-secure-store for JWT tokens and AsyncStorage for data caching.
 */
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'chttrix_jwt';
const USER_KEY = 'chttrix_user';

// ─── JWT Token ────────────────────────────────────────────────────────────────

export async function saveToken(token) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function removeToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ─── User ─────────────────────────────────────────────────────────────────────

export async function saveUser(user) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getUser() {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function removeUser() {
  await AsyncStorage.removeItem(USER_KEY);
}

// ─── Generic Cache ────────────────────────────────────────────────────────────

/**
 * Persist any JSON-serialisable value under a namespaced key.
 * @param {string} key
 * @param {*} value
 */
export async function cacheSet(key, value) {
  await AsyncStorage.setItem(`chttrix_cache_${key}`, JSON.stringify(value));
}

/**
 * Retrieve a cached value. Returns null if missing or on error.
 * @param {string} key
 * @returns {Promise<*>}
 */
export async function cacheGet(key) {
  try {
    const raw = await AsyncStorage.getItem(`chttrix_cache_${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Remove a specific cached entry.
 * @param {string} key
 */
export async function cacheRemove(key) {
  await AsyncStorage.removeItem(`chttrix_cache_${key}`);
}

// ─── Offline Action Queue ─────────────────────────────────────────────────────
const QUEUE_KEY = 'chttrix_offline_queue';

/**
 * Append an action to the offline queue.
 * @param {{ type: string, payload: object }} action
 */
export async function enqueueAction(action) {
  const existing = (await cacheGet(QUEUE_KEY)) || [];
  existing.push({ ...action, timestamp: Date.now() });
  await cacheSet(QUEUE_KEY, existing);
}

/**
 * Read the full offline queue.
 * @returns {Promise<Array>}
 */
export async function getQueue() {
  return (await cacheGet(QUEUE_KEY)) || [];
}

/**
 * Clear the offline queue (called after successful sync).
 */
export async function clearQueue() {
  await cacheRemove(QUEUE_KEY);
}
