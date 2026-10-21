const logger = require('../../../utils/logger');
const { registry: defaultRegistry, planSourceOf } = require('./huddleRegistry');

/** Session history (MongoDB); required lazily so tests can inject a fake. */
const defaultHistory = () => require('./huddleHistory.service').recorder;
const defaultNotesOp = (args) => require('./huddleHistory.service').applyNotesOp(args);
/** Scheduled meetings held in a huddle are completed when it ends (only with a live database). */
const defaultMeetings = {
    async huddleEnded(huddle, io) {
        if (require('mongoose').connection.readyState !== 1) return [];
        const completedMeetingIds = await require('../../features/meetings/meetings.service').completeMeetingsForHuddle(huddle, io);
        // "meeting.completed" for automations: a plain huddle reports itself; one that held
        // scheduled meetings was already reported as those meetings.
        await require('./huddleMedia.service').emitHuddleCompleted(huddle, io, { completedMeetingIds })
            .catch(err => logger.warn('[huddle] meeting.completed not emitted:', err.message));
        return completedMeetingIds;
    },
};

/**
 * The plan's call limits: { participants, minutes, plan } (null = no plan limit).
 * `workspaceId` is always one the server resolved; without one, `userId`'s own
 * plan applies (a DM outside any workspace: free -> 10 people / 30 minutes).
 * A failed lookup never blocks a call.
 */
async function defaultPlanLimits(workspaceId, { userId = null } = {}) {
    if (!workspaceId && !userId) return null;
    try {
        return await require('../../shared/plans/planService').huddleLimits(workspaceId, { userId });
    } catch (err) {
        logger.warn({ err: err?.message }, '[huddle] plan limits unknown, call not limited');
        return null;
    }
}

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
            scope: { channelId: String(channelId), workspaceId: channel.workspace ? String(channel.workspace) : null, planWorkspaceId: channel.workspace ? String(channel.workspace) : null },
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
        if (dm.workspace) {
            return { ok: true, scope: { dmId: String(dmId), workspaceId: String(dm.workspace), planWorkspaceId: String(dm.workspace) }, recipientIds: participants };
        }
        // A DM outside any workspace: the client's workspace id only groups the call (huddle:list,
        // notifications) and only when the caller belongs to it. It never decides the plan:
        // the caller's own plan does (planWorkspaceId null).
        let shownIn = null;
        if (workspaceId) {
            const access = await require('../../identity').workspaces.membership(workspaceId, uid).catch(() => null);
            if (access?.member) shownIn = String(workspaceId);
        }
        return { ok: true, scope: { dmId: String(dmId), workspaceId: shownIn, planWorkspaceId: null }, recipientIds: participants };
    }
    if (workspaceId) {
        const access = await require('../../identity').workspaces.membership(workspaceId, uid);
        if (!access?.member) return { ok: false, message: 'Not a member of this workspace' };
        return { ok: true, scope: { workspaceId: String(workspaceId), planWorkspaceId: String(workspaceId) } };
    }
    return { ok: false, message: 'channelId, dmId, or workspaceId required' };
}

/**
 * Registry meta for whose plan applies: a scope without a server-resolved
 * workspace is limited by the caller's own plan (planUserId).
 */
function planMeta(scope, userId) {
    const planWs = Object.prototype.hasOwnProperty.call(scope, 'planWorkspaceId') ? scope.planWorkspaceId : scope.workspaceId;
    return planWs ? {} : { planUserId: String(userId) };
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
        const user = await require('../../identity').users.findById(socket.user.id);
        socket.data.username = user?.username || user?.profile?.name || 'Unknown';
    } catch (err) {
        socket.data.username = 'Unknown';
    }
    return socket.data.username;
}

/** Bus event for a huddle lifecycle change; a bus failure never affects the call. */
function publishHuddle(name, huddle, payload) {
    if (!huddle?.workspaceId) return;
    require('../../shared/events/bus').publish(name, payload, { workspaceId: huddle.workspaceId, actorId: payload.startedBy || null })
        .catch(() => {});
}

function huddleError(socket, huddleId, code, message) {
    socket.emit('huddle:error', { huddleId, code, message });
}

/**
 * Tell everyone a huddle is over (its call room and its conversation's room), close its
 * history run and complete its meeting record(s).
 */
function announceEnded(io, huddle, reason, { history = defaultHistory(), meetings = defaultMeetings } = {}) {
    const payload = {
        huddleId: huddle.huddleId, meetingId: huddle.meetingId || null,
        channelId: huddle.channelId, dmId: huddle.dmId, workspaceId: huddle.workspaceId, reason, timestamp: new Date(),
    };
    if (reason === 'time_limit') {
        const { TIME_LIMIT_MESSAGE } = require('../../shared/plans/huddleTimer');
        payload.message = TIME_LIMIT_MESSAGE(Math.round((Date.now() - new Date(huddle.startedAt).getTime()) / 60000) || 30);
    }
    io.to(`huddle:${huddle.huddleId}`).emit('huddle:ended', payload);
    // Only the conversation's own room: a DM or private-channel huddle must not be announced workspace-wide.
    const room = scopeRoom(huddle);
    if (room) io.to(room).emit('huddle:ended', payload);
    history.ended(huddle.huddleId);
    publishHuddle('huddle.ended', huddle, { huddleId: huddle.huddleId, reason });
    pendingMeeting.delete(huddle.huddleId);
    Promise.resolve()
        .then(() => meetings.huddleEnded(huddle, io))
        .catch(err => logger.warn('[huddle] could not complete its meetings:', err.message));
}

