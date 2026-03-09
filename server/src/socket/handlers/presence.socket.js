/**
 * Presence Socket Handlers
 */

// Per-tab viewer map: tabId → Map<userId, viewerInfo>
const canvasViewers = new Map();

function registerPresenceHandlers(io, socket) {

    // Broadcast online when connected
    io.emit('user:online', {
        userId: socket.user.id,
        username: socket.user.username || 'Unknown',
        timestamp: new Date()
    });

    // Status change
    socket.on('user:status_change', (data) => {
        const { status, customStatus } = data;
        const validStatuses = ['online', 'away', 'busy', 'offline'];
        if (!validStatuses.includes(status)) {
            socket.emit('error', { message: 'Invalid status' });
            return;
        }
        io.emit('user:status_change', {
            userId: socket.user.id,
            status,
            customStatus: customStatus || null,
            timestamp: new Date()
        });
    });

    // Custom status
    socket.on('user:custom_status', (data) => {
        const { customStatus } = data;
        io.emit('user:custom_status_changed', {
            userId: socket.user.id,
            customStatus,
            timestamp: new Date()
        });
    });

    // Workspace presence
    socket.on('workspace:join', async (workspaceId) => {
        if (!workspaceId) return;
        socket.join(`workspace:${workspaceId}`);
        io.to(`workspace:${workspaceId}`).emit('workspace:member_online', {
            userId: socket.user.id,
            timestamp: new Date()
        });

        // Notify other workspace members that this user is active
        // (throttled: only fires if user joined the workspace in the last 5 minutes)
        try {
            const User = require('../../../models/User');
            const user = await User.findById(socket.user.id).select('username createdAt workspaces').lean();
            if (user) {
                const Workspace = require('../../../models/Workspace');
                const ws = await Workspace.findById(workspaceId).select('members').lean();
                if (ws && ws.members) {
                    const memberIds = (ws.members || []).map(m => (m.user || m).toString());
                    const recipientIds = memberIds.filter(id => id !== socket.user.id.toString());

                    // Only fire notification if this user joined the workspace in the last 10 min
                    const joinedRecently = user.createdAt && (Date.now() - new Date(user.createdAt).getTime()) < 10 * 60 * 1000;
                    if (joinedRecently && recipientIds.length > 0) {
                        const notifService = require('../../features/notifications/notificationService');
                        await notifService.memberJoined(io, {
                            newUserId: socket.user.id,
                            newUsername: user.username || 'Someone',
                            workspaceId,
                            recipientIds,
                        });
                    }
                }
            }
        } catch (err) {
            // Non-fatal — don't crash the socket handler
        }
    });

    socket.on('workspace:leave', (workspaceId) => {
        if (!workspaceId) return;
        socket.leave(`workspace:${workspaceId}`);
    });

    // ─── Canvas Viewer Presence ──────────────────────────────────────────────────

    /**
     * canvas:join — user opened a canvas tab
     * Payload: { tabId, channelId }
     */
    socket.on('canvas:join', ({ tabId, channelId } = {}) => {
        if (!tabId || !channelId) return;

        if (!canvasViewers.has(tabId)) canvasViewers.set(tabId, new Map());
        const viewers = canvasViewers.get(tabId);

        viewers.set(socket.user.id, {
            userId: socket.user.id,
            username: socket.user.username || 'User',
            profilePicture: socket.user.profilePicture || null,
            joinedAt: new Date().toISOString()
        });

        // Remember which canvas this socket is viewing (for disconnect cleanup)
        socket._canvasTab = { tabId, channelId };

        // Broadcast updated viewer list to the channel
        io.to(`channel:${channelId}`).emit('canvas:viewers', {
            tabId,
            viewers: Array.from(viewers.values())
        });
    });

    /**
     * canvas:leave — user left a canvas tab
     * Payload: { tabId, channelId }
     */
    socket.on('canvas:leave', ({ tabId, channelId } = {}) => {
        if (!tabId || !channelId) return;
        _removeViewer(io, socket.user.id, tabId, channelId);
        socket._canvasTab = null;
    });

    // ─── Disconnect cleanup ──────────────────────────────────────────────────────

    socket.on('disconnect', () => {
        io.emit('user:offline', {
            userId: socket.user.id,
            lastSeen: new Date()
        });

        if (socket._canvasTab) {
            const { tabId, channelId } = socket._canvasTab;
            _removeViewer(io, socket.user.id, tabId, channelId);
        }
    });
}

function _removeViewer(io, userId, tabId, channelId) {
    const viewers = canvasViewers.get(tabId);
    if (!viewers) return;

    viewers.delete(userId);
    if (viewers.size === 0) canvasViewers.delete(tabId);

    io.to(`channel:${channelId}`).emit('canvas:viewers', {
        tabId,
        viewers: Array.from((canvasViewers.get(tabId) || new Map()).values())
    });
}

module.exports = registerPresenceHandlers;
