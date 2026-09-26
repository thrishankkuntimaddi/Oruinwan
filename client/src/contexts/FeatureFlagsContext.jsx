import React, { createContext, useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../services/api';
import logger from '../utils/logger';

// Release flags served by GET /api/flags (server/src/shared/featureFlags).
// Anything not reported as enabled is treated as off, including while loading
// and when the request fails, so half-built screens never flash into view.
const FeatureFlagsContext = createContext({ flags: {}, loaded: false });

export function FeatureFlagsProvider({ children }) {
    const [state, setState] = useState({ flags: {}, loaded: false });

    useEffect(() => {
        let cancelled = false;
        api.get('/api/flags')
            .then(({ data }) => {
                if (!cancelled) setState({ flags: data?.flags || {}, loaded: true });
            })
            .catch((err) => {
                logger.error('Failed to load feature flags:', err?.message || err);
                if (!cancelled) setState({ flags: {}, loaded: true });
            });
        return () => { cancelled = true; };
    }, []);

    return (
        <FeatureFlagsContext.Provider value={state}>
            {children}
        </FeatureFlagsContext.Provider>
    );
}

export function useFeatureFlags() {
    return useContext(FeatureFlagsContext);
}

export function useFlag(name) {
    const { flags } = useContext(FeatureFlagsContext);
    return flags[name] === true;
}

/**
 * Route guard: renders children only when the flag is on. While flags load it
 * renders nothing; once loaded and off it redirects (default "/").
 */
export function FeatureRoute({ flag, redirectTo = '/', children }) {
    const { flags, loaded } = useContext(FeatureFlagsContext);
    if (!loaded) return null;
    if (flags[flag] !== true) return <Navigate to={redirectTo} replace />;
    return children;
}

export default FeatureFlagsContext;
