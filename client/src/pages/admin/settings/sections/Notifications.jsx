import React from 'react';
import { Bell } from 'lucide-react';

const Notifications = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
        <div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', marginBottom: '4px' }}>Notifications</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Configure notification preferences</p>
        </div>
        <div style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', padding: '48px 24px', textAlign: 'center' }}>
            <Bell size={36} style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 auto 12px' }} />
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Notification settings coming soon</p>
        </div>
    </div>
);

export default Notifications;
