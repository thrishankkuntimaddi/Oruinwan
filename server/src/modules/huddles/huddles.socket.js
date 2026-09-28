const logger = require('../../../utils/logger');
const { registry: defaultRegistry } = require('./huddleRegistry');

/** Session history (MongoDB); required lazily so tests can inject a fake. */
const defaultHistory = () => require('./huddleHistory.service').recorder;
const defaultNotesOp = (args) => require('./huddleHistory.service').applyNotesOp(args);

function notifyHuddle(io, socket, { recipientIds, workspaceId, channelId, dmSessionId, channelName, startedBy }) {
    if (!workspaceId) return;
    const notificationService = require('../notifications/notificationService');
    notificationService.huddleStarted(io, {
        recipientIds: (recipientIds || []).filter(id => id !== String(socket.user.id)),
        workspaceId,
        channelId,
        dmSessionId,
        channelName,
        startedBy: startedBy || 'Someone',
    }).catch(err => logger.warn('[huddle:start] notification failed:', err.message));
}

/** The chat room that should hear about a huddle's lifecycle (started/ended/participant changes). */
function scopeRoom({ channelId, dmId, workspaceId }) {
    if (channelId) return `channel:${channelId}`;
    if (dmId) return `dm:${dmId}`;
    if (workspaceId) return `workspace:${workspaceId}`;
    return null;
}

/** 'channel' | 'dm' | 'workspace' for a verified scope. */
function scopeKind(scope) {
    if (scope.channelId) return 'channel';
    if (scope.dmId) return 'dm';
    return 'workspace';
}

/**
 * Where huddle:started goes: the channel room for channel huddles, the
 * workspace room for workspace huddles, and for DMs only the two participants
 * (their DM room plus their personal rooms; Socket.IO de-duplicates sockets
 * that sit in several of these rooms).
 */
function startedAudience(scope, recipientIds) {
    if (scope.channelId) return [`channel:${scope.channelId}`];
    if (scope.dmId) return [`dm:${scope.dmId}`, ...(recipientIds || []).map(id => `user_${id}`)];
    return [`workspace:${scope.workspaceId}`];
}

/**
 * Check the socket's user may use a huddle in this scope.
 * Returns { ok: true, scope, recipientIds, channelName } or { ok: false, message }.
 */
async function verifyScope(socket, scopeArgs) {
    const result = await verifyScopeMembership(socket, scopeArgs);
    if (result.ok && result.scope.workspaceId) {
        const { isFeatureEnabled } = require('../../shared/workspaceFeatures');
        if (!(await isFeatureEnabled(result.scope.workspaceId, 'huddles'))) {
            return { ok: false, message: 'Huddles are turned off in this workspace.' };
        }
    }
    return result;
}

async function verifyScopeMembership(socket, { channelId, dmId, workspaceId }) {
    const uid = String(socket.user.id);
    if (channelId) {
        const Channel = require('../../features/channels/channel.model');
        const channel = await Channel.findById(channelId).select('members name workspace');
        if (!channel || !channel.isMember(uid)) return { ok: false, message: 'Not a member of this channel' };
        return {
            ok: true,
            scope: { channelId: String(channelId), workspaceId: channel.workspace ? String(channel.workspace) : (workspaceId || null) },
            channelName: channel.name,
            recipientIds: channel.members.map(m => String(m?.user?._id || m?.user || m)),
        };
    }
    if (dmId) {
        const DMSession = require('../../../models/DMSession');
        const dm = await DMSession.findById(dmId).select('participants workspace blockedBy');
        const participants = dm?.participants?.map?.(p => String(p._id || p)) || [];
        if (!dm || !participants.includes(uid)) return { ok: false, message: 'Not a participant of this DM' };
        if ((dm.blockedBy || []).length > 0) return { ok: false, message: "You can't call this person." };
        return {
            ok: true,
            scope: { dmId: String(dmId), workspaceId: dm.workspace ? String(dm.workspace) : (workspaceId || null) },
            recipientIds: participants,
        };
    }
    if (workspaceId) {
        const WorkspaceModel = require('../../../models/Workspace');
        const ws = await WorkspaceModel.findOne({
            _id: workspaceId,
            members: { $elemMatch: { user: uid, status: 'active' } },
        }).select('_id').lean();
        if (!ws) return { ok: false, message: 'Not a member of this workspace' };
        return { ok: true, scope: { workspaceId: String(workspaceId) } };
    }
    return { ok: false, message: 'channelId, dmId, or workspaceId required' };
}

