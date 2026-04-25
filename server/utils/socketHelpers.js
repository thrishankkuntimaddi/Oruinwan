const getIO = (req) => {
    return req.app?.get("io") || req.io || null;
};

exports.emitToWorkspace = (req, workspaceId, event, data) => {
    const io = getIO(req);
    if (io && workspaceId) {
        io.to(`workspace_${workspaceId}`).emit(event, data);
    }
};

exports.emitToChannel = (req, channelId, event, data) => {
    const io = getIO(req);
    if (io && channelId) {
        io.to(`channel:${channelId}`).emit(event, data);
    }
};

exports.emitToUser = (req, userId, event, data) => {
    const io = getIO(req);
    if (io && userId) {
        io.to(`user_${userId}`).emit(event, data);
    }
};

exports.emitToDM = (req, dmId, event, data) => {
    const io = getIO(req);
    if (io && dmId) {
        io.to(`dm_${dmId}`).emit(event, data);
    }
};

exports.emitToUsers = (req, userIds, event, data) => {
    const io = getIO(req);
    if (io && userIds && Array.isArray(userIds)) {
        userIds.forEach(userId => {
            io.to(`user_${userId}`).emit(event, data);
        });
    }
};

exports.broadcast = (req, event, data) => {
    const io = getIO(req);
    if (io) {
        io.emit(event, data);
    }
};
