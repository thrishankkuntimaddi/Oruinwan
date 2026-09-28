import { useCallback, useEffect, useState } from 'react';
import api from '@services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { errorMessage } from '../settingsUi';

/**
 * The user in AuthContext can come from the login response, which leaves out
 * fields these tabs need (bio, phone, emails, hasPassword). Load /me once when
 * the tab opens and merge it into the signed-in user.
 */
export default function useFreshUser() {
    const { user, setUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get('/api/auth/me');
            if (data && typeof data === 'object') setUser((prev) => (prev ? { ...prev, ...data } : data));
        } catch (err) {
            setError(errorMessage(err, 'Could not load your account'));
        } finally {
            setLoading(false);
        }
    }, [setUser]);

    useEffect(() => { reload(); }, [reload]);

    return { user, setUser, loading, error, reload };
}
