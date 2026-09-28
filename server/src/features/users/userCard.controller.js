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
const User = require('../../../models/User');
const Workspace = require('../../../models/Workspace');
const { isValidId } = require('../../shared/utils/workspaceAccess');

let presence = null;
try { presence = require('../presence/presence.service'); } catch { presence = null; }

const CARD_FIELDS = 'username email companyEmail profilePicture profile.name profile.about jobTitle departments '
    + 'companyId companyRole userType preferences.region.timezone preferences.privacy.allowDiscovery '
    + 'isOnline userStatus lastActivityAt lastLoginAt accountStatus';

const GONE = new Set(['removed', 'blocked']);

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const same = (a, b) => a != null && b != null && String(a) === String(b);
const memberUserId = (m) => (m && m.user && m.user._id ? m.user._id : m && m.user);
const activeMember = (m) => (m.status || 'active') === 'active';

function loadUser(query) {
    return query.select(CARD_FIELDS).populate('departments', 'name').lean();
}

/** The workspace member entry for userId, or null. */
function findMember(workspace, userId) {
    return (workspace?.members || []).find((m) => same(memberUserId(m), userId)) || null;
}

/** Live presence first (socket map), stored flags otherwise. */
function presenceOf(user) {
    const entry = presence?.getPresence ? presence.getPresence(String(user._id)) : null;
    const liveOnline = entry ? entry.status !== 'offline' : null;
    const isOnline = liveOnline != null ? liveOnline : !!user.isOnline;
    const lastSeen = (entry && entry.lastSeen) || user.lastActivityAt || user.lastLoginAt || null;
    let userStatus = user.userStatus || 'active';
    if (entry && entry.status === 'idle' && userStatus === 'active') userStatus = 'away';
    return { isOnline, userStatus, lastSeen };
}

function buildCard(user, { workspaceRole = null, showEmail = true, sameCompany = false } = {}) {
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
        ...presenceOf(user),
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
        const shared = await Workspace.findOne({
            $and: [
                { members: { $elemMatch: { user: viewerId, status: { $nin: ['removed', 'suspended'] } } } },
                { members: { $elemMatch: { user: target._id, status: { $ne: 'removed' } } } },
            ],
        }).select('_id').lean();
        sharesWorkspace = !!shared;
    }

    const viewer = await User.findById(viewerId).select('companyId').lean();
    const sameCompany = !!viewer?.companyId && same(viewer.companyId, target.companyId);

    if (!isSelf && !sharesWorkspace && !sameCompany) {
        return res.status(403).json({ message: 'You can only view people you work with', code: 'NOT_A_COWORKER' });
    }

    const discoverable = target.preferences?.privacy?.allowDiscovery !== false;
    const showEmail = isSelf || sharesWorkspace || discoverable;
    return res.json({ card: buildCard(target, { workspaceRole, showEmail, sameCompany: sameCompany || isSelf }) });
}

async function loadWorkspace(workspaceId) {
    if (!workspaceId) return null;
    return Workspace.findById(workspaceId).select('members.user members.role members.status company').lean();
}

exports.getCardById = async (req, res) => {
    try {
        const { id } = req.params;
        const { workspaceId } = req.query;
        if (!isValidId(id)) return res.status(400).json({ message: 'Invalid user id' });
        if (workspaceId && !isValidId(workspaceId)) return res.status(400).json({ message: 'Invalid workspaceId' });

        const [target, workspace] = await Promise.all([loadUser(User.findById(id)), loadWorkspace(workspaceId)]);
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
        const target = await loadUser(User.findOne({
            _id: { $in: memberIds },
            username: new RegExp(`^${escapeRegex(name)}$`, 'i'),
        }));
        return await respond(req, res, target, workspace);
    } catch (err) {
        logger.error('USER CARD (username) ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports._internal = { buildCard, presenceOf };