/** Membership scope used for registry matching: the most specific id only. */
function registryScope(scope) {
    if (scope.channelId) return { channelId: scope.channelId };
    if (scope.dmId) return { dmId: scope.dmId };
    return { workspaceId: scope.workspaceId };
}

async function displayName(socket) {
    if (socket.data.username) return socket.data.username;
    try {
        const User = require('../../../models/User');
        const user = await User.findById(socket.user.id).select('username profile.name').lean();
        socket.data.username = user?.username || user?.profile?.name || 'Unknown';
    } catch (err) {
        socket.data.username = 'Unknown';
    }
    return socket.data.username;
}

function huddleError(socket, huddleId, code, message) {
    socket.emit('huddle:error', { huddleId, code, message });
}

function registerHuddleHandlers(io, socket, { registry = defaultRegistry, verify = verifyScope, history = defaultHistory(), notesOp = defaultNotesOp } = {}) {
    const uid = () => String(socket.user.id);

    const announceEnded = (huddle, reason) => {
        const payload = { huddleId: huddle.huddleId, channelId: huddle.channelId, dmId: huddle.dmId, workspaceId: huddle.workspaceId, reason, timestamp: new Date() };
        io.to(`huddle:${huddle.huddleId}`).emit('huddle:ended', payload);
        // Only the conversation's own room: a DM or private-channel huddle must not be announced workspace-wide.
        const room = scopeRoom(huddle);
        if (room) io.to(room).emit('huddle:ended', payload);
        history.ended(huddle.huddleId);
    };

    /** Remove this user from a huddle; ends the huddle when nobody is left. */
    const leave = (huddleId, { onlyThisSocket = false, reason = 'left' } = {}) => {
        const { removed, ended, huddle } = registry.leave(huddleId, uid(), onlyThisSocket ? socket.id : undefined);
        socket.leave(`huddle:${huddleId}`);
        if (!removed || !huddle) return;
        history.left(huddleId, uid());
        io.to(`huddle:${huddleId}`).emit('huddle:left', { huddleId, userId: uid(), reason, timestamp: new Date() });
        const room = scopeRoom(huddle);
        if (room) io.to(room).emit('huddle:participant_left', { huddleId, userId: uid() });
        if (ended) announceEnded(huddle, 'empty');
    };

    socket.on('huddle:start', async (data = {}) => {
        const { channelId, dmId, workspaceId, huddleId } = data;
        if (!huddleId) return huddleError(socket, huddleId, 'BAD_REQUEST', 'Missing huddleId');

        try {
            const check = await verify(socket, { channelId, dmId, workspaceId });
            if (!check.ok) return huddleError(socket, huddleId, 'FORBIDDEN', check.message);

            const username = await displayName(socket);
            const startedBy = { _id: uid(), username };
            const existed = !!registry.get(huddleId);
            const { huddle, error } = registry.ensure(huddleId, registryScope(check.scope), { channelName: check.channelName, startedBy, video: !!data.video });
            if (error) return huddleError(socket, huddleId, error, 'Huddle already exists elsewhere');
            huddle.workspaceId = huddle.workspaceId || check.scope.workspaceId || null;
            if (!existed) history.started(registry.summary(huddle));

            const scope = registryScope(check.scope);
            const payload = {
                huddleId,
                scope: scopeKind(scope),
                channelId: check.scope.channelId || null,
                dmId: check.scope.dmId || null,
                workspaceId: huddle.workspaceId,
                channelName: check.channelName,
                startedBy,
                video: !!huddle.video,
                timestamp: new Date(),
            };
            io.to(startedAudience({ ...scope, workspaceId: huddle.workspaceId }, check.recipientIds)).emit('huddle:started', payload);

            if (check.recipientIds) {
                notifyHuddle(io, socket, {
                    recipientIds: check.recipientIds,
                    workspaceId: huddle.workspaceId,
                    channelId: check.scope.channelId,
                    dmSessionId: check.scope.dmId,
                    channelName: check.channelName,
                    startedBy: username,
                });
            }
        } catch (err) {
            logger.error('[huddle:start] failed:', err);
            huddleError(socket, huddleId, 'SERVER_ERROR', 'Failed to start huddle');
        }
    });

    socket.on('huddle:join', async (data = {}) => {
        const { huddleId, channelId, dmId, workspaceId, audioEnabled = true, videoEnabled = false } = data;
        if (!huddleId) return huddleError(socket, huddleId, 'BAD_REQUEST', 'Missing huddleId');

        try {
            const check = await verify(socket, { channelId, dmId, workspaceId });
            if (!check.ok) return huddleError(socket, huddleId, 'FORBIDDEN', check.message);

            const username = await displayName(socket);
            // A join for a huddle this process never saw (e.g. after a restart) re-creates it.
            const existed = !!registry.get(huddleId);
            const ensured = registry.ensure(huddleId, registryScope(check.scope), { channelName: check.channelName, startedBy: { _id: uid(), username }, video: !!(data.video || videoEnabled) });
            if (ensured.error) return huddleError(socket, huddleId, ensured.error, 'This huddle belongs to a different conversation');
            ensured.huddle.workspaceId = ensured.huddle.workspaceId || check.scope.workspaceId || null;
            if (!existed) history.started(registry.summary(ensured.huddle));

            const joined = registry.join(huddleId, { userId: uid(), username, audioEnabled, videoEnabled, socketId: socket.id });
            if (joined.error === 'HUDDLE_FULL') {
                return huddleError(socket, huddleId, 'HUDDLE_FULL', `This huddle is full (max ${registry.maxParticipants} people).`);
            }
            if (joined.error) return huddleError(socket, huddleId, joined.error, 'Could not join huddle');
            history.joined(huddleId, { userId: uid(), username });

            const room = `huddle:${huddleId}`;
            if (joined.replacedSocketId) {
                // Same user joined from another tab/device: evict the old connection so peers reconnect to the new one.
                const old = io.sockets.sockets.get(joined.replacedSocketId);
                if (old) old.leave(room);
                io.to(joined.replacedSocketId).emit('huddle:ended', { huddleId, reason: 'joined_elsewhere' });
                socket.to(room).emit('huddle:left', { huddleId, userId: uid(), reason: 'rejoined', timestamp: new Date() });
            }
            socket.join(room);

            // The joiner learns who is already here; existing members get huddle:joined and send it offers.
            socket.emit('huddle:roster', { huddleId, participants: joined.others, maxParticipants: registry.maxParticipants, video: !!joined.huddle.video });
            socket.to(room).emit('huddle:joined', { huddleId, userId: uid(), username, audioEnabled: audioEnabled !== false, videoEnabled: !!videoEnabled, timestamp: new Date() });

            const scoped = scopeRoom(registryScope(check.scope));
            if (scoped) io.to(scoped).emit('huddle:participant_joined', { huddleId, userId: uid() });
        } catch (err) {
            logger.error('[huddle:join] failed:', err);
            huddleError(socket, huddleId, 'SERVER_ERROR', 'Failed to join huddle');
        }
    });

    socket.on('huddle:leave', (data = {}) => {
        if (!data.huddleId) return;
        leave(data.huddleId);
    });

    socket.on('huddle:end', (data = {}) => {
        const { huddleId } = data;
        if (!huddleId) return;
        if (!registry.participant(huddleId, uid())) {
            logger.warn(`🚫 [huddle:end] User ${uid()} denied — not in huddle:${huddleId}`);
            return huddleError(socket, huddleId, 'FORBIDDEN', 'Not in this huddle');
        }
        const huddle = registry.end(huddleId);
        if (huddle) announceEnded(huddle, 'ended');
        io.in(`huddle:${huddleId}`).socketsLeave(`huddle:${huddleId}`);
    });

    socket.on('huddle:audio_toggle', (data = {}) => {
        const { huddleId, audioEnabled } = data;
        if (!huddleId || !registry.setAudio(huddleId, uid(), audioEnabled)) return;
        io.to(`huddle:${huddleId}`).emit('huddle:audio_changed', { huddleId, userId: uid(), audioEnabled: audioEnabled !== false });
    });

    socket.on('huddle:video_toggle', (data = {}) => {
        const { huddleId, videoEnabled } = data;
        if (!huddleId || !registry.setVideo(huddleId, uid(), videoEnabled)) return;
        io.to(`huddle:${huddleId}`).emit('huddle:video_changed', { huddleId, userId: uid(), videoEnabled: !!videoEnabled });
    });

    // Active huddles this socket can see in a workspace, so a fresh page load shows live huddles.
    socket.on('huddle:list', (data = {}, ack) => {
        if (typeof ack !== 'function') return;
        const workspaceId = data.workspaceId ? String(data.workspaceId) : null;
        if (!workspaceId || !socket.rooms.has(`workspace:${workspaceId}`)) return ack({ huddles: [] });
        const huddles = registry.list(h =>
            h.workspaceId === workspaceId && (!h.channelId || socket.rooms.has(`channel:${h.channelId}`)) && !h.dmId
        );
        ack({ huddles });
    });

    // The live huddle in one channel/DM, so a conversation opened after the huddle
    // started can still offer "Join". Only for sockets already in that room.
    socket.on('huddle:active', (data = {}, ack) => {
        if (typeof ack !== 'function') return;
        const channelId = data.channelId ? String(data.channelId) : null;
        const dmId = !channelId && data.dmId ? String(data.dmId) : null;
        const room = scopeRoom({ channelId, dmId });
        if (!room || !socket.rooms.has(room)) return ack({ huddle: null });
        const [huddle] = registry.list(h => (channelId ? h.channelId === channelId : h.dmId === dmId));
        ack({ huddle: huddle || null });
    });

    // Signaling relay: only between current participants of the same huddle, and
    // delivered to the target's registered socket rather than all of their tabs.
    const relay = (event, field) => (data = {}) => {
        const { huddleId, targetUserId } = data;
        if (!huddleId || !targetUserId || (field && !data[field])) return;
        if (!registry.participant(huddleId, uid())) return;
        const target = registry.participant(huddleId, targetUserId);
        if (!target) return;
        const payload = { huddleId, fromUserId: uid() };
        if (field) payload[field] = data[field];
        io.to(target.socketId).emit(event, payload);
    };
    socket.on('huddle:offer', relay('huddle:offer', 'offer'));
    socket.on('huddle:answer', relay('huddle:answer', 'answer'));
    socket.on('huddle:ice-candidate', relay('huddle:ice-candidate', 'candidate'));

    // Shared huddle notes: one small edit (a paragraph or an action item) at a
    // time, applied on the server in order and relayed to everyone else in the call.
    socket.on('huddle:notes_op', async (data = {}, ack) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        const { huddleId, op } = data;
        if (!huddleId || !op) return reply({ ok: false, message: 'huddleId and op are required' });
        if (!registry.participant(huddleId, uid())) return reply({ ok: false, message: 'Not in this huddle' });
        try {
            const username = await displayName(socket);
            const { noteId, applied } = await notesOp({ userId: uid(), username, huddleId, op, io });
            socket.to(`huddle:${huddleId}`).emit('huddle:notes_op', { huddleId, noteId, applied, by: { userId: uid(), username } });
            reply({ ok: true, noteId, applied });
        } catch (err) {
            if (!err.status) logger.error('[huddle:notes_op] failed:', err);
            reply({ ok: false, message: err.status ? err.message : 'Could not save the notes' });
        }
    });

    // A dropped connection (closed tab, network loss) leaves every huddle it was in.
    socket.on('disconnect', () => {
        for (const huddleId of registry.huddlesForSocket(socket.id)) {
            leave(huddleId, { onlyThisSocket: true, reason: 'disconnected' });
        }
    });
}

module.exports = registerHuddleHandlers;
module.exports.verifyScope = verifyScope;
module.exports.startedAudience = startedAudience;
module.exports.scopeKind = scopeKind;
