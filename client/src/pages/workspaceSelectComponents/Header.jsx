import React, { useState } from 'react';
import { CircleHelp, Search, BookOpen, Command, Bug, Sparkles, Shield, Briefcase, Settings, LogOut, Bell, Check, UserPlus, MessageSquare, AtSign, X, Bot } from 'lucide-react';
import { getAvatarUrl } from '../../utils/avatarUtils';

const MOCK_NOTIFS = [
    { id: 1, type: 'mention', icon: AtSign, title: 'You were mentioned', body: '@you in #general — "Can you review the PR?"', time: '2m ago', read: false },
    { id: 2, type: 'invite', icon: UserPlus, title: 'Workspace invite', body: 'Alex invited you to join "Design Team"', time: '18m ago', read: false },
    { id: 3, type: 'message', icon: MessageSquare, title: 'New direct message', body: 'Jordan: "Hey, are you free for a quick call?"', time: '1h ago', read: true },
    { id: 4, type: 'mention', icon: AtSign, title: 'You were mentioned', body: '@you in #design — "Looks great, LGTM!"', time: '3h ago', read: true },
];

const btn = {
    background: 'none', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '7px', borderRadius: '2px', transition: '150ms ease',
    color: 'var(--text-muted)', fontFamily: 'var(--font)',
};

