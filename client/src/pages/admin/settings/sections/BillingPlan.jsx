import React from 'react';
import { CreditCard } from 'lucide-react';

const BillingPlan = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
        <div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', marginBottom: '4px' }}>Billing & Plan</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Manage subscription and payment</p>
        </div>
        <div style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', padding: '48px 24px', textAlign: 'center' }}>
            <CreditCard size={36} style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 auto 12px' }} />
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Billing management coming soon</p>
        </div>
    </div>
);

export default BillingPlan;
