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
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
        console.error('Admin Dashboard Workspaces Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
