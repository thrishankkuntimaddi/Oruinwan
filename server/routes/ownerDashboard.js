const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Company = require('../models/Company');
const Workspace = require('../models/Workspace');
const Department = require('../models/Department');
const Message = require('../models/Message');
const requireAuth = require('../middleware/auth');
const { requireOwner } = require('../middleware/permissionMiddleware');

/**
 * GET /api/owner-dashboard/overview
 * Organization overview metrics
 */
router.get('/overview', requireAuth, requireOwner, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);
        const companyId = user.companyId;

        const [
            totalUsers,
            activeUsers,
            workspaceCount,
            departmentCount
        ] = await Promise.all([
            User.countDocuments({ companyId }),
            User.countDocuments({ companyId, accountStatus: 'active' }),
            Workspace.countDocuments({ company: companyId }),
            Department.countDocuments({ company: companyId })
        ]);

        // Calculate growth (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [newUsersLast30Days, newWorkspacesLast30Days] = await Promise.all([
            User.countDocuments({ companyId, createdAt: { $gte: thirtyDaysAgo } }),
            Workspace.countDocuments({ company: companyId, createdAt: { $gte: thirtyDaysAgo } })
        ]);

        res.json({
            totalUsers,
            activeUsers,
            workspaceCount,
            departmentCount,
            growthRate: {
                users: newUsersLast30Days,
                workspaces: newWorkspacesLast30Days
            }
        });
    } catch (error) {
        console.error('Owner Dashboard Overview Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * GET /api/owner-dashboard/activity-health
 * Activity and engagement metrics
 */
router.get('/activity-health', requireAuth, requireOwner, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);
        const companyId = user.companyId;

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const [
            messagesLast7Days,
            messagesLast30Days,
            totalWorkspaces,
            activeWorkspaces
        ] = await Promise.all([
            Message.countDocuments({
                company: companyId,
                createdAt: { $gte: sevenDaysAgo }
            }),
            Message.countDocuments({
                company: companyId,
                createdAt: { $gte: thirtyDaysAgo }
            }),
            Workspace.countDocuments({ company: companyId }),
            Message.distinct('workspace', {
                company: companyId,
                createdAt: { $gte: sevenDaysAgo }
            }).then(workspaces => workspaces.length)
        ]);

        const dormantWorkspaces = totalWorkspaces - activeWorkspaces;
        const engagementScore = totalWorkspaces > 0
            ? Math.round((activeWorkspaces / totalWorkspaces) * 100)
            : 0;

        res.json({
            messages: {
                last7days: messagesLast7Days,
                last30days: messagesLast30Days,
                trend: messagesLast7Days > messagesLast30Days / 4 ? 'up' : 'down'
            },
            activeWorkspaces,
            dormantWorkspaces,
            engagementScore
        });
    } catch (error) {
        console.error('Owner Dashboard Activity Health Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * GET /api/owner-dashboard/billing-summary
 * Billing and plan information
 */
router.get('/billing-summary', requireAuth, requireOwner, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);
        const company = await Company.findById(user.companyId);

        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }

        const totalUsers = await User.countDocuments({ companyId: company._id });

        res.json({
            currentPlan: company.plan || 'Free',
            seatUsage: {
                used: totalUsers,
                total: company.maxUsers || 10,
                percentage: company.maxUsers ? Math.round((totalUsers / company.maxUsers) * 100) : 0
            },
            monthlyCost: company.billing?.amount || 0,
            renewalDate: company.billing?.renewalDate || null
        });
    } catch (error) {
        console.error('Owner Dashboard Billing Summary Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * GET /api/owner-dashboard/security-risk
 * Security and risk metrics
 */
router.get('/security-risk', requireAuth, requireOwner, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);
        const companyId = user.companyId;

        // Count active sessions (users logged in within last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const activeSessions = await User.countDocuments({
            companyId,
            lastLogin: { $gte: oneDayAgo }
        });

        // Get recent audit log summary
        const AuditLog = require('../models/AuditLog');
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [totalAuditLogs, criticalActions] = await Promise.all([
            AuditLog.countDocuments({
                companyId,
                createdAt: { $gte: sevenDaysAgo }
            }),
            AuditLog.countDocuments({
                companyId,
                action: { $in: ['user_suspended', 'user_removed', 'role_changed'] },
                createdAt: { $gte: sevenDaysAgo }
            })
        ]);

        res.json({
            activeSessions,
            suspiciousLogins: [], // Placeholder for future implementation
            auditSummary: {
                lastWeek: totalAuditLogs,
                critical: criticalActions,
                warnings: 0 // Placeholder
            },
            complianceScore: 95 // Placeholder
        });
    } catch (error) {
        console.error('Owner Dashboard Security Risk Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
