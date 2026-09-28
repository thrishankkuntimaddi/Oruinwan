import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Sun, Moon, ChevronsUpDown, LogOut, UserRound, Settings, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useFlag } from '../../contexts/FeatureFlagsContext';
import { navFor, isOwnerUser, isAdminUser, ROLE_LABEL } from './dashNav';
import '../../styles/gloss.css';
import './dash.css';

const CONSOLE_LABEL = { owner: 'Owner console', admin: 'Admin console', manager: 'Manager console' };

export function initialsOf(name = '') {
    return String(name).trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

export function Avatar({ user, name, src, size }) {
    const label = name || user?.profile?.name || user?.username || user?.email || '';
    const pic = src || user?.profilePicture;
    return (
        <span className="cd-avatar" data-size={size} aria-hidden="true">
            {pic ? <img src={pic} alt="" /> : initialsOf(label)}
        </span>
    );
}

/** Which console a path belongs to. */
function consoleFor(pathname, user) {
    if (pathname.startsWith('/owner')) return 'owner';
    if (pathname.startsWith('/manager')) return 'manager';
    if (pathname.startsWith('/admin')) return 'admin';
    return isOwnerUser(user) ? 'owner' : isAdminUser(user) ? 'admin' : 'manager';
}

/**
 * The one frame for the Owner, Admin and Manager consoles: grouped sidebar
 * nav, a glass top bar, and the routed page. Below 900px the nav becomes a
 * drawer opened from the top bar.
 */
export default function DashShell({ outletContext, topExtra }) {
    const { user, logout } = useAuth();
    const { company } = useCompany();
    const { resolvedTheme, toggleTheme } = useTheme() || {};
    const billingEnabled = useFlag('billing');
    const location = useLocation();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [menu, setMenu] = useState(false);
    const menuRef = useRef(null);

    const role = consoleFor(location.pathname, user);
    const groups = useMemo(() => navFor(role, { billingEnabled }), [role, billingEnabled]);
    const owner = isOwnerUser(user);
    const admin = isAdminUser(user);
    const consoles = [
        owner && { key: 'owner', to: '/owner/dashboard', label: 'Owner' },
        admin && { key: 'admin', to: '/admin/dashboard', label: 'Admin' },
        { key: 'manager', to: '/manager/dashboard/overview', label: 'Manager' },
    ].filter(Boolean);

    useEffect(() => { setOpen(false); setMenu(false); }, [location.pathname]);
    useEffect(() => {
        if (!open && !menu) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setMenu(false); } };
        const onDown = (e) => { if (menu && menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDown);
        return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
    }, [open, menu]);

    const signOut = useCallback(async () => { await logout?.(); navigate('/login'); }, [logout, navigate]);
    const companyName = company?.displayName || company?.name || 'Your company';
    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

    return (
        <div className="cd-shell" data-nav-open={open ? 'true' : undefined} data-console={role}>
            {open && <div className="cd-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
            <aside className="cd-side" aria-label={`${CONSOLE_LABEL[role]} navigation`}>
                <div className="cd-side-brand">
                    <img src="/icons/oruinwan-128.png" alt="" />
                    <div style={{ minWidth: 0 }}>
                        <div className="cd-side-brand-name">Oruinwan</div>
                        <div className="cd-side-brand-role">{CONSOLE_LABEL[role]}</div>
                    </div>
                    <button type="button" className="gl-icon-btn cd-side-close" aria-label="Close navigation" onClick={() => setOpen(false)}>
                        <X size={16} />
                    </button>
                </div>
                <nav className="cd-side-nav">
                    {groups.map((g) => (
                        <div className="cd-nav-group" key={g.label}>
                            <div className="gl-section-label">{g.label}</div>
                            {g.items.map((it) => (
                                <NavLink
                                    key={it.to}
                                    to={it.to}
                                    end
                                    className={({ isActive }) => `gl-item cd-nav-item${isActive ? ' is-active' : ''}`}
                                >
                                    <it.icon size={15} />
                                    <span>{it.label}</span>
                                </NavLink>
                            ))}
                        </div>
                    ))}
                    <div className="cd-nav-group">
                        <div className="gl-section-label">Switch</div>
                        {consoles.filter((c) => c.key !== role).map((c) => (
                            <NavLink key={c.key} to={c.to} className="gl-item cd-nav-item">
                                <ArrowUpRight size={15} />
                                <span>{CONSOLE_LABEL[c.key]}</span>
                            </NavLink>
                        ))}
                        <NavLink to="/workspaces" className="gl-item cd-nav-item">
                            <ArrowUpRight size={15} />
                            <span>Open workspaces</span>
                        </NavLink>
                    </div>
                </nav>
                <div className="cd-side-foot" ref={menuRef}>
                    {menu && (
                        <div className="cd-menu" role="menu">
                            {admin && (
                                <button type="button" role="menuitem" onClick={() => navigate('/admin/profile')}>
                                    <UserRound size={14} /> Admin profile
                                </button>
                            )}
                            <button type="button" role="menuitem" onClick={() => navigate('/settings')}>
                                <Settings size={14} /> Account settings
                            </button>
                            <button type="button" role="menuitem" data-tone="danger" onClick={signOut}>
                                <LogOut size={14} /> Sign out
                            </button>
                        </div>
                    )}
                    <button type="button" className="cd-me" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                        <Avatar user={user} />
                        <span className="cd-me-text">
                            <span className="cd-me-name">{user?.profile?.name || user?.username || user?.email}</span>
                            <span className="cd-me-role">{ROLE_LABEL[user?.companyRole] || 'Member'} · {companyName}</span>
                        </span>
                        <ChevronsUpDown size={14} className="cd-muted" />
                    </button>
                </div>
            </aside>

            <div className="cd-main">
                <header className="cd-top gl-glass-bar">
                    <button type="button" className="gl-icon-btn cd-top-menu" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}>
                        <Menu size={18} />
                    </button>
                    <div className="cd-top-titles">
                        <span className="cd-top-kicker">{CONSOLE_LABEL[role]}</span>
                        <span className="cd-top-title">{companyName}</span>
                    </div>
                    <div className="cd-top-actions">
                        <span className="cd-top-date">{today}</span>
                        {topExtra}
                        {consoles.length > 1 && (
                            <div className="gl-tabs cd-hide-sm" role="tablist" aria-label="Switch console">
                                {consoles.map((c) => (
                                    <button
                                        key={c.key}
                                        type="button"
                                        role="tab"
                                        className="gl-tab"
                                        aria-selected={c.key === role}
                                        onClick={() => c.key !== role && navigate(c.to)}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        {toggleTheme && (
                            <button
                                type="button"
                                className="gl-icon-btn"
                                aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                                title={resolvedTheme === 'dark' ? 'Light theme' : 'Dark theme'}
                                onClick={() => toggleTheme()}
                            >
                                {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                            </button>
                        )}
                    </div>
                </header>
                <main className="cd-content">
                    <Outlet context={outletContext} />
                </main>
            </div>
        </div>
    );
}
