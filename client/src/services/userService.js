// client/src/services/userService.js
import api from './api';

export const userService = {
    // Get current user
    getMe: () => api.get('/api/auth/me'),

    // Update profile
    updateProfile: (data) => api.put('/api/auth/me', data),

    // Get all users (company members)
    getUsers: () => api.get('/api/auth/users'),

    // Get company members
    getCompanyMembers: (companyId) => api.get(`/api/companies/${companyId}/members`),

    // Get contacts
    getContacts: () => api.get('/api/chat/contacts'),

    // Update password
    updatePassword: (data) => api.put('/api/auth/password', data)
};
