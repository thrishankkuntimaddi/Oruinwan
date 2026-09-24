import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'chttrix_jwt';
const REFRESH_KEY = 'chttrix_refresh';
const USER_KEY = 'chttrix_user';
const CHUNK = 1800; // stay under the iOS keychain / SecureStore 2 KB soft limit

const SecureStore = Platform.OS !== 'web' ? require('expo-secure-store') : null;

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

// ── Tokens ───────────────────────────────────────────────────────────────
export async function saveToken(token) { await secureSet(TOKEN_KEY, token); }
export async function getToken() {
  try { return await secureGet(TOKEN_KEY); } catch { return null; }
}
export async function removeToken() { await secureDelete(TOKEN_KEY); }

export async function saveRefreshToken(token) { await secureSet(REFRESH_KEY, token); }
export async function getRefreshToken() {
  try { return await secureGet(REFRESH_KEY); } catch { return null; }
}
export async function removeRefreshToken() { await secureDelete(REFRESH_KEY); }

// ── Large secrets (chunked) ─────────────────────────────────────────────
export async function secureSetLarge(key, value) {
  await secureDeleteLarge(key);
  const parts = Math.ceil(value.length / CHUNK);
  for (let i = 0; i < parts; i++) {
    await secureSet(`${key}_${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
  }
  await secureSet(`${key}_n`, String(parts));
}

export async function secureGetLarge(key) {
  try {
    const n = parseInt((await secureGet(`${key}_n`)) || '0', 10);
    if (!n) return null;
    let out = '';
    for (let i = 0; i < n; i++) {
      const part = await secureGet(`${key}_${i}`);
      if (part == null) return null;
      out += part;
    }
    return out;
  } catch {
    return null;
  }
}

export async function secureDeleteLarge(key) {
  try {
    const n = parseInt((await secureGet(`${key}_n`)) || '0', 10);
    for (let i = 0; i < n; i++) await secureDelete(`${key}_${i}`);
    await secureDelete(`${key}_n`);
  } catch (_) {}
}

// ── User ─────────────────────────────────────────────────────────────────
export async function saveUser(user) { await AsyncStorage.setItem(USER_KEY, JSON.stringify(user)); }
export async function getUser() {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export async function removeUser() { await AsyncStorage.removeItem(USER_KEY); }

// ── Generic cache ────────────────────────────────────────────────────────
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
export async function cacheRemove(key) { await AsyncStorage.removeItem(`chttrix_cache_${key}`); }

/** Remove every cached entry (message/channel caches) — used on logout. */
export async function cacheClearAll() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith('chttrix_cache_'));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch (_) {}
}