const NotificationPanel = () => {
    const [open, setOpen] = useState(false);
    const [notifs, setNotifs] = useState(MOCK_NOTIFS);
    const unread = notifs.filter(n => !n.read).length;
    const markAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    const dismiss = (id) => setNotifs(prev => prev.filter(n => n.id !== id));

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{ ...btn, color: open ? 'var(--accent)' : 'var(--text-muted)', background: open ? 'var(--bg-hover)' : 'none' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = open ? 'var(--bg-hover)' : 'none'; e.currentTarget.style.color = open ? 'var(--accent)' : 'var(--text-muted)'; }}
                title="Notifications"
            >
                <Bell size={18} />
                {unread > 0 && (
                    <span style={{
                        position: 'absolute', top: '1px', right: '1px',
                        minWidth: '15px', height: '15px', borderRadius: '50%',
                        background: 'var(--accent)', color: '#0c0c0c',
                        fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px',
                    }}>{unread}</span>
                )}
            </button>

            {open && <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} />}

            {open && (
                <div style={{
                    position: 'absolute', top: '44px', right: 0, width: '340px',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                    borderRadius: '2px', zIndex: 100, overflow: 'hidden',
                    animation: 'mfFadeIn 0.15s ease',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-active)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-primary)' }}>
                            <Bell size={13} />
                            <span style={{ fontWeight: 600, fontSize: '12px' }}>Notifications</span>
                            {unread > 0 && <span style={{ background: 'var(--accent)', color: '#0c0c0c', fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '2px' }}>{unread} new</span>}
                        </div>
                        {unread > 0 && (
                            <button onClick={markAllRead} style={{ ...btn, padding: '3px', fontSize: '11px', gap: '3px', color: 'var(--text-secondary)', fontWeight: 600 }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                            ><Check size={11} /> Mark all read</button>
                        )}
                    </div>

                    <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                        {notifs.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                                <Bell size={26} style={{ marginBottom: '10px', opacity: 0.3 }} />
                                <p style={{ fontSize: '12px', fontWeight: 500 }}>All caught up!</p>
                            </div>
                        ) : notifs.map(n => {
                            const Icon = n.icon;
                            return (
                                <div key={n.id} className="notif-row" style={{
                                    display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px',
                                    borderBottom: '1px solid var(--border-subtle)',
                                    background: n.read ? 'var(--bg-surface)' : 'var(--bg-hover)',
                                    transition: '150ms ease', cursor: 'default',
                                }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                    onMouseLeave={e => e.currentTarget.style.background = n.read ? 'var(--bg-surface)' : 'var(--bg-hover)'}
                                >
                                    <div style={{ flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-active)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                                        <Icon size={13} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <p style={{ fontSize: '12px', fontWeight: 500, color: n.read ? 'var(--text-secondary)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{n.title}</p>
                                            {!n.read && <span style={{ flexShrink: 0, width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)' }} />}
                                        </div>
                                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</p>
                                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '3px 0 0', fontWeight: 500 }}>{n.time}</p>
                                    </div>
                                    <button onClick={() => dismiss(n.id)} className="notif-dismiss"
                                        style={{ ...btn, padding: '3px', color: 'var(--text-muted)', opacity: 0 }}
                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                    ><X size={11} /></button>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '7px 14px', background: 'var(--bg-surface)', textAlign: 'center' }}>
                        <button style={{ ...btn, padding: '2px', fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-hover)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--accent)'}
                        >View all notifications</button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes mfFadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
                @keyframes hdrPing { 75%, 100% { transform: scale(2); opacity: 0; } }
                .notif-row:hover .notif-dismiss { opacity: 1 !important; }
            `}</style>
        </div>
    );
};

const Header = ({ showHelp, setShowHelp, onHelpModalOpen, user, onProfileClick, onSettingsClick, onLogout, onOwnerConsoleClick, onAdminConsoleClick, onManagerConsoleClick, onAIClick, showAI }) => {

    const iconBtn = (active = false) => ({
        ...btn,
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        background: active ? 'var(--bg-hover)' : 'none',
    });

    const consoleBtn = {
        display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)',
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: '6px 10px', borderRadius: '2px', transition: '150ms ease',
        fontFamily: 'var(--font)',
    };

    return (
        <header style={{
            position: 'fixed', top: 0, width: '100%',
            background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)',
            zIndex: 50, height: '48px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontFamily: 'var(--font)', boxSizing: 'border-box',
            padding: '0 16px', gap: '8px', overflow: 'hidden',
        }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <img src="/chttrix-logo.jpg" alt="Chttrix" style={{ width: '24px', height: '24px', borderRadius: '2px', objectFit: 'cover' }} />
                <span className="psh-ws-label" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px', letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>Chttrix</span>
            </div>

            {/* Right side buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, marginLeft: 'auto', position: 'relative' }}>

                {/* Console buttons — only on md+ */}
                {user?.companyRole === 'owner' && (
                    <button onClick={onOwnerConsoleClick} style={consoleBtn} className="hidden md:flex"
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
                    ><Shield size={13} /> Owner Console</button>
                )}

                {user?.companyRole === 'admin' && (
                    <button onClick={onAdminConsoleClick} style={consoleBtn} className="hidden md:flex"
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
                    ><Shield size={13} /> Admin Console</button>
                )}

                {(user?.companyRole === 'manager' || user?.companyRole === 'admin') && (
                    <button onClick={onManagerConsoleClick} style={consoleBtn} className="hidden md:flex"
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
                    ><Briefcase size={13} /> Manager Console</button>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    {/* Profile — desktop: show avatar + name */}
                    <button onClick={onProfileClick} title="View Profile" className="hidden sm:flex"
                        style={{ ...btn, gap: '8px', padding: '4px 8px', maxWidth: '160px' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                        <img src={getAvatarUrl(user)} alt={user?.username || 'User'} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-default)', flexShrink: 0 }} />
                        <div style={{ textAlign: 'left', overflow: 'hidden', minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.username || 'User'}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
                        </div>
                    </button>

                    {/* Profile — mobile: avatar only */}
                    <button onClick={onProfileClick} title="View Profile" className="sm:hidden" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={getAvatarUrl(user)} alt={user?.username || 'U'} style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-default)' }} />
                    </button>

                    <div className="hidden md:block" style={{ height: '18px', width: '1px', background: 'var(--border-subtle)', margin: '0 4px' }} />

                    <NotificationPanel />

                    <button onClick={onSettingsClick} style={iconBtn()} title="Settings"
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    ><Settings size={16} /></button>

                    {/* Help */}
                    <div style={{ position: 'relative' }}>
                        <button onClick={() => setShowHelp(!showHelp)} style={iconBtn(showHelp)} title="Help & Resources"
                            onMouseEnter={e => { if (!showHelp) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                            onMouseLeave={e => { if (!showHelp) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
                        ><CircleHelp size={16} /></button>

                        {showHelp && (
                            <>
                                <div style={{ position: 'fixed', inset: 0, zIndex: 90, cursor: 'default' }} onClick={() => setShowHelp(false)} />
                                <div style={{
                                    position: 'absolute', top: '44px', right: 0, width: '260px',
                                    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                                    borderRadius: '2px', zIndex: 100, overflow: 'hidden', animation: 'mfFadeIn 0.15s ease',
                                }}>
                                    <div style={{ padding: '10px 14px', background: 'var(--bg-active)', borderBottom: '1px solid var(--border-default)' }}>
                                        <h3 style={{ margin: 0, fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>Chttrix Support</h3>
                                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>We're here to help you collaborate better.</p>
                                    </div>

                                    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
                                        <div style={{ position: 'relative' }}>
                                            <Search size={11} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                            <input type="text" placeholder="Find answers..."
                                                style={{ width: '100%', paddingLeft: '28px', paddingRight: '8px', paddingTop: '5px', paddingBottom: '5px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font)' }}
                                                onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                                                onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ padding: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
                                        {[
                                            { label: 'Academy', icon: BookOpen, modal: 'academy', color: 'var(--accent)' },
                                            { label: 'Shortcuts', icon: Command, modal: 'shortcuts', color: 'var(--text-secondary)' },
                                            { label: 'Report Bug', icon: Bug, modal: 'bug', color: 'var(--state-danger)' },
                                            { label: "What's New", icon: Sparkles, modal: 'whatsnew', color: 'var(--accent)' },
                                        ].map(({ label, icon: Icon, modal, color }) => (
                                            <button key={modal}
                                                onClick={() => { setShowHelp(false); onHelpModalOpen(modal); }}
                                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 6px', background: 'transparent', border: 'none', borderRadius: '2px', cursor: 'pointer', transition: '150ms ease', gap: '4px', fontFamily: 'var(--font)' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <Icon size={17} style={{ color }} />
                                                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '7px 12px', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ position: 'relative', display: 'inline-flex', width: '8px', height: '8px' }}>
                                                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--state-success, #3ecf8e)', opacity: 0.6, animation: 'hdrPing 1.5s cubic-bezier(0,0,0.2,1) infinite' }}></span>
                                                <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', width: '8px', height: '8px', background: 'var(--state-success, #3ecf8e)' }}></span>
                                            </span>
                                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Systems Operational</span>
                                        </div>
                                        <button onClick={() => { setShowHelp(false); onHelpModalOpen('contact'); }}
                                            style={{ ...btn, padding: '2px', fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}
                                            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.color = 'var(--accent)'}
                                        >Contact Us</button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* AI Button */}
                    <button onClick={onAIClick} style={iconBtn(showAI)} title="Chttrix AI"
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--accent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = showAI ? 'var(--bg-hover)' : 'none'; e.currentTarget.style.color = showAI ? 'var(--accent)' : 'var(--text-muted)'; }}
                    ><Bot size={16} /></button>

                    {/* Logout */}
                    <button onClick={onLogout} style={iconBtn()} title="Sign out"
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--state-danger)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    ><LogOut size={16} /></button>
                </div>
            </div>
        </header>
    );
};


export default Header;
