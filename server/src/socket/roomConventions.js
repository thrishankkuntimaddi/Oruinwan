const ROOMS = {
    
    platformAdmins: () => "platform:admins",

    
    company: (companyId) => `company:${companyId}`,
    companyUpdates: (companyId) => `company:${companyId}:updates`,   
    companyAdmins: (companyId) => `company:${companyId}:admins`,

    
    workspace: (workspaceId) => `workspace:${workspaceId}`,
    workspaceAdmins: (workspaceId) => `workspace:${workspaceId}:admins`,

    
    channel: (channelId) => `channel:${channelId}`,
    channelTyping: (channelId) => `channel:${channelId}:typing`,

    
    thread: (threadId) => `thread:${threadId}`,

    
    
    
    dm: (sessionId) => `dm:${sessionId}`,

    
    user: (userId) => `user:${userId}`,
};

module.exports = ROOMS;
