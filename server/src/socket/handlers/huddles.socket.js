function registerHuddleHandlers(io, socket) {

    
    socket.on('huddle:start', async (data) => {
        const { channelId, dmId, workspaceId, huddleId } = data;

        if (!huddleId) {
            socket.emit('error', { message: 'Missing huddleId' });
            return;
        }
        if (!channelId && !dmId && !workspaceId) {
            socket.emit('error', { message: 'Missing channelId, dmId, or workspaceId' });
            return;
        }

        try {
            if (channelId) {
                
                const Channel = require('../../features/channels/channel.model');
                const channel = await Channel.findById(channelId).select('members');
                if (!channel || !channel.isMember(socket.user.id)) {
                    socket.emit('error', { message: 'Not a member of this channel' });
                    return;
                }
                io.to(`channel:${channelId}`).emit('huddle:started', {
                    huddleId, channelId,
                    startedBy: { _id: socket.user.id, username: socket.user.username || 'Unknown' },
                    timestamp: new Date()
                });

            } else if (dmId) {
                
                const DMSession = require('../../features/chatlist/dmSession.model');
                const dm = await DMSession.findById(dmId).select('participants');
                const participants = dm?.participants?.map?.(p => String(p._id || p)) || [];
                if (!dm || !participants.includes(String(socket.user.id))) {
                    socket.emit('error', { message: 'Not a participant of this DM' });
                    return;
                }
                io.to(`dm:${dmId}`).emit('huddle:started', {
                    huddleId, dmId,
                    startedBy: { _id: socket.user.id, username: socket.user.username || 'Unknown' },
                    timestamp: new Date()
                });

            } else if (workspaceId) {
                
                const WorkspaceModel = require('../../features/workspaces/workspace.model');
                const ws = await WorkspaceModel.findOne({
                    _id: workspaceId,
                    'members.user': socket.user.id
                }).select('_id').lean();
                if (!ws) {
                    socket.emit('error', { message: 'Not a member of this workspace' });
                    return;
                }
                io.to(`workspace:${workspaceId}`).emit('huddle:started', {
                    huddleId, workspaceId,
                    startedBy: { _id: socket.user.id, username: socket.user.username || 'Unknown' },
                    timestamp: new Date()
                });
            }
        } catch (err) {
            console.error('[huddle:start] Membership check failed:', err);
            socket.emit('error', { message: 'Failed to verify membership' });
        }
    });

    
    socket.on('huddle:join', async (data) => {
        const { huddleId, channelId, dmId, workspaceId, audioEnabled = true } = data;

        if (!huddleId) {
            socket.emit('error', { message: 'Missing huddleId' });
            return;
        }

        
        if (!channelId && !dmId && !workspaceId) {
            socket.emit('error', { message: 'channelId, dmId, or workspaceId required to join a huddle' });
            return;
        }

        
        if (channelId) {
            try {
                const Channel = require('../../features/channels/channel.model');
                const channel = await Channel.findById(channelId).select('members');
                if (!channel || !channel.isMember(socket.user.id)) {
                    socket.emit('error', { message: 'Not a member of this channel' });
                    return;
                }
            } catch (err) {
                socket.emit('error', { message: 'Failed to verify channel membership' });
                return;
            }
        } else if (dmId) {
            try {
                const DMSession = require('../../features/chatlist/dmSession.model');
                const dm = await DMSession.findById(dmId).select('participants');
                const participants = dm?.participants?.map?.(p => String(p._id || p)) || [];
                if (!dm || !participants.includes(String(socket.user.id))) {
                    socket.emit('error', { message: 'Not a participant of this DM' });
                    return;
                }
            } catch (err) {
                socket.emit('error', { message: 'Failed to verify DM membership' });
                return;
            }
        } else if (workspaceId) {
            try {
                const WorkspaceModel = require('../../features/workspaces/workspace.model');
                const ws = await WorkspaceModel.findOne({
                    _id: workspaceId,
                    'members.user': socket.user.id
                }).select('_id').lean();
                if (!ws) {
                    socket.emit('error', { message: 'Not a member of this workspace' });
                    return;
                }
            } catch (err) {
                socket.emit('error', { message: 'Failed to verify workspace membership' });
                return;
            }
        }

        
        socket.join(`huddle:${huddleId}`);

        
        io.to(`huddle:${huddleId}`).emit('huddle:joined', {
            huddleId,
            userId: socket.user.id,
            username: socket.user.username || 'Unknown',
            audioEnabled,
            timestamp: new Date()
        });

        
        if (channelId) {
            io.to(`channel:${channelId}`).emit('huddle:participant_joined', { huddleId, userId: socket.user.id });
        } else if (dmId) {
            io.to(`dm:${dmId}`).emit('huddle:participant_joined', { huddleId, userId: socket.user.id });
        } else if (workspaceId) {
            io.to(`workspace:${workspaceId}`).emit('huddle:participant_joined', { huddleId, userId: socket.user.id });
        }
    });

    
    socket.on('huddle:leave', (data) => {
        const { huddleId, channelId, dmId, workspaceId } = data;

        if (!huddleId) return;

        socket.leave(`huddle:${huddleId}`);

        
        io.to(`huddle:${huddleId}`).emit('huddle:left', {
            huddleId,
            userId: socket.user.id,
            timestamp: new Date()
        });

        
        if (channelId) {
            io.to(`channel:${channelId}`).emit('huddle:participant_left', { huddleId, userId: socket.user.id });
        } else if (dmId) {
            io.to(`dm:${dmId}`).emit('huddle:participant_left', { huddleId, userId: socket.user.id });
        } else if (workspaceId) {
            io.to(`workspace:${workspaceId}`).emit('huddle:participant_left', { huddleId, userId: socket.user.id });
        }
    });

    
    socket.on('huddle:end', async (data) => {
        const { huddleId, channelId, duration } = data;

        if (!huddleId) return;

        
        
        if (!socket.rooms.has(`huddle:${huddleId}`)) {
            console.warn(`🚫 [huddle:end] User ${socket.user.id} denied — not in huddle:${huddleId}`);
            socket.emit('error', { message: 'Not in this huddle' });
            return;
        }

        
        if (channelId) {
            try {
                const Channel = require('../../features/channels/channel.model');
                const channel = await Channel.findById(channelId).select('members');
                if (!channel || !channel.isMember(socket.user.id)) {
                    console.warn(`🚫 [huddle:end] User ${socket.user.id} denied — not a member of channel:${channelId}`);
                    socket.emit('error', { message: 'Not a member of this channel' });
                    return;
                }
            } catch (err) {
                console.error('[huddle:end] Channel membership check failed:', err);
                socket.emit('error', { message: 'Failed to verify channel membership' });
                return;
            }
        }

        
        io.to(`huddle:${huddleId}`).emit('huddle:ended', {
            huddleId,
            channelId,
            duration: duration || 0,
            timestamp: new Date()
        });

        
        if (channelId) {
            io.to(`channel:${channelId}`).emit('huddle:ended', {
                huddleId
            });
        }
    });

    
    socket.on('huddle:audio_toggle', (data) => {
        const { huddleId, audioEnabled } = data;

        if (!huddleId) return;

        
        io.to(`huddle:${huddleId}`).emit('huddle:audio_changed', {
            userId: socket.user.id,
            audioEnabled
        });
    });

    
    
    

    
    socket.on('huddle:offer', ({ huddleId, targetUserId, offer }) => {
        if (!huddleId || !targetUserId || !offer) return;
        io.to(`user:${targetUserId}`).emit('huddle:offer', {
            huddleId,
            fromUserId: socket.user.id,
            offer
        });
    });

    
    socket.on('huddle:answer', ({ huddleId, targetUserId, answer }) => {
        if (!huddleId || !targetUserId || !answer) return;
        io.to(`user:${targetUserId}`).emit('huddle:answer', {
            huddleId,
            fromUserId: socket.user.id,
            answer
        });
    });

    
    socket.on('huddle:ice-candidate', ({ huddleId, targetUserId, candidate }) => {
        if (!huddleId || !targetUserId) return;
        io.to(`user:${targetUserId}`).emit('huddle:ice-candidate', {
            huddleId,
            fromUserId: socket.user.id,
            candidate
        });
    });
}

module.exports = registerHuddleHandlers;
