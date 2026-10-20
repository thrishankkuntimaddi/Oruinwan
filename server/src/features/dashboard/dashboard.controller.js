const identity = require('../../identity');
const org = require('../../identity/queries/org');
const Tasks = require('../tasks/tasks.query');
const analyticsService = require('../analytics/analytics.service');

const mongoose = require('mongoose');

const isCoOwnerOf = (user) => !!(user && user.coOwnerOf && user.companyId && String(user.coOwnerOf) === String(user.companyId));

async function _resolveCompanyId(userId) {
    const user = await identity.users.findById(userId);
    if (!user) throw Object.assign(new Error('User not found'), { status: 401 });
    return { companyId: user.companyId?.toString(), companyRole: user.companyRole, isCoOwner: isCoOwnerOf(user) };
}

exports.getDashboardMetrics = async (req, res) => {
    try {
        const { companyId } = req.params;
        const userId = req.user.sub;

        const requestingUser = await identity.users.findById(userId);
        if (!requestingUser) return res.status(401).json({ message: 'User not found' });
        if (!requestingUser.companyId || requestingUser.companyId.toString() !== String(companyId)) return res.status(403).json({ message: 'Access denied' });

        const adminRoles = ['owner', 'admin'];
        if (!adminRoles.includes(requestingUser.companyRole) && !isCoOwnerOf(requestingUser)) {
            return res.status(403).json({ message: 'Admin privileges required' });
        }

        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const workspaces = await org.workspaces.find({ company: companyId });

        // Privacy: workspace health comes from members and tasks, never from messages
        // (end-to-end encrypted; admins do not see who talks or how much).
        const live = { deleted: { $ne: true } };
        const [totalUsers, activeUsers, openTasks, tasksCompletedToday, workspaceHealthData] = await Promise.all([
            org.users.count({ companyId }),
            org.users.count({ companyId, $or: [{ isOnline: true }, { lastActivityAt: { $gte: sevenDaysAgo } }] }),
            Tasks.countDocuments({ ...live, company: companyId, status: { $in: ['todo', 'in_progress', 'review', 'blocked'] } }),
            Tasks.countDocuments({ ...live, company: companyId, status: 'done', completedAt: { $gte: todayStart } }),
            Promise.all(workspaces.map(async ws => {
                const [wsOpen, recentTasks] = await Promise.all([
                    Tasks.countDocuments({ ...live, workspace: ws._id, status: { $in: ['todo', 'in_progress', 'review', 'blocked'] } }),
                    Tasks.countDocuments({ ...live, workspace: ws._id, updatedAt: { $gte: sevenDaysAgo } }),
                ]);
                let lastActivity = 'No activity';
                if (ws.updatedAt) {
                    const diffMins = Math.floor((Date.now() - new Date(ws.updatedAt).getTime()) / 60000);
                    const diffHours = Math.floor(diffMins / 60);
                    const diffDays = Math.floor(diffHours / 24);
                    if (diffMins < 1) lastActivity = 'Just now';
                    else if (diffMins < 60) lastActivity = `${diffMins}m ago`;
                    else if (diffHours < 24) lastActivity = `${diffHours}h ago`;
                    else lastActivity = `${diffDays}d ago`;
                }
                return { _id: ws._id, name: ws.name, memberCount: (ws.members || []).filter((m) => m.status === 'active').length, lastActivity, isInactive: recentTasks === 0, openTasks: wsOpen };
            }))
        ]);

        const pendingInvites = await org.users.find({ companyId, accountStatus: { $in: ['pending', 'invited'] } }, { select: 'email createdAt' });
        const recentlyJoined = await org.users.find({ companyId, createdAt: { $gte: sevenDaysAgo } }, { select: 'username email profilePicture createdAt', sort: { createdAt: -1 }, limit: 5 });

        return res.json({
            snapshot: { totalUsers, activeUsers, totalWorkspaces: workspaces.length, openTasks },
            todayActivity: { tasksCompletedToday },
            workspaceHealth: workspaceHealthData,
            peopleAccess: { pendingInvites, recentlyJoined }
        });
    } catch (err) {
        return res.status(err.status || 500).json({ message: err.message || 'Server error' });
    }
};

exports.getAdminDashboard = async (req, res) => {
    res.status(501).json({ message: 'Not implemented yet' });
};

