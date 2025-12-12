// client/src/hooks/useUsers.js
import { useState, useEffect, useCallback } from 'react';
import { userService } from '../services/userService';

export const useUsers = (companyId) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false); // false initially
    const [error, setError] = useState(null);

    const loadUsers = useCallback(async () => {
        if (!companyId) {
            // No company ID - personal user, no users to load
            setUsers([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await userService.getCompanyMembers(companyId);

            // Transform to expected format
            const formattedUsers = response.data.members.map(member => ({
                id: member._id,
                name: member.username,
                email: member.email,
                status: member.isOnline ? 'online' : 'offline',
                avatar: member.profilePicture,
                role: member.companyRole,
                lastSeen: member.lastLoginAt
            }));

            setUsers(formattedUsers);
        } catch (err) {
            console.error('Error loading users:', err);
            setError(err.response?.data?.message || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        if (companyId) {
            loadUsers();
        } else {
            // No companyId - set empty users and not loading
            setUsers([]);
            setLoading(false);
        }
    }, [companyId, loadUsers]);

    return { users, loading, error, refreshUsers: loadUsers };
};
