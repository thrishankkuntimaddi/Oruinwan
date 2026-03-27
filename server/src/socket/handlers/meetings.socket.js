/**
 * Meeting Socket Handlers
 *
 * Handles all socket events related to meetings:
 * - Meeting join/leave
 * - Meeting state changes
 * - Participant updates
 * - Shared notes realtime sync (meeting:notes_update)
 * - Whiteboard drawing (whiteboard:update)
 * - Brainstorm board (brainstorm:update)
 *
 * @module socket/handlers/meetings
 */

const meetingsService = require('../../src/features/meetings/meetings.service');

/**
 * Register meeting-related socket handlers
 * @param {Server} io - Socket.io server instance
 * @param {Socket} socket - Individual socket connection
 */
function registerMeetingHandlers(io, socket) {

    /**
     * Join a meeting room
     */
    socket.on('meeting:join', (data) => {
        const { meetingId, channelId } = data;

        if (!meetingId) {
            socket.emit('error', { message: 'Missing meetingId' });
            return;
        }

        // Join meeting room
        socket.join(`meeting:${meetingId}`);

        // Broadcast to all meeting participants
        io.to(`meeting:${meetingId}`).emit('meeting:joined', {
            meetingId,
            userId: socket.user.id,
            username: socket.user.username || 'Unknown',
            timestamp: new Date()
        });

        // Also notify channel (if provided)
        if (channelId) {
            io.to(`channel:${channelId}`).emit('meeting:participant_joined', {
                meetingId,
                userId: socket.user.id
            });
        }
    });

    /**
     * Leave a meeting room
     */
    socket.on('meeting:leave', (data) => {
        const { meetingId, channelId } = data;

        if (!meetingId) return;

        socket.leave(`meeting:${meetingId}`);

        io.to(`meeting:${meetingId}`).emit('meeting:left', {
            meetingId,
            userId: socket.user.id,
            username: socket.user.username || 'Unknown',
            timestamp: new Date()
        });

        if (channelId) {
            io.to(`channel:${channelId}`).emit('meeting:participant_left', {
                meetingId,
                userId: socket.user.id
            });
        }
    });

    /**
     * Meeting ended (emitted by host or server)
     */
    socket.on('meeting:end', async (data) => {
        const { meetingId, channelId, duration } = data;
        if (!meetingId) return;

        io.to(`meeting:${meetingId}`).emit('meeting:ended', {
            meetingId,
            endedBy: socket.user.id,
            duration: duration || 0,
            timestamp: new Date()
        });

        if (channelId) {
            io.to(`channel:${channelId}`).emit('meeting:ended', {
                meetingId,
                endedBy: socket.user.id
            });
        }
    });

    // ── Shared Notes Sync ──────────────────────────────────────────────────────
    /**
     * Realtime shared notes update.
     * The client emits this after any debounced keystroke.
     * We broadcast to all other participants and persist to DB asynchronously.
     *
     * Payload: { meetingId, content }
     */
    socket.on('meeting:notes_update', async (data) => {
        const { meetingId, content } = data;
        if (!meetingId) return;

        // Broadcast to all OTHER participants in the room (not back to sender)
        socket.to(`meeting:${meetingId}`).emit('meeting:notes_update', {
            meetingId,
            content,
            updatedBy: socket.user.id,
            timestamp: new Date(),
        });

        // Persist asynchronously — best-effort, no need to await
        meetingsService.updateSharedNotes(meetingId, content).catch((err) =>
            console.error('[Socket] meeting:notes_update persist error:', err.message)
        );
    });

    // ── Whiteboard Realtime ────────────────────────────────────────────────────
    /**
     * A single drawing stroke event.
     * The client emits this per-stroke (on mouseup / touchend).
     *
     * Payload: { meetingId, stroke: { tool, color, lineWidth, points } }
     */
    socket.on('whiteboard:update', (data) => {
        const { meetingId, stroke, action } = data;
        if (!meetingId) return;

        // action: 'stroke' | 'clear'
        socket.to(`meeting:${meetingId}`).emit('whiteboard:update', {
            meetingId,
            stroke,
            action: action || 'stroke',
            userId: socket.user.id,
            timestamp: new Date(),
        });
    });

    // ── Brainstorm Board Realtime ──────────────────────────────────────────────
    /**
     * A brainstorm item add / move / delete event.
     * REST API handles DB persistence; socket broadcasts the change.
     *
     * Payload: { meetingId, action: 'add'|'update'|'delete', item?, itemId? }
     */
    socket.on('brainstorm:update', (data) => {
        const { meetingId, action, item, itemId } = data;
        if (!meetingId) return;

        socket.to(`meeting:${meetingId}`).emit('brainstorm:update', {
            meetingId,
            action,
            item,
            itemId,
            userId: socket.user.id,
            timestamp: new Date(),
        });
    });
}

module.exports = registerMeetingHandlers;
