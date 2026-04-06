import React from 'react';

/**
 * Card — Monolith Flow flat section card
 * No shadows, no rounded corners, divider-based layout
 */
const Card = ({ title, subtitle, action, children, className = '' }) => (
    <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '2px',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    }} className={className}>
        {(title || subtitle || action) && (
            <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '12px 20px',
                borderBottom: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-active)',
            }}>
                <div>
                    {title && (
                        <h3 style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            margin: 0,
                            letterSpacing: '-0.01em',
                        }}>{title}</h3>
                    )}
                    {subtitle && (
                        <p style={{
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                            marginTop: '2px',
                            marginBottom: 0,
                        }}>{subtitle}</p>
                    )}
                </div>
                {action && <div style={{ flexShrink: 0, marginLeft: '16px' }}>{action}</div>}
            </div>
        )}
        <div style={{ padding: '20px' }}>
            {children}
        </div>
    </div>
);

export default Card;
