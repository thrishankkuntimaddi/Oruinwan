import api from './api';

export const userService = {
    
    getMe: () => api.get('/api/auth/me'),

    
    updateProfile: (data) => api.put('/api/auth/me', data),

    
    getUsers: () => api.get('/api/auth/users'),

    
    getCompanyMembers: (companyId) => api.get(`/api/companies/${companyId}/members`),

    
    getContacts: () => api.get('/api/chat/contacts'),

    
    updatePassword: (data) => api.put('/api/auth/password', data)
};