exports.getEmployeeDashboard = async (req, res) => {
    try {
        const callerId = String(req.user.sub);
        const targetId = req.params.userId === 'me' ? callerId : String(req.params.userId);
        if (!mongoose.Types.ObjectId.isValid(targetId)) return res.status(400).json({ message: 'Invalid user id' });

        if (targetId !== callerId) {
            const [caller, target] = await Promise.all([
                identity.users.findById(callerId),
                identity.users.findById(targetId),
            ]);
            const isAdmin = caller && (['owner', 'admin'].includes(caller.companyRole) || isCoOwnerOf(caller));
            if (!isAdmin || !caller.companyId || !target || String(target.companyId) !== String(caller.companyId)) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }

        const Note = require('../../../models/Note');
        const Update = require('../../../models/Update');
        const uid = new mongoose.Types.ObjectId(targetId);
        const taskFilter = { deleted: { $ne: true }, $or: [{ assignedTo: uid }, { createdBy: uid }] };
        // An admin opening someone else's dashboard sees only that person's public notes,
        // never their private ones.
        const noteFilter = targetId === callerId ? { owner: uid } : { owner: uid, isPublic: true };
        const [myTasks, totalTasks, completedTasks, myNotes, totalNotes, recentUpdates] = await Promise.all([
            Tasks.find(taskFilter, { select: 'title status priority dueDate workspace updatedAt', sort: { updatedAt: -1 }, limit: 10 }),
            Tasks.countDocuments(taskFilter),
            Tasks.countDocuments({ ...taskFilter, status: 'done' }),
            Note.find({ ...noteFilter, isArchived: { $ne: true } }).select('title type updatedAt workspace').sort({ updatedAt: -1 }).limit(10).lean(),
            Note.countDocuments(noteFilter),
            Update.find({ postedBy: uid }).sort({ createdAt: -1 }).limit(5).lean(),
        ]);

        return res.json({ myTasks, myNotes, recentUpdates, stats: { totalTasks, completedTasks, totalNotes } });
    } catch (err) {
        return res.status(err.status || 500).json({ message: err.message || 'Server error' });
    }
};

exports.getWorkspaceDashboard = async (req, res) => {
    res.status(501).json({ message: 'Not implemented yet' });
};

exports.getAnalyticsSummary = async (req, res) => {
    try {
        const { companyId } = await _resolveCompanyId(req.user.sub);
        if (!companyId) return res.status(400).json({ message: 'No company associated with this account' });
        const period = Math.min(parseInt(req.query.period) || 30, 365);
        const data = await analyticsService.getAnalyticsSummary(companyId, period);
        res.json(data);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Server error' });
    }
};

exports.getUserActivityAnalytics = async (req, res) => {
    try {
        const { companyId } = await _resolveCompanyId(req.user.sub);
        if (!companyId) return res.status(400).json({ message: 'No company associated' });
        const period = Math.min(parseInt(req.query.period) || 30, 365);
        const data = await analyticsService.getUserActivityAnalytics(companyId, period);
        res.json(data);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Server error' });
    }
};

exports.getWorkspaceAnalytics = async (req, res) => {
    try {
        const { companyId } = await _resolveCompanyId(req.user.sub);
        if (!companyId) return res.status(400).json({ message: 'No company associated' });
        const period = Math.min(parseInt(req.query.period) || 30, 365);
        const data = await analyticsService.getWorkspaceAnalytics(companyId, period);
        res.json(data);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Server error' });
    }
};

exports.getChannelEngagementAnalytics = async (req, res) => {
    try {
        const { companyId } = await _resolveCompanyId(req.user.sub);
        if (!companyId) return res.status(400).json({ message: 'No company associated' });
        const period = Math.min(parseInt(req.query.period) || 30, 365);
        const data = await analyticsService.getChannelEngagementAnalytics(companyId, period);
        res.json(data);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Server error' });
    }
};

exports.getTaskAnalytics = async (req, res) => {
    try {
        const { companyId } = await _resolveCompanyId(req.user.sub);
        if (!companyId) return res.status(400).json({ message: 'No company associated' });
        const period = Math.min(parseInt(req.query.period) || 30, 365);
        const data = await analyticsService.getTaskAnalytics(companyId, period);
        res.json(data);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Server error' });
    }
};

exports.getEngagementTrends = async (req, res) => {
    try {
        const { companyId } = await _resolveCompanyId(req.user.sub);
        if (!companyId) return res.status(400).json({ message: 'No company associated' });
        const period = Math.min(parseInt(req.query.period) || 30, 365);
        const data = await analyticsService.getEngagementTrends(companyId, period);
        res.json(data);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Server error' });
    }
};
