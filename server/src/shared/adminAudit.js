'use strict';

/**
 * Records an administrative action in the audit log and, for company-owned
 * resources, in the compliance log. Never throws: a failed write is logged and
 * the action itself still succeeds.
 */

const logger = require('../../utils/logger');
const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');
const ComplianceLog = require('../../models/ComplianceLog');

const AUDIT_CATEGORIES = new Set(['workspace', 'org', 'permissions', 'security', 'auth', 'billing', 'messaging', 'system']);
const COMPLIANCE_CATEGORIES = new Set(['workspace', 'org', 'permissions', 'security', 'auth', 'billing', 'data-export', 'data-import']);

async function recordAdminAction({
    userId, companyId = null, action, category = 'workspace', severity = 'info',
    resourceType, resourceId, resourceName, details, req, ipAddress, userAgent,
}) {
    const ip = ipAddress ?? req?.ip;
    const agent = userAgent ?? req?.get?.('user-agent');
    try {
        const writes = [AuditLog.create({
            companyId: companyId || null,
            userId,
            action,
            resource: resourceType,
            resourceId,
            details,
            ipAddress: ip,
            userAgent: agent,
            severity,
            category: AUDIT_CATEGORIES.has(category) ? category : 'workspace',
            status: 'success',
        })];
        if (companyId) {
            const actor = await User.findById(userId).select('email companyRole').lean();
            writes.push(ComplianceLog.create({
                companyId,
                actorId: userId,
                actorEmail: actor?.email,
                actorRole: actor?.companyRole,
                action,
                category: COMPLIANCE_CATEGORIES.has(category) ? category : 'workspace',
                severity,
                resourceType,
                resourceId,
                resourceName,
                details,
                ipAddress: ip,
                userAgent: agent,
                createdAt: new Date(),
            }));
        }
        await Promise.all(writes);
    } catch (err) {
        logger.error({ err, action }, '[adminAudit] audit write failed (non-fatal)');
    }
}

module.exports = { recordAdminAction };
