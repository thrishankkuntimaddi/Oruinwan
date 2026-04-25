import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import api from '@services/api';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
    const { user, setUser } = useAuth();

    
    
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('theme');
            return savedTheme || 'dark';
        }
        return 'dark';
    });

    
    useEffect(() => {
        if (user?.preferences?.theme) {
            const backendTheme = user.preferences.theme;
            setTheme(backendTheme);
        }
    
    }, [user?.preferences?.theme]);

    
    const handleSetTheme = async (newTheme) => {
        setTheme(newTheme);

        
        if (user) {
            
            
            const updatedUser = {
                ...user,
                preferences: {
                    ...user.preferences,
                    theme: newTheme
                }
            };
            setUser(updatedUser);

            try {
                await api.put('/api/auth/me', {
                    preferences: { theme: newTheme }
                });

            } catch (err) {
                console.error("Failed to save theme preference:", err);
                
                
            }
        }
    };

    useEffect(() => {
        const root = window.document.documentElement;

        
        root.classList.remove('light', 'dark');

        if (theme === 'system' || theme === 'auto') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(systemTheme);
        } else {
            root.classList.add(theme);
        }

        
        localStorage.setItem('theme', theme);

    }, [theme]);

    
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

    
    
    const toggleTheme = (newTheme) => {
        if (newTheme && ['light', 'dark', 'auto', 'system'].includes(newTheme)) {
            handleSetTheme(newTheme);
        } else {
            handleSetTheme(theme === 'dark' ? 'light' : 'dark');
        }
    };

    const value = {
        theme,
        setTheme: handleSetTheme,
        toggleTheme 
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};