/**
 * End a live huddle for everyone (e.g. "End meeting" on the meeting page).
 * Returns true when a live huddle was ended.
 */
function endHuddle(io, huddleId, reason = 'ended', { registry = defaultRegistry, history = defaultHistory(), meetings = defaultMeetings } = {}) {
    const huddle = registry.end(huddleId);
    if (!huddle) return false;
    announceEnded(io, huddle, reason, { history, meetings });
    io.in(`huddle:${huddleId}`).socketsLeave(`huddle:${huddleId}`);
    return true;
}

// huddleId -> promise of its meeting record id while the run's start is being recorded.
const pendingMeeting = new Map();
const MEETING_LINK_WAIT_MS = 3000;

/** Record a new run and resolve its meeting record id (null when unknown in time). */
function startRun(registry, history, huddle) {
    const huddleId = huddle.huddleId;
    const p = Promise.resolve()
        .then(() => history.started(registry.summary(huddle)))
        .then((session) => {
            const meetingId = session?.meeting ? String(session.meeting) : null;
            if (meetingId && typeof registry.setMeeting === 'function') registry.setMeeting(huddleId, meetingId);
            return meetingId;
        })
        .catch(() => null);
    pendingMeeting.set(huddleId, p);
    p.finally(() => { if (pendingMeeting.get(huddleId) === p) pendingMeeting.delete(huddleId); });
    return p;
}

/** The huddle's meeting record id: known already, else wait (briefly) for its start to be recorded. */
async function meetingIdFor(registry, huddleId) {
    const known = registry.get(huddleId)?.meetingId;
    if (known) return known;
    const pending = pendingMeeting.get(huddleId);
    if (!pending) return null;
    let timer;
    const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(null), MEETING_LINK_WAIT_MS); if (timer.unref) timer.unref(); });
    const id = await Promise.race([pending, timeout]);
    clearTimeout(timer);
    return id || registry.get(huddleId)?.meetingId || null;
}

