import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
    const { user, setUser } = useAuth();

    // state: 'light' | 'dark' | 'auto'
    // Initialize from local storage first to prevent flash, will sync with user pref later
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('theme');
            return savedTheme || 'light';
        }
        return 'light';
    });

    // 1. Sync FROM backend (user preference) when user loads/changes
    useEffect(() => {
        // Only sync if the user has a preference and it's different from current
        if (user?.preferences?.theme) {
            const backendTheme = user.preferences.theme;
            if (backendTheme !== theme) {
                console.log(`🎨 Syncing theme from backend: ${backendTheme}`);
                setTheme(backendTheme);
            }
        }
    }, [user, theme]);

    // 2. Sync TO backend when theme changes (if user is logged in)
    const handleSetTheme = async (newTheme) => {
        setTheme(newTheme);

        // Save to backend if user is logged in
        if (user) {
            // Optimistically update the user object in AuthContext immediately
            // This prevents the "Sync FROM backend" effect from reverting our change
            const updatedUser = {
                ...user,
                preferences: {
                    ...user.preferences,
                    theme: newTheme
                }
            };
            setUser(updatedUser);

            console.log(`💾 Saving theme preference: ${newTheme}`);
            try {
                await api.put('/api/auth/me', {
                    preferences: { theme: newTheme }
                });
                console.log(`✅ Theme saved successfully`);
            } catch (err) {
                console.error("Failed to save theme preference:", err);
                // Optional: Revert on failure if strict consistency is needed
                // But generally better to leave the UI in the state the user picked
            }
        }
    };

    useEffect(() => {
        const root = window.document.documentElement;

        // Remove both potential classes to start fresh
        root.classList.remove('light', 'dark');

        if (theme === 'system' || theme === 'auto') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(systemTheme);
        } else {
            root.classList.add(theme);
        }

        // Save to local storage
        localStorage.setItem('theme', theme);

    }, [theme]);

    // Listen for system changes if mode is auto
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = () => {
            if (theme === 'auto') {
                const root = window.document.documentElement;
                root.classList.remove('light', 'dark');
                root.classList.add(mediaQuery.matches ? 'dark' : 'light');
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    const value = {
        theme,
        setTheme: handleSetTheme
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};
