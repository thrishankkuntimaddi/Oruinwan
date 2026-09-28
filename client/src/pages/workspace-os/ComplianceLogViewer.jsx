import React from 'react';
import LogViewer from './LogViewer';

const CONFIG = {
    eyebrow: 'Governance',
    title: 'Compliance logs',
    lead: 'Tamper-evident trail: each record is hashed when written and can be verified.',
    endpoint: '/api/compliance-logs',
    categories: ['workspace', 'org', 'permissions', 'security', 'auth', 'billing', 'data-export', 'data-import'],
    actorOf: (l) => l.actorId,
    roleOf: (l) => l.actorRole,
    csvName: 'compliance-log.csv',
    verify: true,
    emptyText: 'Compliance-relevant events (exports, role and security changes) will appear here.',
};

/** Company compliance log (owners and admins). */
export default function ComplianceLogViewer({ companyId }) {
    return <LogViewer config={CONFIG} companyId={companyId} />;
}
