import React from 'react';
import { Users, Hash, MessageSquare, Loader } from 'lucide-react';

const STAT_ITEMS = [
    { key: 'memberCount',  label: 'Members',  sub: 'Total workspace members', Icon: Users },
    { key: 'channelCount', label: 'Channels', sub: 'Active channels',          Icon: Hash },
    { key: 'messageCount', label: 'Messages', sub: 'Total messages sent',      Icon: MessageSquare },
];

const BillingTab = ({ stats, loadingStats }) => (
    <div style={{ fontFamily: 'var(--font)' }}>
        {loadingStats ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px', color: 'var(--text-muted)', gap: '10px' }}>
                <Loader size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
                <p style={{ fontSize: '12px', margin: 0 }}>Loading workspace statistics…</p>
            </div>
        ) : (
            <>
                {}
                <div style={{ padding: '20px', marginBottom: '20px', border: '1px solid var(--border-default)', borderRadius: '2px', background: 'var(--bg-active)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '2px', background: 'var(--bg-hover)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                        ✨
                    </div>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent)', marginBottom: '2px' }}>FREE Plan</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Currently using the free tier</div>
                    </div>
                </div>

                {}
                {stats && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '4px' }}>
                            Workspace Usage
                        </div>
                        {STAT_ITEMS.map(({ key, label, sub, Icon }) => (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid var(--border-subtle)', borderRadius: '2px', background: 'var(--bg-active)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '30px', height: '30px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Icon size={15} style={{ color: 'var(--accent)' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub}</div>
                                    </div>
                                </div>
                                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                    {stats[key] ?? '—'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </>
        )}
    </div>
);

export default BillingTab;
