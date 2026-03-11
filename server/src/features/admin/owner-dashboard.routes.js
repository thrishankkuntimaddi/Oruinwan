const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../../../models/User');
const Company = require('../../../models/Company');
const Workspace = require('../../../models/Workspace');
const Department = require('../../../models/Department');
const Message = require("../messages/message.model.js");
const UserSession = require('../../../models/UserSession');
const Invoice = require('../../../models/Invoice');
const AuditLog = require('../../../models/AuditLog');
const requireAuth = require('../../../middleware/auth');
const { requireOwner } = require('../../../middleware/permissionMiddleware');

// ── Helpers ─────────────────────────────────────────────────────────────────
function sinceDate(timeRange) {
    const now = new Date();
    switch (timeRange) {
        case '7d':  return new Date(now - 7  * 864e5);
        case '90d': return new Date(now - 90 * 864e5);
        case '30d':
        default:    return new Date(now - 30 * 864e5);
    }
}

/** Build an array of ISO date strings for the last N days */
function buildDateLabels(days) {
    const labels = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setUTCHours(0, 0, 0, 0);
        d.setUTCDate(d.getUTCDate() - i);
        labels.push(d.toISOString().slice(0, 10));
    }
    return labels;
}

/**
 * GET /api/owner-dashboard/overview
 * Organization overview metrics
 */
