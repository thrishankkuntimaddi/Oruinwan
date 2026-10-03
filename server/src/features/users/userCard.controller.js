'use strict';

/**
 * Profile card for @mentions and message headers.
 *
 *   GET /api/users/:id/card?workspaceId=
 *   GET /api/users/card?username=&workspaceId=     (mentions carry a username)
 *
 * A viewer sees the card of someone they share an active workspace with, or of
 * a co-worker in the same company. Anyone else gets 403. Email is shown to
 * workspace co-members; a company co-worker who shares no workspace sees it only
 * when the person allows discovery (preferences.privacy.allowDiscovery).
 */

const logger = require('../../../utils/logger');
const identity = require('../../identity');
const { query } = require('../../shared/postgres');
const { isValidId } = require('../../shared/utils/workspaceAccess');

let presence = null;
try { presence = require('../presence/presence.service'); } catch { presence = null; }

const GONE = new Set(['removed', 'blocked']);

const same = (a, b) => a != null && b != null && String(a) === String(b);
const memberUserId = (m) => (m && m.user && m.user._id ? m.user._id : m && m.user);
const activeMember = (m) => (m.status || 'active') === 'active';

/** The user with `departments` as [{ _id, name }] (what populate('departments', 'name') gave). */
async function loadUser(user) {
    if (!user) return null;
    const { rows } = await query(
        `SELECT d.id, d.name FROM department_members m JOIN departments d ON d.id = m.department_id WHERE m.user_id = $1 ORDER BY d.name`,
        [user._id]
    );
    user.departments = rows.map((r) => ({ _id: r.id, name: r.name }));
    return user;
}

/** The workspace member entry for userId, or null. */
function findMember(workspace, userId) {
    return (workspace?.members || []).find((m) => same(memberUserId(m), userId)) || null;
}

/** Live presence first (any instance, prefetched by `livePresence`), stored flags otherwise. */
function presenceOf(user, entry) {
    if (entry == null) entry = presence?.getPresence ? presence.getPresence(String(user._id)) : null;
    const liveOnline = entry ? entry.status !== 'offline' : null;
    const isOnline = liveOnline != null ? liveOnline : !!user.isOnline;
    const lastSeen = (entry && entry.lastSeen) || user.lastActivityAt || user.lastLoginAt || null;
    let userStatus = user.userStatus || 'active';
    if (entry && entry.status === 'idle' && userStatus === 'active') userStatus = 'away';
    return { isOnline, userStatus, lastSeen };
}

/** Presence from every server instance (Redis-backed); `presenceOf` falls back to this instance's map. */
async function livePresence(user) {
    if (!presence?.getPresenceAsync) return undefined;
    try { return await presence.getPresenceAsync(String(user._id)); } catch { return undefined; }
}

function buildCard(user, { workspaceRole = null, showEmail = true, sameCompany = false, presenceEntry } = {}) {
    const tz = user.preferences?.region?.timezone;
    const departments = (user.departments || [])
        .map((d) => (d && typeof d === 'object' ? d.name : null))
        .filter(Boolean);
    const isCompanyUser = user.userType === 'company' && !!user.companyId;
    return {
        id: String(user._id),
        username: user.username,
        displayName: user.profile?.name || null,
        email: showEmail ? (isCompanyUser && user.companyEmail ? user.companyEmail : user.email) || null : null,
        profilePicture: user.profilePicture || null,
        about: user.profile?.about || null,
        designation: user.jobTitle || null,
        department: departments.length ? departments.join(', ') : null,
        companyRole: isCompanyUser && sameCompany ? user.companyRole || null : null,
        workspaceRole,
        timezone: tz && tz !== 'auto' ? tz : null,
        ...presenceOf(user, presenceEntry),
    };
}

async function respond(req, res, target, workspace) {
    const viewerId = req.user?.sub;
    if (!target || GONE.has(target.accountStatus)) {
        return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    const isSelf = same(target._id, viewerId);

    // Role in the workspace the mention was seen in (both must belong to it).
    let workspaceRole = null;
    let sharesWorkspace = false;
    if (workspace) {
        const viewerMember = findMember(workspace, viewerId);
        const targetMember = findMember(workspace, target._id);
        if (viewerMember && activeMember(viewerMember) && targetMember && targetMember.status !== 'removed') {
            sharesWorkspace = true;
            workspaceRole = targetMember.role || 'member';
        }
    }
    if (!sharesWorkspace && !isSelf) {
        const { rows } = await query(
            `SELECT 1 FROM workspace_members v JOIN workspace_members t ON t.workspace_id = v.workspace_id
             WHERE v.user_id = $1 AND v.status NOT IN ('removed', 'suspended') AND t.user_id = $2 AND t.status <> 'removed' LIMIT 1`,
            [String(viewerId), String(target._id)]
        );
        sharesWorkspace = rows.length > 0;
    }

    const viewer = await identity.users.findById(viewerId);
    const sameCompany = !!viewer?.companyId && same(viewer.companyId, target.companyId);

    if (!isSelf && !sharesWorkspace && !sameCompany) {
        return res.status(403).json({ message: 'You can only view people you work with', code: 'NOT_A_COWORKER' });
    }

    const discoverable = target.preferences?.privacy?.allowDiscovery !== false;
    const showEmail = isSelf || sharesWorkspace || discoverable;
    const presenceEntry = await livePresence(target);
    return res.json({ card: buildCard(target, { workspaceRole, showEmail, sameCompany: sameCompany || isSelf, presenceEntry }) });
}

async function loadWorkspace(workspaceId) {
    if (!workspaceId) return null;
    return identity.workspaces.findById(workspaceId);
}

exports.getCardById = async (req, res) => {
    try {
        const { id } = req.params;
        const { workspaceId } = req.query;
        if (!isValidId(id)) return res.status(400).json({ message: 'Invalid user id' });
        if (workspaceId && !isValidId(workspaceId)) return res.status(400).json({ message: 'Invalid workspaceId' });

        const [target, workspace] = await Promise.all([identity.users.findById(id).then(loadUser), loadWorkspace(workspaceId)]);
        return await respond(req, res, target, workspace);
    } catch (err) {
        logger.error('USER CARD ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.getCardByUsername = async (req, res) => {
    try {
        const { username, workspaceId } = req.query;
        const name = String(username || '').replace(/^@/, '').trim();
        if (!name || name.length > 64) return res.status(400).json({ message: 'username is required' });
        if (!isValidId(workspaceId)) return res.status(400).json({ message: 'workspaceId is required' });

        const workspace = await loadWorkspace(workspaceId);
        if (!workspace) return res.status(404).json({ message: 'Workspace not found' });
        const viewerMember = findMember(workspace, req.user?.sub);
        if (!viewerMember || !activeMember(viewerMember)) {
            return res.status(403).json({ message: 'You are not a member of this workspace' });
        }

        // Usernames are unique per workspace in practice, not globally: resolve among its members.
        const memberIds = (workspace.members || []).filter((m) => m.status !== 'removed').map(memberUserId);
        const { rows } = await query('SELECT id FROM users WHERE id = ANY($1) AND lower(username) = lower($2) LIMIT 1', [memberIds.map(String), name]);
        const target = rows[0] ? await identity.users.findById(rows[0].id).then(loadUser) : null;
        return await respond(req, res, target, workspace);
    } catch (err) {
        logger.error('USER CARD (username) ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports._internal = { buildCard, presenceOf };
