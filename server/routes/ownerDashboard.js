const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Company = require('../models/Company');
const Workspace = require('../models/Workspace');
const Department = require('../models/Department');
const Message = require('../models/Message');
const UserSession = require('../models/UserSession');
const Invoice = require('../models/Invoice');
const AuditLog = require('../models/AuditLog');
const requireAuth = require('../middleware/auth');
const { requireOwner } = require('../middleware/permissionMiddleware');

/**
 * GET /api/owner-dashboard/overview
 * Organization overview metrics
 */
router.get('/overview', requireAuth, requireOwner, async (req, res) => {
    try {
        console.log('[OWNER DASHBOARD] Overview endpoint hit');
        console.log('[OWNER DASHBOARD] User:', req.user);

        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            console.error('[OWNER DASHBOARD] User not found:', userId);
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('[OWNER DASHBOARD] User found:', user.email, 'Company:', user.companyId);
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

        console.log('[OWNER DASHBOARD] Overview data:', { totalUsers, activeUsers, workspaceCount, departmentCount });

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

module.exports = router;

