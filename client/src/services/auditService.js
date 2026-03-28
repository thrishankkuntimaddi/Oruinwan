// client/src/services/auditService.js
// refactor(consistency): replace raw axios with canonical api.js client
// Auth token injection and 401 handling now managed by api.js interceptors.

import api from './api';

// Get audit logs with filters
export const getAuditLogs = async (companyId, filters = {}) => {
    const params = new URLSearchParams();

    if (filters.userId) params.append('userId', filters.userId);
    if (filters.action) params.append('action', filters.action);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);

    const response = await api.get(`/api/audit/${companyId}?${params.toString()}`);
    return response.data;
};

// Export audit logs as CSV
// NOTE: responseType 'blob' is preserved — api.js supports axios config options
export const exportAuditLogs = async (companyId, format = 'csv') => {
    const response = await api.get(
        `/api/audit/${companyId}/export?format=${format}`,
        { responseType: 'blob' }
    );
    return response.data;
};

const auditService = {
    getAuditLogs,
    exportAuditLogs
};

export default auditService;
