class SocketEmitter {
    constructor(io) {
        this.io = io;
    }

    
    
    

    
    emitNewMessage(conversationId, type, message) {
        const room = type === 'channel'
            ? `channel:${conversationId}`
            : type === 'dm'
                ? `dm:${conversationId}`
                : `thread:${conversationId}`;

        
        this.io.to(room).emit('new-message', message);

        
        this.io.to(room).emit('conversation:event', {
            conversationId,
            conversationType: type,
            event: {
                type: 'message',
                payload: message,
                userId: message.sender?._id || message.sender,
                timestamp: message.createdAt || new Date()
            }
        });

        console.log(`📤 Emitted new message to ${room}`);
    }

    
    emitMessageEdit(conversationId, type, message) {
        const room = type === 'channel'
            ? `channel:${conversationId}`
            : `dm:${conversationId}`;

        this.io.to(room).emit('message:edited', message);
        this.io.to(room).emit('conversation:event', {
            conversationId,
            conversationType: type,
            event: {
                type: 'edit',
                payload: message,
                userId: message.sender?._id || message.sender,
                timestamp: new Date()
            }
        });
    }

    
    emitMessageDelete(conversationId, type, messageId) {
        const room = type === 'channel'
            ? `channel:${conversationId}`
            : `dm:${conversationId}`;

        this.io.to(room).emit('message:deleted', { messageId });
        this.io.to(room).emit('conversation:event', {
            conversationId,
            conversationType: type,
            event: {
                type: 'delete',
                payload: { messageId },
                timestamp: new Date()
            }
        });
    }

    
    
    

    
    emitMeetingCreated(channelId, meeting) {
        this.io.to(`channel:${channelId}`).emit('meeting:created', meeting);
        console.log(`📹 Emitted meeting created to channel:${channelId}`);
    }

    
    emitMeetingEnded(meetingId, channelId, data) {
        this.io.to(`meeting:${meetingId}`).emit('meeting:ended', data);
        if (channelId) {
            this.io.to(`channel:${channelId}`).emit('meeting:ended', data);
        }
    }

    
    
    

    
    emitHuddleStarted(channelId, huddleData) {
        this.io.to(`channel:${channelId}`).emit('huddle:started', huddleData);
        console.log(`🎙️ Emitted huddle started to channel:${channelId}`);
    }

    
    emitHuddleEnded(huddleId, channelId, data) {
        this.io.to(`huddle:${huddleId}`).emit('huddle:ended', data);
        if (channelId) {
            this.io.to(`channel:${channelId}`).emit('huddle:ended', data);
        }
    }

    
    
    

    
    emitPollCreated(channelId, poll) {
        this.io.to(`channel:${channelId}`).emit('poll:new', poll);
    }

    
    emitPollUpdate(channelId, poll) {
        this.io.to(`channel:${channelId}`).emit('poll:update', poll);
    }

    
    emitPollRemoved(channelId, pollId) {
        this.io.to(`channel:${channelId}`).emit('poll:removed', { pollId });
    }

    
    
    

    
    emitUserOnline(userId, username) {
        this.io.emit('user:online', {
            userId,
            username,
            timestamp: new Date()
        });
    }

    
    emitUserOffline(userId) {
        this.io.emit('user:offline', {
            userId,
            lastSeen: new Date()
        });
    }

    
    emitStatusChange(userId, status, customStatus = null) {
        this.io.emit('user:status_change', {
            userId,
            status,
            customStatus,
            timestamp: new Date()
        });
    }

    
    
    

    
    emitToAdmins(event, data) {
        this.io.to('chttrix_admins').emit(event, data);
    }

    
    emitAuditUpdate(logData) {
        this.emitToAdmins('audit:update', logData);
    }

    
    emitTicketNotification(type, ticketData) {
        this.emitToAdmins(`ticket:${type}`, ticketData);
    }

    
    
    

    
    emitToUser(userId, event, data) {
        this.io.to(`user:${userId}`).emit(event, data);
    }

    
    emitToUsers(userIds, event, data) {
        userIds.forEach(userId => {
            this.emitToUser(userId, event, data);
        });
    }

    
    
    

    
    emitToWorkspace(workspaceId, event, data) {
        this.io.to(`workspace:${workspaceId}`).emit(event, data);
    }

    
    emitToCompany(companyId, event, data) {
        this.io.to(`company:${companyId}`).emit(event, data);
    }
}

let instance = null;

function initializeSocketEmitter(io) {
    instance = new SocketEmitter(io);
    return instance;
}

function getSocketEmitter() {
    if (!instance) {
        throw new Error('SocketEmitter not initialized. Call initializeSocketEmitter(io) first.');
    }
    return instance;
}

module.exports = {
    SocketEmitter,
    initializeSocketEmitter,
    getSocketEmitter
};
