import React from 'react';
import LogViewer from './LogViewer';

const CONFIG = {
    eyebrow: 'Governance',
    title: 'Audit logs',
    lead: 'Every administrative action in the company: who did what, and when.',
    endpoint: '/api/permissions/audit-logs',
    categories: ['workspace', 'org', 'permissions', 'security', 'auth', 'billing', 'messaging', 'system'],
    actorOf: (l) => l.userId,
    csvName: 'audit-log.csv',
    statusColumn: true,
    emptyText: 'Administrative actions will appear here as they happen.',
};

/** Company audit log (owners and admins). */
export default function AuditLogViewer({ companyId }) {
    return <LogViewer config={CONFIG} companyId={companyId} />;
}