router.get('/overview', requireAuth, requireOwner, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

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
        res.status(500).json({ message: 'Server error', error: error.message });
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
            renewalDate: company.billing?.renewalDate || null,
            billingContact: {
                email: company.billingEmail || company.email || null,
                address: company.address
                    ? [company.address.city, company.address.state, company.address.country].filter(Boolean).join(', ')
                    : null,
            },
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
        const AuditLog = require('../../../models/AuditLog');
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

        const company = await Company.findById(companyId).select('emailDomain domain email').lean();
        const emailDomain = company?.emailDomain || company?.domain || company?.email?.split('@')[1] || null;

        res.json({
            activeSessions,
            suspiciousLogins: [], // Placeholder for future implementation
            auditSummary: {
                lastWeek: totalAuditLogs,
                critical: criticalActions,
                warnings: 0
            },
            complianceScore: 95,
            emailDomain,
        });
    } catch (error) {
        console.error('Owner Dashboard Security Risk Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * GET /api/owner-dashboard/active-sessions
 * Get all active user sessions for security monitoring
 */
router.get('/active-sessions', requireAuth, requireOwner, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);
        const companyId = user.companyId;

        // Get active sessions from last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const sessions = await UserSession.find({
            companyId,
            isActive: true,
            lastActivityAt: { $gte: oneDayAgo }
        })
            .populate('userId', 'username email')
            .sort({ lastActivityAt: -1 })
            .limit(50)
            .lean();

        // Format sessions for frontend
        const formattedSessions = sessions.map(session => ({
            id: session._id,
            user: session.userId?.username || 'Unknown User',
            email: session.userId?.email || 'N/A',
            device: session.device || 'Unknown Device',
            browser: session.browser,
            os: session.os,
            location: session.location?.city && session.location?.state
                ? `${session.location.city}, ${session.location.state}`
                : 'Unknown Location',
            ip: session.ipAddress,
            lastActive: session.lastActivityAt,
            status: session.isActive ? 'active' : 'inactive'
        }));

        res.json({ sessions: formattedSessions });
    } catch (error) {
        console.error('Active Sessions Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

/**
 * GET /api/owner-dashboard/security-events
 * Get recent security events and audit logs
 */
router.get('/security-events', requireAuth, requireOwner, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);
        const companyId = user.companyId;

        const { limit = 50, type = 'all' } = req.query;

        // Define security-related actions
        const securityActions = [
            'user.login',
            'user.logout',
            'user.login.failed',
            'user.password.changed',
            'user.role.changed',
            'user.created',
            'user.deleted',
            'user.suspended',
            'admin.promoted',
            'admin.demoted',
            'permissions.modified',
            'session.created',
            'session.expired'
        ];

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        let query = {
            companyId,
            createdAt: { $gte: sevenDaysAgo }
        };

        // Filter by type if specified
        if (type !== 'all') {
            if (type === 'login') {
                query.action = { $in: ['user.login', 'user.logout', 'user.login.failed'] };
            } else if (type === 'security') {
                query.action = { $in: securityActions };
            } else if (type === 'changes') {
                query.action = { $regex: /\.(created|deleted|modified|changed)$/i };
            } else if (type === 'access') {
                query.action = { $regex: /\.(role|permissions|access)/i };
            }
        } else {
            query.action = { $in: securityActions };
        }

        const events = await AuditLog.find(query)
            .populate('userId', 'username email')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();

        // Format events
        const formattedEvents = events.map(event => {
            let eventType = 'info';
            if (event.action.includes('failed') || event.status === 'failure') {
                eventType = 'warning';
            } else if (event.action.includes('deleted') || event.action.includes('suspended')) {
                eventType = 'critical';
            } else if (event.status === 'success') {
                eventType = 'success';
            }

            return {
                id: event._id,
                type: eventType,
                event: event.action.replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                user: event.userId?.username || 'System',
                details: event.description || event.details || 'No additional details',
                timestamp: event.createdAt,
                ipAddress: event.ipAddress || 'N/A',
                device: event.userAgent || 'Unknown'
            };
        });

        res.json({ events: formattedEvents });
    } catch (error) {
        console.error('Security Events Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

/**
 * GET /api/owner-dashboard/invoices
 * Get company invoices and payment history
 */
router.get('/invoices', requireAuth, requireOwner, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);
        const companyId = user.companyId;

        const { limit = 10, status = 'all' } = req.query;

        let query = { companyId };
        if (status !== 'all') {
            query.status = status;
        }

        const invoices = await Invoice.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();

        res.json({ invoices });
    } catch (error) {
        console.error('Invoices Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

/**
 * GET /api/owner-dashboard/payment-methods
 * Get saved payment methods for the company
 */
router.get('/payment-methods', requireAuth, requireOwner, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);
        const companyId = user.companyId;

        // Get most recent invoice to extract payment method
        const latestInvoice = await Invoice.findOne({ companyId })
            .sort({ createdAt: -1 })
            .select('paymentMethod')
            .lean();

        const paymentMethod = latestInvoice?.paymentMethod || {
            type: 'card',
            last4: '4242',
            brand: 'visa'
        };

        res.json({
            paymentMethod: {
                ...paymentMethod,
                expiryMonth: 12,
                expiryYear: 2027
            }
        });
    } catch (error) {
        console.error('Payment Methods Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

/**
 * GET /api/owner-dashboard/analytics
 * Time-series analytics for charts (user growth, daily messages, workspace activity, department distribution)
 */
router.get('/analytics', requireAuth, requireOwner, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);
        const companyId = user.companyId;
        if (!companyId) return res.status(400).json({ message: 'No company found' });

        const timeRange = req.query.timeRange || '30d';
        const from = sinceDate(timeRange);
        const cid = mongoose.Types.ObjectId.createFromHexString(companyId.toString());

        const msgDays = timeRange === '7d' ? 7 : 30;
        const msgFrom = new Date(Date.now() - msgDays * 864e5);
        const msgLabels = buildDateLabels(msgDays);

        const [
            totalUsers,
            activeUsers,
            newUsers,
            totalWorkspaces,
            activeWorkspaces,
            recentMessages,
        ] = await Promise.all([
            User.countDocuments({ companyId, accountStatus: { $ne: 'removed' } }),
            User.countDocuments({ companyId, accountStatus: 'active' }),
            User.countDocuments({ companyId, createdAt: { $gte: from }, accountStatus: { $ne: 'removed' } }),
            Workspace.countDocuments({ company: companyId }),
            Workspace.countDocuments({ company: companyId, isActive: true, isArchived: false }),
            Message.countDocuments({ company: companyId, isDeleted: false, createdAt: { $gte: from } }),
        ]);

        const activeSenderIds = await Message.distinct('sender', {
            company: companyId, isDeleted: false, createdAt: { $gte: from }
        });
        const engagementRate = totalUsers > 0
            ? Math.round((activeSenderIds.length / totalUsers) * 100)
            : 0;

        // Weekly user growth buckets
        const numWeeks = timeRange === '7d' ? 1 : timeRange === '90d' ? 13 : 4;
        const weekBuckets = [];
        for (let w = numWeeks - 1; w >= 0; w--) {
            const end = new Date(Date.now() - w * 7 * 864e5);
            weekBuckets.push({ end, label: `Week ${numWeeks - w}` });
        }
        const userGrowth = await Promise.all(weekBuckets.map(async ({ end, label }) => {
            const [users, active] = await Promise.all([
                User.countDocuments({ companyId, createdAt: { $lte: end }, accountStatus: { $ne: 'removed' } }),
                User.countDocuments({ companyId, accountStatus: 'active', createdAt: { $lte: end } }),
            ]);
            return { date: label, users, active };
        }));

        // Daily message volume
        const rawMsgAgg = await Message.aggregate([
            { $match: { company: cid, isDeleted: false, createdAt: { $gte: msgFrom } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, messages: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]);
        const msgMap = Object.fromEntries(rawMsgAgg.map(r => [r._id, r.messages]));
        const dailyMessages = msgLabels.map(date => ({
            day: new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short' }),
            date,
            messages: msgMap[date] || 0,
        }));

        // Workspace activity
        const workspaceActivity = await Message.aggregate([
            { $match: { company: cid, isDeleted: false, createdAt: { $gte: from }, workspace: { $ne: null } } },
            { $group: { _id: '$workspace', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'workspaces', localField: '_id', foreignField: '_id', as: 'ws' } },
            { $unwind: { path: '$ws', preserveNullAndEmptyArrays: true } },
            { $project: { _id: 0, name: { $ifNull: ['$ws.name', 'Unknown'] }, activity: '$count' } },
        ]);

        // Department distribution
        const departments = await Department.find({ company: companyId, isActive: true }).select('name members').lean();
        let departmentDistribution = departments.map(d => ({
            name: d.name,
            value: Array.isArray(d.members) ? d.members.length : 0,
        })).sort((a, b) => b.value - a.value).slice(0, 6);

        if (!departmentDistribution.some(d => d.value > 0) && departments.length > 0) {
            departmentDistribution = await Promise.all(
                departments.slice(0, 6).map(async d => ({
                    name: d.name,
                    value: await User.countDocuments({ companyId, departments: d._id, accountStatus: { $ne: 'removed' } }),
                }))
            );
        }

        res.json({
            timeRange,
            summary: { newUsers, totalMessages: recentMessages, engagementRate, activeWorkspaces, totalWorkspaces, totalUsers, activeUsers },
            userGrowth,
            dailyMessages,
            workspaceActivity,
            departmentDistribution,
        });
    } catch (error) {
        console.error('Owner Dashboard Analytics Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
