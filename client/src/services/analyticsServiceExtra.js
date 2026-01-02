/**
 * Get comprehensive analytics for company  
 * @param {string} companyId 
 * @param {string} timeRange - '7d', '30d', or '90d'
 * @returns {Promise}
 */
export const getCompanyAnalytics = async (companyId, timeRange = '30d') => {
    const response = await axios.get(
        `${API_BASE}/api/analytics/company/${companyId}?timeRange=${timeRange}`,
        getAuthHeader()
    );
    return response.data;
};
