// client/src/services/auditService.js

import axios from 'axios';
import { API_BASE } from './api';

const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('accessToken')}`
});

// Get audit logs with filters
export const getAuditLogs = async (companyId, filters = {}) => {
    const params = new URLSearchParams();

    if (filters.userId) params.append('userId', filters.userId);
    if (filters.action) params.append('action', filters.action);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);

    const response = await axios.get(
        `${API_BASE}/api/audit/${companyId}?${params.toString()}`,
        { headers: getAuthHeaders() }
    );
    return response.data;
};

// Export audit logs as CSV
export const exportAuditLogs = async (companyId, format = 'csv') => {
    const response = await axios.get(
        `${API_BASE}/api/audit/${companyId}/export?format=${format}`,
        {
            headers: getAuthHeaders(),
            responseType: 'blob'
        }
    );
    return response.data;
};

const auditService = {
    getAuditLogs,
    exportAuditLogs
};

export default auditService;
