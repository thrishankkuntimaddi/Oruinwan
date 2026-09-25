import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import Toast from '../shared/components/ui/Toast';

const ToastContext = createContext();
export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within a ToastProvider');
    return ctx;
};

const MAX_VISIBLE = 4;

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    /**
     * showToast(message, type, duration, options)
     *   type: 'success' | 'error' | 'warning' | 'info' | 'message'
     *   options: { title, avatar, onClick, key } — `key` replaces an existing
     *   toast with the same key (one toast per conversation).
     */
    const showToast = useCallback((message, type = 'success', duration = 3500, options = {}) => {
        const id = Date.now() + Math.random();
        setToasts(prev => {
            const kept = options.key ? prev.filter(t => t.key !== options.key) : prev;
            return [...kept, { id, message, type, duration, ...options }].slice(-MAX_VISIBLE);
        });
        return id;
    }, []);

    const contextValue = useMemo(() => ({ showToast, removeToast }), [showToast, removeToast]);

    return (
        <ToastContext.Provider value={contextValue}>
            {children}
            <div style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '6px',
                pointerEvents: 'none',
            }}>
                {toasts.map(t => (
                    <div key={t.id} style={{ pointerEvents: 'auto' }}>
                        <Toast
                            message={t.message}
                            type={t.type}
                            duration={t.duration}
                            title={t.title}
                            avatar={t.avatar}
                            onClick={t.onClick}
                            onClose={() => removeToast(t.id)}
                        />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
