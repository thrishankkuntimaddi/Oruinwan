import React, { useState, useEffect, useCallback } from 'react';
import {
    Shield, AlertTriangle, CheckCircle, XCircle, Lock,
    Key, Users, Activity, RefreshCw, Eye, Settings,
    Globe, Monitor, Clock, Download, TrendingUp, AlertCircle, UserCheck, FileText
} from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import { getSecurityRisk } from '../../services/ownerDashboardService';
import api from '@services/api';

const OwnerSecurity = () => {
    const { isCompanyOwner } = useCompany();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [securityData, setSecurityData] = useState(null);
    const [activeSessions, setActiveSessions] = useState([]);
    const [securityEvents, setSecurityEvents] = useState([]);
    const [emailDomain, setEmailDomain] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const [security, sessionsRes, eventsRes] = await Promise.all([
                getSecurityRisk(),
                api.get('/api/owner-dashboard/active-sessions'),
                api.get('/api/owner-dashboard/security-events?limit=50')
            ]);
            setSecurityData(security);
            setActiveSessions(sessionsRes.data.sessions || []);
            setSecurityEvents(eventsRes.data.events || []);
            if (security?.emailDomain) setEmailDomain(security.emailDomain);
        } catch {
            showToast('Failed to load security data', 'error');
            setActiveSessions([]);
            setSecurityEvents([]);
        }
    }, [showToast]);

    useEffect(() => {
        if (!isCompanyOwner()) return;
        const load = async () => { setLoading(true); await fetchData(); setLoading(false); };
        load();
    }, [isCompanyOwner, fetchData]);

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
        showToast('Security data refreshed', 'success');
    };

    const eventStyle = (type) => {
        const map = {
            success: { color: 'var(--state-success)', bg: 'rgba(90,186,138,0.1)', border: 'var(--state-success)', Icon: CheckCircle },
            warning: { color: 'var(--accent)', bg: 'rgba(184,149,106,0.1)', border: 'var(--accent)', Icon: AlertTriangle },
            critical: { color: 'var(--state-danger)', bg: 'rgba(224,82,82,0.1)', border: 'var(--state-danger)', Icon: XCircle },
        };
        return map[type] || { color: 'var(--text-secondary)', bg: 'var(--bg-active)', border: 'var(--border-default)', Icon: AlertCircle };
    };

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div style={{ height: '56px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div><div className="sk" style={{ height: '13px', width: '220px', marginBottom: '5px' }} /><div className="sk" style={{ height: '9px', width: '280px' }} /></div>
                <div style={{ display: 'flex', gap: '8px' }}><div className="sk" style={{ height: '30px', width: '90px' }} /></div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
                {/* Risk score + 3 tiles */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1px', background: 'var(--border-subtle)', marginBottom: '16px' }}>
                    {[1,2,3,4].map(i => (
                         <div key={i} style={{ background: 'var(--bg-surface)', padding: '20px' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><div className="sk" style={{ width: '14px', height: '14px' }} /><div className="sk" style={{ height: '9px', width: '80px' }} /></div>
                             <div className="sk" style={{ height: '32px', width: '60px', marginBottom: '6px' }} />
                             <div className="sk" style={{ height: '9px', width: '100px' }} />
                         </div>
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {/* Events log */}
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}><div className="sk" style={{ height: '11px', width: '130px' }} /></div>
                        {[1,2,3,4,5].map(i => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                                <div className="sk" style={{ width: '26px', height: '26px', flexShrink: 0 }} />
                                <div style={{ flex: 1 }}><div className="sk" style={{ height: '10px', width: '80%', marginBottom: '4px' }} /><div className="sk" style={{ height: '9px', width: '50%' }} /></div>
                                <div className="sk" style={{ height: '18px', width: '55px', flexShrink: 0 }} />
                            </div>
                        ))}
                    </div>
                    {/* Sessions */}
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}><div className="sk" style={{ height: '11px', width: '130px' }} /></div>
                        {[1,2,3,4,5].map(i => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                                <div className="sk" style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0 }} />
                                <div style={{ flex: 1 }}><div className="sk" style={{ height: '10px', width: '120px', marginBottom: '4px' }} /><div className="sk" style={{ height: '9px', width: '80px' }} /></div>
                                <div className="sk" style={{ height: '18px', width: '50px', flexShrink: 0 }} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <header style={{
                height: '56px', padding: '0 28px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0, zIndex: 5,
            }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Shield size={16} style={{ color: 'var(--accent)' }} />
                        Security &amp; Risk Management
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', marginLeft: '24px' }}>
                        Monitor access, sessions, and security events
                    </p>
                </div>
                <HBtn onClick={handleRefresh} disabled={refreshing} label={refreshing ? 'Refreshing...' : 'Refresh'}
                    icon={<RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />} />
            </header>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }} className="custom-scrollbar">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1280px', margin: '0 auto' }}>

                    {/* Score + Stats Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, 1fr)', gap: '1px', background: 'var(--border-subtle)' }}>
                        {/* Compliance Score */}
                        <div style={{ background: 'var(--bg-surface)', padding: '24px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--state-success)' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                <Shield size={18} style={{ color: 'var(--state-success)' }} />
                                <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--state-success)', border: '1px solid var(--state-success)', padding: '2px 6px' }}>SCORE</span>
                            </div>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Compliance Score</p>
                            <p style={{ fontSize: '36px', fontWeight: 700, color: 'var(--state-success)', letterSpacing: '-0.03em' }}>{securityData?.complianceScore || 95}%</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Excellent security posture</p>
                        </div>
                        {/* Stats */}
                        {[
                            { label: 'Active Sessions', value: securityData?.activeSessions || 0, sub: 'Users logged in (24h)', icon: Activity },
                            { label: 'Security Alerts', value: securityData?.auditSummary?.critical || 0, sub: 'Require attention', icon: AlertTriangle, danger: true },
                            { label: 'Audit Events', value: securityData?.auditSummary?.lastWeek || 0, sub: 'Last 7 days', icon: FileText },
                        ].map(({ label, value, sub, icon: Icon, danger }) => (
                            <div key={label} style={{ background: 'var(--bg-surface)', padding: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <Icon size={14} style={{ color: danger ? 'var(--state-danger)' : 'var(--text-muted)' }} />
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</span>
                                </div>
                                <p style={{ fontSize: '28px', fontWeight: 700, color: danger && value > 0 ? 'var(--state-danger)' : 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* Active Sessions */}
                    <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Monitor size={14} style={{ color: 'var(--accent)' }} />
                            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>Active Sessions</h3>
                        </div>
                        <div style={{ padding: '8px' }}>
                            {activeSessions.length > 0 ? activeSessions.map(session => (
                                <div key={session.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <div style={{ width: '36px', height: '36px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                                        {session.user?.charAt(0) || 'U'}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>{session.user || 'Unknown'}</p>
                                        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Monitor size={10} /> {session.device || 'Unknown Device'}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Globe size={10} /> {session.location || 'Unknown'}</span>
                                            <span>IP: {session.ip || 'N/A'}</span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: 'rgba(90,186,138,0.1)', border: '1px solid var(--state-success)', color: 'var(--state-success)', fontSize: '10px', fontWeight: 700 }}>
                                            <Activity size={9} /> Active
                                        </span>
                                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>{session.lastActive ? new Date(session.lastActive).toLocaleString() : '—'}</p>
                                    </div>
                                </div>
                            )) : (
                                <div style={{ padding: '40px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>No active sessions in the last 24 hours</div>
                            )}
                        </div>
                    </section>

                    {/* Security Events */}
                    <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertTriangle size={14} style={{ color: 'var(--accent)' }} />
                                <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Recent Security Events</h3>
                            </div>
                            <button style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                                <Download size={12} /> Export
                            </button>
                        </div>
                        <div style={{ padding: '8px' }}>
                            {securityEvents.length > 0 ? securityEvents.map(event => {
                                const { color, bg, border, Icon } = eventStyle(event.type);
                                return (
                                    <div key={event.id} style={{ display: 'flex', gap: '12px', padding: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                                        <div style={{ marginTop: '1px', flexShrink: 0 }}>
                                            <Icon size={14} style={{ color }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                                <div>
                                                    <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1px' }}>{event.event}</h4>
                                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>by {event.user}</p>
                                                </div>
                                                <span style={{ display: 'inline-block', padding: '2px 8px', background: bg, border: `1px solid ${border}`, color, fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
                                                    {event.type}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{event.details}</p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
                                                <Clock size={10} />
                                                {event.timestamp ? new Date(event.timestamp).toLocaleString() : 'Unknown time'}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div style={{ padding: '40px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>No security events in the last 7 days</div>
                            )}
                        </div>
                    </section>

                    {/* Auth Settings + Access Control */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border-subtle)' }}>
                        {/* Auth Settings */}
                        <div style={{ background: 'var(--bg-surface)', padding: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                                <Settings size={14} style={{ color: 'var(--accent)' }} />
                                <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Authentication Settings</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {[
                                    { icon: Lock, label: 'Two-Factor Authentication', sub: 'Enabled for all admins', ok: true },
                                    { icon: Key, label: 'Password Policy', sub: 'Minimum 8 characters, 1 special', ok: true },
                                    { icon: Clock, label: 'Session Timeout', sub: '30 minutes of inactivity', ok: true },
                                ].map(({ icon: Icon, label, sub, ok }) => (
                                    <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Icon size={13} style={{ color: 'var(--text-muted)' }} />
                                            <div>
                                                <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '1px' }}>{label}</p>
                                                <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{sub}</p>
                                            </div>
                                        </div>
                                        {ok ? <CheckCircle size={14} style={{ color: 'var(--state-success)', flexShrink: 0 }} /> : <XCircle size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Access Control */}
                        <div style={{ background: 'var(--bg-surface)', padding: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                                <UserCheck size={14} style={{ color: 'var(--accent)' }} />
                                <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Access Control</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {[
                                    { label: 'Role-Based Access (RBAC)', sub: '4 roles defined', icon: Users, ok: true },
                                    { label: 'IP Whitelisting', sub: 'Not configured', icon: Globe, ok: false },
                                    { label: 'Domain Restriction', sub: emailDomain ? `@${emailDomain} only` : 'Not configured', icon: Eye, ok: !!emailDomain },
                                ].map(({ label, sub, icon: Icon, ok }) => (
                                    <div key={label} style={{ padding: '10px 12px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</p>
                                            {ok ? <CheckCircle size={13} style={{ color: 'var(--state-success)' }} /> : <XCircle size={13} style={{ color: 'var(--text-muted)' }} />}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
                                            <Icon size={10} /> <span>{sub}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Recommendations */}
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--accent)', padding: '20px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '3px', background: 'var(--accent)' }} />
                        <div style={{ display: 'flex', gap: '12px', paddingLeft: '4px' }}>
                            <AlertCircle size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px' }} />
                            <div>
                                <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)', marginBottom: '10px' }}>Security Recommendations</h3>
                                <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {[
                                        'Enable IP whitelisting for admin accounts to restrict access from trusted locations',
                                        'Review and update password policies to require rotation every 90 days',
                                        'Configure automated security alerts for suspicious login attempts',
                                    ].map((rec, i) => (
                                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            <TrendingUp size={12} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--accent)' }} />
                                            <span>{rec}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const HBtn = ({ onClick, disabled, label, icon }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} disabled={disabled} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px', background: hov && !disabled ? 'var(--bg-hover)' : 'var(--bg-active)', border: '1px solid var(--border-default)', color: disabled ? 'var(--text-muted)' : hov ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, transition: 'all 150ms ease', borderRadius: '0' }}>
            {icon}{label}
        </button>
    );
};

export default OwnerSecurity;
