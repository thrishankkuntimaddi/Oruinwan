const User = require('../../../models/User');
const Workspace = require('../../../models/Workspace');
const Message = require("../../modules/messages/message.model.js");
const _Channel = require("../channels/channel.model.js");
const analyticsService = require('../analytics/analytics.service');

const mongoose = require('mongoose');

const isCoOwnerOf = (user) => !!(user && user.coOwnerOf && user.companyId && String(user.coOwnerOf) === String(user.companyId));

async function _resolveCompanyId(userId) {
    const user = await User.findById(userId).select('companyId companyRole coOwnerOf').lean();
    if (!user) throw Object.assign(new Error('User not found'), { status: 401 });
    return { companyId: user.companyId?.toString(), companyRole: user.companyRole, isCoOwner: isCoOwnerOf(user) };
}

exports.getDashboardMetrics = async (req, res) => {
    try {
        const { companyId } = req.params;
        const userId = req.user.sub;

        const requestingUser = await User.findById(userId).select('companyId companyRole coOwnerOf').lean();
        if (!requestingUser) return res.status(401).json({ message: 'User not found' });
        if (!requestingUser.companyId || requestingUser.companyId.toString() !== String(companyId)) return res.status(403).json({ message: 'Access denied' });

        const adminRoles = ['owner', 'admin'];
        if (!adminRoles.includes(requestingUser.companyRole) && !isCoOwnerOf(requestingUser)) {
            return res.status(403).json({ message: 'Admin privileges required' });
        }

        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const workspaces = await Workspace.find({ company: companyId }).lean();
        const workspaceIds = workspaces.map(w => w._id);

        const [totalUsers, activeUsers, messagesToday, workspaceHealthData] = await Promise.all([
            User.countDocuments({ companyId }),
            User.countDocuments({ companyId, $or: [{ isOnline: true }, { lastActivityAt: { $gte: sevenDaysAgo } }] }),
            Message.countDocuments({ workspace: { $in: workspaceIds }, createdAt: { $gte: todayStart } }),
            Promise.all(workspaces.map(async ws => {
                const lastMessage = await Message.findOne({ workspace: ws._id }).sort({ createdAt: -1 }).lean();
                const messageCount = await Message.countDocuments({ workspace: ws._id, createdAt: { $gte: sevenDaysAgo } });
                let lastActivity = 'No activity';
                if (lastMessage) {
                    const diffMs = Date.now() - new Date(lastMessage.createdAt).getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMins / 60);
                    const diffDays = Math.floor(diffHours / 24);
                    if (diffMins < 1) lastActivity = 'Just now';
                    else if (diffMins < 60) lastActivity = `${diffMins}m ago`;
                    else if (diffHours < 24) lastActivity = `${diffHours}h ago`;
                    else lastActivity = `${diffDays}d ago`;
                }
                return { _id: ws._id, name: ws.name, memberCount: ws.members?.length || 0, lastActivity, isInactive: messageCount === 0, messageCount, openTasks: 0 };
            }))
        ]);

        const pendingInvites = await User.find({ companyId, accountStatus: { $in: ['pending', 'invited'] } }).select('email createdAt').lean();
        const recentlyJoined = await User.find({ companyId, createdAt: { $gte: sevenDaysAgo } }).select('username email profilePicture createdAt').sort({ createdAt: -1 }).limit(5).lean();

        return res.json({
            snapshot: { totalUsers, activeUsers, totalWorkspaces: workspaces.length, openTasks: 0 },
            todayActivity: { messagesToday, tasksCompletedToday: 0, meetingsToday: 0 },
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
                User.findById(callerId).select('companyId companyRole coOwnerOf').lean(),
                User.findById(targetId).select('companyId').lean(),
            ]);
            const isAdmin = caller && (['owner', 'admin'].includes(caller.companyRole) || isCoOwnerOf(caller));
            if (!isAdmin || !caller.companyId || !target || String(target.companyId) !== String(caller.companyId)) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }

        const Task = require('../../../models/Task');
        const Note = require('../../../models/Note');
        const Update = require('../../../models/Update');
        const uid = new mongoose.Types.ObjectId(targetId);
        const taskFilter = { deleted: { $ne: true }, $or: [{ assignedTo: uid }, { createdBy: uid }] };
        const [myTasks, totalTasks, completedTasks, myNotes, totalNotes, recentUpdates] = await Promise.all([
            Task.find(taskFilter).select('title status priority dueDate workspace updatedAt').sort({ updatedAt: -1 }).limit(10).lean(),
            Task.countDocuments(taskFilter),
            Task.countDocuments({ ...taskFilter, status: 'done' }),
            Note.find({ owner: uid, isArchived: { $ne: true } }).select('title type updatedAt workspace').sort({ updatedAt: -1 }).limit(10).lean(),
            Note.countDocuments({ owner: uid }),
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

exports.getMessageVolumeAnalytics = async (req, res) => {
    try {
        const { companyId } = await _resolveCompanyId(req.user.sub);
        if (!companyId) return res.status(400).json({ message: 'No company associated' });
        const period = Math.min(parseInt(req.query.period) || 30, 365);
        const data = await analyticsService.getMessageVolumeAnalytics(companyId, period);
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