function registerHuddleHandlers(io, socket, { registry = defaultRegistry, verify = verifyScope, history = defaultHistory(), notesOp = defaultNotesOp, meetings = defaultMeetings, emptyTimeoutMs = 30000, planLimits = defaultPlanLimits } = {}) {
    const uid = () => String(socket.user.id);

    const announce = (huddle, reason) => announceEnded(io, huddle, reason, { history, meetings });

    /** Remove this user from a huddle; ends the huddle when nobody is left. */
    const leave = (huddleId, { onlyThisSocket = false, reason = 'left' } = {}) => {
        const { removed, ended, huddle } = registry.leave(huddleId, uid(), onlyThisSocket ? socket.id : undefined);
        socket.leave(`huddle:${huddleId}`);
        if (!removed || !huddle) return;
        history.left(huddleId, uid());
        io.to(`huddle:${huddleId}`).emit('huddle:left', { huddleId, userId: uid(), reason, timestamp: new Date() });
        const room = scopeRoom(huddle);
        if (room) io.to(room).emit('huddle:participant_left', { huddleId, userId: uid() });
        if (ended) announce(huddle, 'empty');
    };

    socket.on('huddle:start', async (data = {}) => {
        const { channelId, dmId, workspaceId, huddleId } = data;
        if (!huddleId) return huddleError(socket, huddleId, 'BAD_REQUEST', 'Missing huddleId');

        try {
            const check = await verify(socket, { channelId, dmId, workspaceId });
            if (!check.ok) return huddleError(socket, huddleId, 'FORBIDDEN', check.message);

            // One live huddle per channel or DM: starting another joins the one already running.
            const running = registry.liveInScope(registryScope(check.scope), huddleId);
            if (running) {
                return socket.emit('huddle:existing', { requestedId: huddleId, huddleId: running.huddleId, video: !!running.video, meetingId: running.meetingId || null });
            }

            const username = await displayName(socket);
            const startedBy = { _id: uid(), username };
            const existed = !!registry.get(huddleId);
            const { huddle, error } = registry.ensure(huddleId, registryScope(check.scope), { channelName: check.channelName, startedBy, video: !!data.video, workspaceId: check.scope.workspaceId || null, ...planMeta(check.scope, uid()) });
            if (error) return huddleError(socket, huddleId, error, 'Huddle already exists elsewhere');
            if (!existed) {
                startRun(registry, history, huddle);
                publishHuddle('huddle.started', huddle, { huddleId, channelId: huddle.channelId, dmId: huddle.dmId, startedBy: uid(), video: !!huddle.video });
                // A huddle nobody joins (the starter's tab closed first) must not stay "live".
                const timer = setTimeout(() => {
                    const h = registry.get(huddleId);
                    if (h && h.participants.size === 0 && registry.end(huddleId)) announce(h, 'empty');
                }, emptyTimeoutMs);
                if (timer.unref) timer.unref();
            }
            // Every call has a meeting record; clients open its page with this id.
            const meetingId = await meetingIdFor(registry, huddleId);

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
                meetingId,
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
            const ensured = registry.ensure(huddleId, registryScope(check.scope), { channelName: check.channelName, startedBy: { _id: uid(), username }, video: !!(data.video || videoEnabled), workspaceId: check.scope.workspaceId || null, ...planMeta(check.scope, uid()) });
            if (ensured.error) return huddleError(socket, huddleId, ensured.error, 'This huddle belongs to a different conversation');
            if (!existed) {
                startRun(registry, history, ensured.huddle);
                publishHuddle('huddle.started', ensured.huddle, { huddleId, channelId: ensured.huddle.channelId, dmId: ensured.huddle.dmId, startedBy: uid(), video: !!ensured.huddle.video });
            }

            // The plan's people-per-call limit (free: 10); someone already in the call may always re-join.
            // The registry checks it in the same step that adds the person (no await in between).
            const source = planSourceOf(ensured.huddle);
            const limits = await planLimits(source.workspaceId, { userId: source.userId });
            const joined = registry.join(huddleId, { userId: uid(), username, audioEnabled, videoEnabled, socketId: socket.id, max: limits?.participants || null });
            if (joined.error === 'PLAN_LIMIT') {
                const { planLimitBody } = require('../../shared/plans/plans');
                const body = planLimitBody('huddles.participants', { max: limits.participants, used: joined.used, plan: limits.plan });
                return socket.emit('huddle:error', { huddleId, ...body,
                    message: `This call is full: the free plan allows ${limits.participants} people in a call at once. Pro and Enterprise are coming soon.` });
            }
            if (joined.error === 'HUDDLE_FULL') {
                return huddleError(socket, huddleId, 'HUDDLE_FULL', `This huddle is full (max ${registry.maxParticipants} people).`);
            }
            if (joined.error) return huddleError(socket, huddleId, joined.error, 'Could not join huddle');
            history.joined(huddleId, { userId: uid(), username });
            const meetingId = await meetingIdFor(registry, huddleId);

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
            let timeLimit = null;
            if (limits && limits.minutes) {
                const start = new Date(joined.huddle.startedAt).getTime();
                timeLimit = { maxMinutes: limits.minutes, startedAt: new Date(start).toISOString(), endsAt: new Date(start + limits.minutes * 60000).toISOString() };
            }
            const maxParticipants = limits && limits.participants ? Math.min(limits.participants, registry.maxParticipants) : registry.maxParticipants;
            socket.emit('huddle:roster', { huddleId, meetingId, participants: joined.others, maxParticipants, video: !!joined.huddle.video, timeLimit });
            socket.to(room).emit('huddle:joined', { huddleId, meetingId, userId: uid(), username, audioEnabled: audioEnabled !== false, videoEnabled: !!videoEnabled, timestamp: new Date() });

            const scoped = scopeRoom(registryScope(check.scope));
            if (scoped) io.to(scoped).emit('huddle:participant_joined', { huddleId, meetingId, userId: uid() });
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
        // Ending the huddle also completes its meeting (and "End meeting" on the meeting page ends the huddle).
        endHuddle(io, huddleId, 'ended', { registry, history, meetings });
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

    // Active huddles this socket can see in a workspace, so a fresh page load shows live huddles:
    // workspace huddles, and channel and DM huddles of conversations this socket is in.
    socket.on('huddle:list', (data = {}, ack) => {
        if (typeof ack !== 'function') return;
        const workspaceId = data.workspaceId ? String(data.workspaceId) : null;
        if (!workspaceId || !socket.rooms.has(`workspace:${workspaceId}`)) return ack({ huddles: [] });
        const huddles = registry.list(h => h.workspaceId === workspaceId && (
            h.channelId ? socket.rooms.has(`channel:${h.channelId}`)
                : h.dmId ? socket.rooms.has(`dm:${h.dmId}`)
                    : true
        ));
        ack({ huddles });
    });

    // Raise or lower a hand; everyone in the call sees it.
    socket.on('huddle:hand', (data = {}) => {
        const { huddleId, raised } = data;
        if (!huddleId || !registry.setHand(huddleId, uid(), raised)) return;
        io.to(`huddle:${huddleId}`).emit('huddle:hand_changed', { huddleId, userId: uid(), raised: !!raised });
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
            const { noteId, applied, meetingId = null } = await notesOp({ userId: uid(), username, huddleId, op, io });
            socket.to(`huddle:${huddleId}`).emit('huddle:notes_op', { huddleId, meetingId, noteId, applied, by: { userId: uid(), username } });
            reply({ ok: true, noteId, meetingId, applied });
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
module.exports.endHuddle = endHuddle;
module.exports.announceEnded = announceEnded;
module.exports.defaultPlanLimits = defaultPlanLimits;
module.exports.verifyScopeMembership = verifyScopeMembership;
module.exports.planMeta = planMeta;
