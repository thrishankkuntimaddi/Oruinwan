const ROOMS = {
    
    
    companyUpdates: (companyId) => `company:${companyId}:updates`,

    
    departmentUpdates: (companyId, deptId) => `company:${companyId}:dept:${deptId}:updates`,

    
    managersRoom: (companyId) => `company:${companyId}:managers`,

    
    companyAnalytics: (companyId) => `company:${companyId}:analytics`,

    
    userNotifications: (userId) => `user:${userId}:notifications`,

    
    workspace: (workspaceId) => `workspace:${workspaceId}`,

    
    channel: (channelId) => `channel:${channelId}`,
};

module.exports = ROOMS;
