const express = require('express');
const router = express.Router();
const User = require('../../../models/User');
const Department = require('../../../models/Department');
const Workspace = require('../../../models/Workspace');
const AuditLog = require('../../../models/AuditLog');
const requireAuth = require('../../../middleware/auth');
const { requireAdmin } = require('../../../middleware/permissionMiddleware');

/**
 * GET /api/admin-dashboard/users-access
 * User management and access stats
 */
router.get('/users-access', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);
        const companyId = user.companyId;

        const [total, active, pending, suspended, blocked, guests] = await Promise.all([
            User.countDocuments({ companyId }),
            User.countDocuments({ companyId, accountStatus: 'active' }),
            User.countDocuments({ companyId, accountStatus: 'pending' }),
            User.countDocuments({ companyId, accountStatus: 'suspended' }),
            User.countDocuments({ companyId, accountStatus: 'blocked' }),
            User.countDocuments({ companyId, companyRole: 'guest' })
        ]);

        // Get recent invites (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentInvites = await User.find({
            companyId,
            accountStatus: 'pending',
            createdAt: { $gte: sevenDaysAgo }
        })
            .select('username email createdAt')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

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
        console.error('Admin Dashboard Users Access Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * GET /api/admin-dashboard/departments
 * Department structure and management
 */
router.get('/departments', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);
        const companyId = user.companyId;

        const departments = await Department.find({ company: companyId })
            .populate('managers', 'username email')
            .lean();

        // Attach user count to each department
        for (const dept of departments) {
            dept.userCount = await User.countDocuments({
                companyId,
                departments: dept._id
            });
        }

        res.json({ departments });
    } catch (error) {
        console.error('Admin Dashboard Departments Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * GET /api/admin-dashboard/workspaces-access
 * Workspace access and management view
 */
router.get('/workspaces-access', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);
        const companyId = user.companyId;

        const workspaces = await Workspace.find({ company: companyId })
            .populate('members.user', 'username email')
            .populate('department', 'name')
            .lean();

        // Enhance with activity data
        const Message = require("../messages/message.model.js");
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
        console.error('Admin Dashboard Workspaces Access Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * GET /api/admin-dashboard/audit-security
 * Audit logs and security events
 */
router.get('/audit-security', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);
        const companyId = user.companyId;

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Get recent audit actions
        const recentActions = await AuditLog.find({
            companyId,
            createdAt: { $gte: sevenDaysAgo }
        })
            .populate('userId', 'username email')
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        // Count role changes and permission changes
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
        console.error('Admin Dashboard Audit Security Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * GET /api/admin-dashboard/workspaces
 * Get all company workspaces with detailed information
 */
router.get('/workspaces', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);
        const companyId = user.companyId;

        // Find all workspaces for the company
        const workspaces = await Workspace.find({ company: companyId })
            .populate('createdBy', 'username email')
            .populate('department', 'name')
            .lean();

        // Get Channel model for counting
        const Channel = require("../channels/channel.model.js");

        // Enhance each workspace with additional data
        const enhancedWorkspaces = await Promise.all(workspaces.map(async (workspace) => {
            // Count channels in this workspace
            const channelCount = await Channel.countDocuments({ workspace: workspace._id });

            // Get member count (only active members)
            const memberCount = workspace.members.filter(m => m.status === 'active').length;

            // Find admin/owner of workspace
            const adminMember = workspace.members.find(m =>
                m.role === 'owner' || m.role === 'admin'
            );

            let admin = null;
            if (adminMember) {
                const adminUser = await User.findById(adminMember.user).select('username email').lean();
                admin = adminUser;
            }

            // Determine status
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
                admin: admin || workspace.createdBy, // Fallback to creator if no admin found
                department: workspace.department,
                createdAt: workspace.createdAt,
                updatedAt: workspace.updatedAt,
                lastActivityAt: workspace.lastActivityAt
            };
        }));

        res.json({ workspaces: enhancedWorkspaces });
    } catch (error) {
        console.error('Admin Dashboard Workspaces Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


/**
 * GET /api/admin-dashboard/company-members
 * List all active members of the company (for the "add member" picker)
 * Only returns users that belong to the same company as the requester
 */
router.get('/company-members', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);
        const companyId = user.companyId;

        if (!companyId) {
            return res.status(403).json({ message: 'No company associated with this account' });
        }

        const members = await User.find({
            companyId,
            accountStatus: { $in: ['active', 'pending'] }
        })
            .select('_id username email companyEmail profilePicture companyRole jobTitle accountStatus')
            .sort({ username: 1 })
            .lean();

        res.json({ members });
    } catch (error) {
        console.error('Company Members Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

/**
 * GET /api/admin-dashboard/workspaces/:workspaceId/members
 * List members of a specific company workspace
 */
router.get('/workspaces/:workspaceId/members', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);
        const companyId = user.companyId;
        const { workspaceId } = req.params;

        const workspace = await Workspace.findById(workspaceId)
            .populate('members.user', '_id username email profilePicture companyRole jobTitle isOnline')
            .lean();

        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        // Enforce company isolation — workspace must belong to caller's company
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
        console.error('Workspace Members Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

/**
 * POST /api/admin-dashboard/workspaces/:workspaceId/members
 * Add a company member to a workspace (direct add, no invite link needed)
 * Security: target user MUST be a member of the same company
 */
router.post('/workspaces/:workspaceId/members', requireAuth, requireAdmin, async (req, res) => {
    try {
        const callerId = req.user.sub || req.user._id;
        const caller = await User.findById(callerId);
        const companyId = caller.companyId;
        const { workspaceId } = req.params;
        const { userId: targetUserId, role = 'member' } = req.body;

        if (!targetUserId) {
            return res.status(400).json({ message: 'userId is required' });
        }

        // Validate role
        const allowedRoles = ['member', 'admin'];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ message: 'role must be member or admin' });
        }

        // Fetch workspace — must belong to caller's company
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }
        if (!workspace.company || String(workspace.company) !== String(companyId)) {
            return res.status(403).json({ message: 'This workspace does not belong to your company' });
        }

        // Fetch target user — MUST be a member of the same company (no external users)
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (!targetUser.companyId || String(targetUser.companyId) !== String(companyId)) {
            return res.status(403).json({
                message: 'You can only add members from your own company to this workspace'
            });
        }

        // Check not already a member
        const alreadyMember = workspace.members.some(
            m => String(m.user) === String(targetUserId)
        );
        if (alreadyMember) {
            return res.status(400).json({ message: 'User is already a member of this workspace' });
        }

        // Add to workspace
        workspace.members.push({
            user: targetUserId,
            role,
            status: 'active',
            joinedAt: new Date()
        });
        await workspace.save();

        // Add workspace to user's workspaces list (single source of truth)
        const alreadyInUserList = targetUser.workspaces.some(
            w => String(w.workspace) === String(workspaceId)
        );
        if (!alreadyInUserList) {
            targetUser.workspaces.push({ workspace: workspaceId, role, joinedAt: new Date() });
            await targetUser.save();
        }

        // Auto-join default channels
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
        console.error('Add Workspace Member Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

/**
 * DELETE /api/admin-dashboard/workspaces/:workspaceId/members/:userId
 * Remove a member from a company workspace
 */
router.delete('/workspaces/:workspaceId/members/:userId', requireAuth, requireAdmin, async (req, res) => {
    try {
        const callerId = req.user.sub || req.user._id;
        const caller = await User.findById(callerId);
        const companyId = caller.companyId;
        const { workspaceId, userId: targetUserId } = req.params;

        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        // Company isolation check
        if (!workspace.company || String(workspace.company) !== String(companyId)) {
            return res.status(403).json({ message: 'This workspace does not belong to your company' });
        }

        // Cannot remove the workspace owner
        const targetMember = workspace.members.find(m => String(m.user) === String(targetUserId));
        if (!targetMember) {
            return res.status(404).json({ message: 'User is not a member of this workspace' });
        }
        if (targetMember.role === 'owner') {
            return res.status(403).json({ message: 'Cannot remove the workspace owner' });
        }

        // Remove from workspace
        workspace.members = workspace.members.filter(m => String(m.user) !== String(targetUserId));
        await workspace.save();

        // Remove from user's workspaces list
        await User.findByIdAndUpdate(targetUserId, {
            $pull: { workspaces: { workspace: workspace._id } }
        });

        res.json({ message: 'Member removed from workspace' });
    } catch (error) {
        console.error('Remove Workspace Member Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
