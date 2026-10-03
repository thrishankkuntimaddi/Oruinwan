const logger = require('../../../utils/logger');
const { replicaRead } = require('../../shared/db');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const identity = require('../../identity');
const org = require('../../identity/queries/org');
const { hydrate } = require('../../identity/hydrate');
const Message = require("../../modules/messages/message.model.js");
// Invoices live in PostgreSQL (migration 0007_billing_analytics).
const { invoices: invoiceRepo } = require('../billing/billing.repository');
const AuditLog = require('../../../models/AuditLog');
const requireAuth = require('../../shared/middleware/auth');
const { requireOwner } = require('../../shared/middleware/permissionMiddleware');
const { requireFlag } = require('../../shared/featureFlags');

function sinceDate(timeRange) {
    const now = new Date();
    switch (timeRange) {
        case '7d':  return new Date(now - 7  * 864e5);
        case '90d': return new Date(now - 90 * 864e5);
        case '30d':
        default:    return new Date(now - 30 * 864e5);
    }
}

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

router.get('/overview', requireAuth, requireOwner, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await identity.users.findById(userId);

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
            org.users.count({ companyId }),
            org.users.count({ companyId, accountStatus: 'active' }),
            org.workspaces.count({ company: companyId }),
            org.departments.count({ company: companyId })
        ]);

        
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [newUsersLast30Days, newWorkspacesLast30Days] = await Promise.all([
            org.users.count({ companyId, createdAt: { $gte: thirtyDaysAgo } }),
            org.workspaces.count({ company: companyId, createdAt: { $gte: thirtyDaysAgo } })
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
        logger.error('Owner Dashboard Overview Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/activity-health', requireAuth, requireOwner, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await identity.users.findById(userId);
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
            org.workspaces.count({ company: companyId }),
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
        logger.error('Owner Dashboard Activity Health Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/billing-summary', requireFlag('billing'), requireAuth, requireOwner, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await identity.users.findById(userId);
        const company = await org.companies.findOne({ _id: user.companyId });

        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }

        const totalUsers = await org.users.count({ companyId: company._id, accountStatus: { $ne: 'removed' } });
        const seatLimit = company.settings?.maxUsers || null;
        const address = company.settings?.address;

        // Amount and renewal date are not stored on the company (no payment
        // provider yet): null, never invented.
        res.json({
            currentPlan: company.plan || 'free',
            seatUsage: {
                used: totalUsers,
                total: seatLimit,
                percentage: seatLimit ? Math.round((totalUsers / seatLimit) * 100) : null
            },
            monthlyCost: null,
            renewalDate: null,
            billingContact: {
                email: company.billingEmail || company.ownerEmail || null,
                address: address
                    ? [address.city, address.state, address.country].filter(Boolean).join(', ') || null
                    : null,
            },
        });
    } catch (error) {
        logger.error('Owner Dashboard Billing Summary Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/security-risk', requireAuth, requireOwner, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await identity.users.findById(userId);
        const companyId = user.companyId;

        
        const SecurityEvent = require('../../../models/SecurityEvent');
        const HistoryLog = require('../../../models/HistoryLog');
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Critical = role changes, suspensions and removals, as actually
        // recorded: SecurityEvent (role_changed / account_suspended) and the
        // history log (user_role_changed / member_removed / user_left_company).
        const [activeSessions, totalAuditLogs, criticalEvents, criticalHistory, warnings, failed] = await Promise.all([
            org.users.count({ companyId, lastLoginAt: { $gte: oneDayAgo } }),
            AuditLog.countDocuments({ companyId, createdAt: { $gte: sevenDaysAgo } }),
            SecurityEvent.countDocuments({ companyId, eventType: { $in: ['role_changed', 'account_suspended'] }, createdAt: { $gte: sevenDaysAgo } }),
            HistoryLog.countDocuments({ company: companyId, action: { $in: ['user_role_changed', 'member_removed', 'user_left_company'] }, timestamp: { $gte: sevenDaysAgo } }),
            SecurityEvent.countDocuments({ companyId, severity: 'warning', createdAt: { $gte: sevenDaysAgo } }),
            SecurityEvent.find({ companyId, eventType: 'login_failure', createdAt: { $gte: oneDayAgo } })
                .sort({ createdAt: -1 }).limit(20).select('metadata ipAddress userAgent createdAt').lean(),
        ]);

        const company = await org.companies.findOne({ _id: companyId });
        const emailDomain = company?.domain || company?.ownerEmail?.split('@')[1] || null;

        res.json({
            activeSessions,
            suspiciousLogins: failed.map((e) => ({
                email: e.metadata?.email || null,
                attempts: e.metadata?.attempts ?? null,
                ipAddress: e.ipAddress || null,
                userAgent: e.userAgent || null,
                at: e.createdAt,
            })),
            auditSummary: {
                lastWeek: totalAuditLogs,
                critical: criticalEvents + criticalHistory,
                warnings
            },
            // No compliance scoring exists yet; never a made-up number.
            complianceScore: null,
            emailDomain,
        });
    } catch (error) {
        logger.error('Owner Dashboard Security Risk Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/active-sessions', requireAuth, requireOwner, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await identity.users.findById(userId);
        const companyId = user.companyId;

        
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const sessions = await org.companySessions(companyId, { since: oneDayAgo, limit: 50 });

        
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
        logger.error('Active Sessions Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/security-events', requireAuth, requireOwner, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await identity.users.findById(userId);
        const companyId = user.companyId;

        const { limit = 50, type = 'all' } = req.query;

        
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

        const events = await replicaRead(AuditLog.find(query))
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();
        await hydrate(events, { userId: { type: 'user', fields: ['username', 'email'] } });

        
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
        logger.error('Security Events Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/invoices', requireFlag('billing'), requireAuth, requireOwner, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await identity.users.findById(userId);
        const companyId = user.companyId;

        const { limit = 10, status = 'all' } = req.query;

        const invoices = companyId
            ? await invoiceRepo.list(companyId, { status: status !== 'all' ? status : undefined, limit: parseInt(limit) || 10 })
            : [];

        res.json({ invoices });
    } catch (error) {
        logger.error('Invoices Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/payment-methods', requireFlag('billing'), requireAuth, requireOwner, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await identity.users.findById(userId);
        const companyId = user.companyId;

        
        const latestInvoice = companyId ? await invoiceRepo.latest(companyId) : null;

        // No payment provider is wired up yet: report what the invoices say, never a placeholder card.
        res.json({ paymentMethod: latestInvoice?.paymentMethod?.last4 ? latestInvoice.paymentMethod : null });
    } catch (error) {
        logger.error('Payment Methods Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/analytics', requireAuth, requireOwner, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await identity.users.findById(userId);
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
            org.users.count({ companyId, accountStatus: { $ne: 'removed' } }),
            org.users.count({ companyId, accountStatus: 'active' }),
            org.users.count({ companyId, createdAt: { $gte: from }, accountStatus: { $ne: 'removed' } }),
            org.workspaces.count({ company: companyId }),
            org.workspaces.count({ company: companyId, isActive: true, isArchived: false }),
            Message.countDocuments({ company: companyId, isDeleted: false, createdAt: { $gte: from } }),
        ]);

        const activeSenderIds = await Message.distinct('sender', {
            company: companyId, isDeleted: false, createdAt: { $gte: from }
        });
        const engagementRate = totalUsers > 0
            ? Math.round((activeSenderIds.length / totalUsers) * 100)
            : 0;

        
        const numWeeks = timeRange === '7d' ? 1 : timeRange === '90d' ? 13 : 4;
        const weekBuckets = [];
        for (let w = numWeeks - 1; w >= 0; w--) {
            const end = new Date(Date.now() - w * 7 * 864e5);
            weekBuckets.push({ end, label: `Week ${numWeeks - w}` });
        }
        const userGrowth = await Promise.all(weekBuckets.map(async ({ end, label }) => {
            const [users, active] = await Promise.all([
                org.users.count({ companyId, createdAt: { $lte: end }, accountStatus: { $ne: 'removed' } }),
                org.users.count({ companyId, accountStatus: 'active', createdAt: { $lte: end } }),
            ]);
            return { date: label, users, active };
        }));

        
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

        
        const workspaceActivity = await Message.aggregate([
            { $match: { company: cid, isDeleted: false, createdAt: { $gte: from }, workspace: { $ne: null } } },
            { $group: { _id: '$workspace', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
        ]).then(async (rows) => {
            // Workspace names come from PostgreSQL.
            const names = new Map((await org.workspaces.find({ _id: { $in: rows.map((r) => String(r._id)) } }, { members: false }))
                .map((w) => [String(w._id), w.name]));
            return rows.map((r) => ({ name: names.get(String(r._id)) || 'Unknown', activity: r.count }));
        });

        
        // Members per department in one grouped query.
        const departmentDistribution = (await org.departmentSizes(companyId))
            .map((d) => ({ name: d.name, value: d.members }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);

        res.json({
            timeRange,
            summary: { newUsers, totalMessages: recentMessages, engagementRate, activeWorkspaces, totalWorkspaces, totalUsers, activeUsers },
            userGrowth,
            dailyMessages,
            workspaceActivity,
            departmentDistribution,
        });
    } catch (error) {
        logger.error('Owner Dashboard Analytics Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
