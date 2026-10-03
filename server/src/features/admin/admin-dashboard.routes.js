const logger = require('../../../utils/logger');
const { replicaRead } = require('../../shared/db');
const express = require('express');
const router = express.Router();
const identity = require('../../identity');
const org = require('../../identity/queries/org');
const { hydrate } = require('../../identity/hydrate');

const USER_EMAIL = { type: 'user', fields: ['username', 'email'] };
const DEPT_NAME = { type: 'department', fields: ['name'] };
const AuditLog = require('../../../models/AuditLog');
const requireAuth = require('../../shared/middleware/auth');
const { requireAdmin } = require('../../shared/middleware/permissionMiddleware');

router.get('/users-access', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await identity.users.findById(userId);
        const companyId = user.companyId;

        const [total, active, pending, suspended, blocked, guests] = await Promise.all([
            org.users.count({ companyId, accountStatus: { $ne: 'removed' } }),
            org.users.count({ companyId, accountStatus: 'active' }),
            // Onboarding creates 'invited' users; both count as pending.
            org.users.count({ companyId, accountStatus: { $in: ['pending', 'invited'] } }),
            org.users.count({ companyId, accountStatus: 'suspended' }),
            org.users.count({ companyId, accountStatus: 'blocked' }),
            org.users.count({ companyId, companyRole: 'guest', accountStatus: { $ne: 'removed' } })
        ]);

        
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentInvites = await org.users.find({
            companyId,
            accountStatus: { $in: ['pending', 'invited'] },
            createdAt: { $gte: sevenDaysAgo }
        }, { select: 'username email accountStatus createdAt', sort: { createdAt: -1 }, limit: 10 });

        res.json({
            stats: {
                total,
                active,
                pending,
                suspended,
                blocked,
                guests
            },
            recentInvites,
            actions: {
                inviteUsers: true,
                bulkUpload: true,
                assignRoles: true,
                assignDepartments: true
            }
        });
    } catch (error) {
        logger.error('Admin Dashboard Users Access Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/departments', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await identity.users.findById(userId);
        const companyId = user.companyId;

        const departments = await org.departments.find({ company: companyId });
        await hydrate(departments, { managers: USER_EMAIL });

        // Live member counts in one grouped query.
        const sizes = new Map((await org.departmentSizes(companyId)).map((d) => [String(d._id), d.members]));
        for (const dept of departments) {
            dept.userCount = sizes.get(String(dept._id)) || 0;
        }

        res.json({ departments });
    } catch (error) {
        logger.error('Admin Dashboard Departments Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/workspaces-access', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await identity.users.findById(userId);
        const companyId = user.companyId;

        const workspaces = (await org.workspaces.find({ company: companyId }))
            .map((w) => ({ ...w, members: w.members.filter((m) => m.status !== 'removed') }));
        await hydrate(workspaces, { 'members.user': USER_EMAIL, department: DEPT_NAME });

        
        const Message = require("../../modules/messages/message.model.js");
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        for (const workspace of workspaces) {
            const messageCount = await Message.countDocuments({
                workspace: workspace._id,
                createdAt: { $gte: sevenDaysAgo }
            });

            workspace.memberCount = workspace.members.length;
            workspace.owners = workspace.members
                .filter(m => m.role === 'owner')
                .map(m => m.user);
            workspace.managers = workspace.members
                .filter(m => m.role === 'admin')
                .map(m => m.user);
            workspace.activity = messageCount > 100 ? 'high' : messageCount > 20 ? 'medium' : 'low';
            workspace.lastActive = workspace.updatedAt;
        }

        res.json({ workspaces });
    } catch (error) {
        logger.error('Admin Dashboard Workspaces Access Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/audit-security', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await identity.users.findById(userId);
        const companyId = user.companyId;

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        
        const recentActions = await replicaRead(AuditLog.find({
            companyId,
            createdAt: { $gte: sevenDaysAgo }
        }))
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        await hydrate(recentActions, { userId: USER_EMAIL });

        
        const [roleChanges, permissionChanges] = await Promise.all([
            AuditLog.countDocuments({
                companyId,
                action: { $in: ['role_changed', 'user_promoted', 'user_demoted'] },
                createdAt: { $gte: sevenDaysAgo }
            }),
            AuditLog.countDocuments({
                companyId,
                action: { $regex: /permission|access/i },
                createdAt: { $gte: sevenDaysAgo }
            })
        ]);

        res.json({
            recentActions: recentActions.map(action => ({
                action: action.action,
                actor: action.userId?.username || 'System',
                description: action.description,
                timestamp: action.createdAt
            })),
            roleChanges,
            permissionChanges
        });
    } catch (error) {
        logger.error('Admin Dashboard Audit Security Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/workspaces', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await identity.users.findById(userId);
        const companyId = user.companyId;

        
        const workspaces = await org.workspaces.find({ company: companyId });
        await hydrate(workspaces, { createdBy: USER_EMAIL, department: DEPT_NAME });

        
        const Channel = require("../channels/channel.model.js");

        
        const enhancedWorkspaces = await Promise.all(workspaces.map(async (workspace) => {
            
            const channelCount = await Channel.countDocuments({ workspace: workspace._id });

            
            const memberCount = workspace.members.filter(m => m.status === 'active').length;

            const adminMember = workspace.members.find(m =>
                m.status === 'active' && (m.role === 'owner' || m.role === 'admin')
            );

            let admin = null;
            if (adminMember) {
                const adminUser = await identity.users.findById(adminMember.user);
                admin = adminUser;
            }

            
            const status = workspace.isArchived ? 'archived' : (workspace.isActive ? 'active' : 'inactive');

            return {
                _id: workspace._id,
                name: workspace.name,
                description: workspace.description || '',
                icon: workspace.icon || '📁',
                color: workspace.color || '#2563eb',
                memberCount,
                channelCount,
                status,
                admin: admin || workspace.createdBy, 
                department: workspace.department,
                createdAt: workspace.createdAt,
                updatedAt: workspace.updatedAt,
                lastActivityAt: workspace.lastActivityAt
            };
        }));

        res.json({ workspaces: enhancedWorkspaces });
    } catch (error) {
        logger.error('Admin Dashboard Workspaces Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/company-members', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await identity.users.findById(userId);
        const companyId = user.companyId;

        if (!companyId) {
            return res.status(403).json({ message: 'No company associated with this account' });
        }

        const members = await org.users.find({
            companyId,
            accountStatus: { $in: ['active', 'pending'] }
        }, { select: '_id username email companyEmail profilePicture companyRole jobTitle accountStatus', sort: { username: 1 } });

        res.json({ members });
    } catch (error) {
        logger.error('Company Members Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/workspaces/:workspaceId/members', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await identity.users.findById(userId);
        const companyId = user.companyId;
        const { workspaceId } = req.params;

        const workspace = await identity.workspaces.findById(workspaceId);
        if (workspace) {
            workspace.members = workspace.members.filter((m) => m.status !== 'removed');
            await hydrate(workspace, { 'members.user': { type: 'user', fields: ['username', 'email', 'profilePicture', 'companyRole', 'jobTitle', 'isOnline'] } });
            workspace.members = workspace.members.filter((m) => m.user);
        }

        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        
        if (!workspace.company || String(workspace.company) !== String(companyId)) {
            return res.status(403).json({ message: 'This workspace does not belong to your company' });
        }

        const members = workspace.members.map(m => ({
            _id: m.user._id,
            username: m.user.username,
            email: m.user.email,
            profilePicture: m.user.profilePicture,
            companyRole: m.user.companyRole,
            jobTitle: m.user.jobTitle,
            isOnline: m.user.isOnline,
            workspaceRole: m.role,
            status: m.status || 'active',
            joinedAt: m.joinedAt
        }));

        res.json({ members });
    } catch (error) {
        logger.error('Workspace Members Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.post('/workspaces/:workspaceId/members', requireAuth, requireAdmin, async (req, res) => {
    try {
        const callerId = req.user.sub || req.user._id;
        const caller = await identity.users.findById(callerId);
        const companyId = caller.companyId;
        const { workspaceId } = req.params;
        const { userId: targetUserId, role = 'member' } = req.body;

        if (!targetUserId) {
            return res.status(400).json({ message: 'userId is required' });
        }

        
        const allowedRoles = ['member', 'admin'];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ message: 'role must be member or admin' });
        }

        
        const workspace = await identity.workspaces.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }
        if (!workspace.company || String(workspace.company) !== String(companyId)) {
            return res.status(403).json({ message: 'This workspace does not belong to your company' });
        }

        
        const targetUser = await identity.users.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (!targetUser.companyId || String(targetUser.companyId) !== String(companyId)) {
            return res.status(403).json({
                message: 'You can only add members from your own company to this workspace'
            });
        }

        
        const alreadyMember = workspace.members.some(
            m => m.status === 'active' && String(m.user) === String(targetUserId)
        );
        if (alreadyMember) {
            return res.status(400).json({ message: 'User is already a member of this workspace' });
        }

        
        // One membership row serves both the workspace's member list and the user's workspaces.
        await identity.workspaces.addMember(workspaceId, targetUserId, { role });

        
        const Channel = require('../channels/channel.model.js');
        const defaultChannels = await Channel.find({ workspace: workspaceId, isDefault: true });
        for (const channel of defaultChannels) {
            const isChanMember = channel.members.some(m => {
                const mid = m.user ? m.user.toString() : m.toString();
                return mid === String(targetUserId);
            });
            if (!isChanMember) {
                channel.members.push({ user: targetUserId, joinedAt: new Date() });
                await channel.save();
            }
        }

        res.json({
            message: `${targetUser.username} added to workspace successfully`,
            member: {
                _id: targetUser._id,
                username: targetUser.username,
                email: targetUser.email,
                profilePicture: targetUser.profilePicture,
                companyRole: targetUser.companyRole,
                jobTitle: targetUser.jobTitle,
                workspaceRole: role,
                status: 'active',
                joinedAt: new Date()
            }
        });
    } catch (error) {
        logger.error('Add Workspace Member Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.delete('/workspaces/:workspaceId/members/:userId', requireAuth, requireAdmin, async (req, res) => {
    try {
        const callerId = req.user.sub || req.user._id;
        const caller = await identity.users.findById(callerId);
        const companyId = caller.companyId;
        const { workspaceId, userId: targetUserId } = req.params;

        const workspace = await identity.workspaces.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        
        if (!workspace.company || String(workspace.company) !== String(companyId)) {
            return res.status(403).json({ message: 'This workspace does not belong to your company' });
        }

        
        const targetMember = workspace.members.find(m => m.status !== 'removed' && String(m.user) === String(targetUserId));
        if (!targetMember) {
            return res.status(404).json({ message: 'User is not a member of this workspace' });
        }
        if (targetMember.role === 'owner') {
            return res.status(403).json({ message: 'Cannot remove the workspace owner' });
        }

        
        await identity.workspaces.removeMember(workspace._id, targetUserId, { by: callerId });

        res.json({ message: 'Member removed from workspace' });
    } catch (error) {
        logger.error('Remove Workspace Member Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
