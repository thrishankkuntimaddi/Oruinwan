import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    REGION_DEFAULTS, formatDate, formatTime, formatDateTime, formatDayHeading, dayKey,
} from '../utils/userDateFormat';

/**
 * The signed-in user's preferences as the rest of the client reads them.
 *
 * Source of truth is `user.preferences` in AuthContext (from GET /api/auth/me).
 * ThemeProvider mirrors it into this small store (syncUserPreferences) so that
 * hot paths — every chat message, socket emits — can read preferences without
 * subscribing to the whole AuthContext. The last known values are cached in
 * localStorage so dates render in the right format before /me has loaded.
 *
 * Settings tabs call useApplyPreferences()(patch) after a successful save:
 * that updates AuthContext's user, which re-syncs this store, which re-renders
 * every consumer.
 */

export const PRIVACY_DEFAULTS = Object.freeze({ readReceipts: true, typingIndicators: true, allowDiscovery: true });
export const TEXT_SIZES = ['small', 'default', 'large', 'larger'];
export const APPEARANCE_DEFAULTS = Object.freeze({ textSize: 'default' });

const CACHE_KEY = 'oruinwan.userPreferences';

const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);

export function normalizePreferences(raw) {
    const p = raw && typeof raw === 'object' ? raw : {};
    const privacy = p.privacy && typeof p.privacy === 'object' ? p.privacy : {};
    const region = p.region && typeof p.region === 'object' ? p.region : {};
    const appearance = p.appearance && typeof p.appearance === 'object' ? p.appearance : {};
    return {
        theme: typeof p.theme === 'string' ? p.theme : undefined,
        privacy: {
            readReceipts: bool(privacy.readReceipts, PRIVACY_DEFAULTS.readReceipts),
            typingIndicators: bool(privacy.typingIndicators, PRIVACY_DEFAULTS.typingIndicators),
            allowDiscovery: bool(privacy.allowDiscovery, PRIVACY_DEFAULTS.allowDiscovery),
        },
        region: {
            language: region.language || REGION_DEFAULTS.language,
            timezone: region.timezone || REGION_DEFAULTS.timezone,
            dateFormat: region.dateFormat || REGION_DEFAULTS.dateFormat,
            timeFormat: region.timeFormat || REGION_DEFAULTS.timeFormat,
        },
        appearance: {
            textSize: TEXT_SIZES.includes(appearance.textSize) ? appearance.textSize : APPEARANCE_DEFAULTS.textSize,
        },
    };
}

function readCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

let snapshot = normalizePreferences(typeof window !== 'undefined' ? readCache() : null);
let snapshotJson = JSON.stringify(snapshot);
const listeners = new Set();

/** Current preferences, for non-React code (socket emits, formatters). */
export const getUserPreferences = () => snapshot;

/** Replace the store's contents from `user.preferences` (no-op when unchanged). */
export function syncUserPreferences(rawPreferences) {
    const next = normalizePreferences(rawPreferences);
    const json = JSON.stringify(next);
    if (json === snapshotJson) return;
    snapshot = next;
    snapshotJson = json;
    try { localStorage.setItem(CACHE_KEY, json); } catch { /* storage blocked */ }
    listeners.forEach((l) => l());
}

const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

/** { theme, privacy, region, appearance } with defaults filled in. */
export function useUserPreferences() {
    return useSyncExternalStore(subscribe, getUserPreferences, getUserPreferences);
}

/**
 * Returns apply(patch): merge a saved preferences patch into AuthContext's user
 * (one level deep: { privacy: {...} } merges into user.preferences.privacy).
 */
export function useApplyPreferences() {
    const { setUser } = useAuth() || {};
    return useCallback((patch) => {
        if (!setUser || !patch) return;
        setUser((prev) => {
            if (!prev) return prev;
            const current = prev.preferences || {};
            const merged = { ...current };
            Object.entries(patch).forEach(([key, value]) => {
                merged[key] = value && typeof value === 'object' && !Array.isArray(value)
                    ? { ...(current[key] || {}), ...value }
                    : value;
            });
            // ThemeProvider's effect mirrors the new user.preferences into the store.
            return { ...prev, preferences: merged };
        });
    }, [setUser]);
}

/**
 * Formatters bound to the user's region preferences; re-renders when they change.
 *   const fmt = useDateFormatter(); fmt.time(msg.createdAt)
 */
export function useDateFormatter() {
    const { region } = useUserPreferences();
    return useMemo(() => ({
        region,
        date: (v, opts) => formatDate(v, region, opts),
        time: (v) => formatTime(v, region),
        dateTime: (v, opts) => formatDateTime(v, region, opts),
        dayHeading: (v, opts) => formatDayHeading(v, region, opts),
        dayKey: (v, opts) => dayKey(v, region, opts),
    }), [region]);
}
