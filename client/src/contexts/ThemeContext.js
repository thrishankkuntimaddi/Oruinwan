import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import api from '@services/api';
import logger from '../utils/logger';
import { syncUserPreferences, TEXT_SIZES } from '../hooks/useUserPreferences';
import '../styles/userPreferences.css';

/**
 * Appearance preferences, applied to <html>:
 *   theme       'light' | 'dark' | 'auto' (follows the OS, live) → class light/dark
 *   textSize    'small' | 'default' | 'large' | 'larger'   → data-text-size
 *   reduceMotion (this device only)                        → data-reduce-motion
 * Theme and text size are saved to the account (PUT /api/auth/me) and cached in
 * localStorage so they apply before the user has loaded. This provider also
 * mirrors user.preferences into the useUserPreferences store.
 */

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

const THEME_KEY = 'theme';
const TEXT_SIZE_KEY = 'oruinwan.textSize';
const REDUCE_MOTION_KEY = 'oruinwan.reduceMotion';

const store = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage blocked */ } },
};

const normalizeTheme = (t) => (t === 'system' ? 'auto' : ['light', 'dark', 'auto'].includes(t) ? t : null);
const normalizeTextSize = (s) => (TEXT_SIZES.includes(s) ? s : 'default');

const darkQuery = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);

// Apply cached text size / motion before first render so there is no flash.
if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.setAttribute('data-text-size', normalizeTextSize(store.get(TEXT_SIZE_KEY)));
    if (store.get(REDUCE_MOTION_KEY) === 'true') root.setAttribute('data-reduce-motion', 'true');
}

export const ThemeProvider = ({ children }) => {
    const { user, setUser } = useAuth();

    const [theme, setThemeState] = useState(() => normalizeTheme(store.get(THEME_KEY)) || 'dark');
    const [systemDark, setSystemDark] = useState(() => darkQuery()?.matches ?? true);
    const [textSize, setTextSizeState] = useState(() => normalizeTextSize(store.get(TEXT_SIZE_KEY)));
    const [reduceMotion, setReduceMotionState] = useState(() => store.get(REDUCE_MOTION_KEY) === 'true');

    // Account values win once the user has loaded.
    const serverTheme = normalizeTheme(user?.preferences?.theme);
    useEffect(() => { if (serverTheme) setThemeState(serverTheme); }, [serverTheme]);

    const serverTextSize = user?.preferences?.appearance?.textSize;
    useEffect(() => { if (TEXT_SIZES.includes(serverTextSize)) setTextSizeState(serverTextSize); }, [serverTextSize]);

    // Mirror preferences for useUserPreferences() consumers.
    const preferences = user?.preferences;
    useEffect(() => { if (user) syncUserPreferences(preferences); }, [user, preferences]);

    // Follow the OS setting live (used when theme is 'auto').
    useEffect(() => {
        const mq = darkQuery();
        if (!mq) return undefined;
        const onChange = (e) => setSystemDark(e.matches);
        setSystemDark(mq.matches);
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else mq.addListener?.(onChange); // Safari < 14
        return () => {
            if (mq.removeEventListener) mq.removeEventListener('change', onChange);
            else mq.removeListener?.(onChange);
        };
    }, []);

    const resolvedTheme = theme === 'auto' ? (systemDark ? 'dark' : 'light') : theme;

    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(resolvedTheme);
        root.style.colorScheme = resolvedTheme;
        store.set(THEME_KEY, theme);
    }, [theme, resolvedTheme]);

    useEffect(() => {
        document.documentElement.setAttribute('data-text-size', textSize);
        store.set(TEXT_SIZE_KEY, textSize);
    }, [textSize]);

    useEffect(() => {
        const root = document.documentElement;
        if (reduceMotion) root.setAttribute('data-reduce-motion', 'true');
        else root.removeAttribute('data-reduce-motion');
        store.set(REDUCE_MOTION_KEY, reduceMotion ? 'true' : 'false');
    }, [reduceMotion]);

    /** Merge into user.preferences locally, then save; resolves false if saving failed. */
    const savePreference = useCallback(async (patch) => {
        if (!user) return true;
        setUser((prev) => (prev ? { ...prev, preferences: { ...(prev.preferences || {}), ...patch } } : prev));
        try {
            await api.put('/api/auth/me', { preferences: patch });
            return true;
        } catch (err) {
            logger.error('Failed to save appearance preference:', err);
            return false;
        }
    }, [user, setUser]);

    const setTheme = useCallback((next) => {
        const t = normalizeTheme(next);
        if (!t) return Promise.resolve(false);
        setThemeState(t);
        return savePreference({ theme: t });
    }, [savePreference]);

    const toggleTheme = useCallback((next) => {
        if (normalizeTheme(next)) return setTheme(next);
        return setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    }, [setTheme, resolvedTheme]);

    const setTextSize = useCallback((next) => {
        const s = normalizeTextSize(next);
        setTextSizeState(s);
        const appearance = { ...(user?.preferences?.appearance || {}), textSize: s };
        return savePreference({ appearance });
    }, [savePreference, user]);

    const setReduceMotion = useCallback((on) => setReduceMotionState(!!on), []);

    const value = useMemo(() => ({
        theme, resolvedTheme, setTheme, toggleTheme,
        textSize, setTextSize,
        reduceMotion, setReduceMotion,
    }), [theme, resolvedTheme, setTheme, toggleTheme, textSize, setTextSize, reduceMotion, setReduceMotion]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};
