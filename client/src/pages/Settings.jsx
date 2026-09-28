import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft, Bell, Database, Globe, KeyRound, Laptop, Lock, Menu, Palette, Plug, Search, Sparkles, User, X,
} from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import MobileBottomNav from '../components/layout/MobileBottomNav';
import { useAuth } from '../contexts/AuthContext';
import api from '@services/api';
import UserAvatarImage from '../shared/components/ui/UserAvatarImage';

import ProfileTab from './settingsTabs/ProfileTab';
import SecurityTab from './settingsTabs/SecurityTab';
import SessionsTab from './settingsTabs/SessionsTab';
import NotificationsTab from './settingsTabs/NotificationsTab';
import AppearanceTab from './settingsTabs/AppearanceTab';
import RegionTab from './settingsTabs/RegionTab';
import PrivacyTab from './settingsTabs/PrivacyTab';
import AITab from './settingsTabs/AITab';
import IntegrationsTab from './settingsTabs/IntegrationsTab';
import DataTab from './settingsTabs/DataTab';
import { Field, Select, IconButton } from './settingsTabs/settingsUi';
import './settingsTabs/settings.css';

/**
 * Settings: one page, grouped tabs, each tab addressable as /settings?tab=<id>.
 * `keywords` feed the search box so "2fa" finds Security, "avatar" finds Profile…
 */
const GROUPS = [
    {
        label: 'Account',
        items: [
            { id: 'profile', label: 'Profile', icon: User, description: 'Name, photo, contact', keywords: 'name display avatar photo picture bio about phone email emails' },
            { id: 'security', label: 'Password & security', icon: KeyRound, description: 'Password, two-factor', keywords: 'password 2fa two-factor authenticator otp totp security' },
            { id: 'sessions', label: 'Devices', icon: Laptop, description: 'Where you are signed in', keywords: 'sessions devices sign out log out logout browsers' },
        ],
    },
    {
        label: 'Preferences',
        items: [
            { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Alerts, sounds, email', keywords: 'notifications desktop push sound email digest mentions dm' },
            { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme, text size', keywords: 'theme dark light system font text size density appearance' },
            { id: 'region', label: 'Language & region', icon: Globe, description: 'Time zone, dates, translation', keywords: 'language timezone time zone date format clock 24-hour translate translation region' },
            { id: 'privacy', label: 'Privacy', icon: Lock, description: 'Read receipts, discovery', keywords: 'privacy read receipts typing indicator discovery blocked users' },
        ],
    },
    {
        label: 'Assistant',
        items: [
            { id: 'ai', label: 'Oruinwan AI', icon: Sparkles, description: 'Memory, features, engine', keywords: 'ai assistant memory remember forget smart replies engine model usage', workspace: true },
        ],
    },
    {
        label: 'Workspace',
        items: [
            { id: 'integrations', label: 'Integrations', icon: Plug, description: 'Webhooks, connected apps', keywords: 'integrations webhooks apps github slack zapier', workspace: true },
        ],
    },
    {
        label: 'Data',
        items: [
            { id: 'data', label: 'Your data', icon: Database, description: 'Export, activity, delete', keywords: 'export download gdpr audit activity log retention deactivate delete account legal hold data' },
        ],
    },
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);
// Old tab ids (bookmarks, links from elsewhere) → current ones.
const ALIASES = { advanced: 'data', compliance: 'data', account: 'profile', password: 'security', devices: 'sessions', language: 'region' };
const resolveTab = (id) => (ALL_ITEMS.some((i) => i.id === id) ? id : ALIASES[id] || 'profile');

const Settings = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [params, setParams] = useSearchParams();
    const { user } = useAuth();
    const isMobile = useIsMobile();

    const activeId = resolveTab(params.get('tab') || location.state?.tab);
    const active = ALL_ITEMS.find((i) => i.id === activeId);

    const [query, setQuery] = useState('');
    const [navOpen, setNavOpen] = useState(false);
    const [workspaces, setWorkspaces] = useState([]);
    const [workspaceId, setWorkspaceId] = useState('');
    const scrollRef = useRef(null);

    // Where "Back" goes: remembered from the first visit, since switching tabs replaces the URL.
    const backTo = useRef(location.state?.from || null);

    useEffect(() => {
        let alive = true;
        api.get('/api/workspaces/my').then(({ data }) => {
            if (!alive) return;
            const list = data?.workspaces || [];
            setWorkspaces(list);
            let last = null;
            try { last = localStorage.getItem('lastWorkspaceId'); } catch { /* storage blocked */ }
            const preferred = list.find((w) => String(w.id) === String(last)) || list[0];
            if (preferred) setWorkspaceId((cur) => cur || String(preferred.id));
        }).catch(() => { /* workspace-only tabs show their own empty state */ });
        return () => { alive = false; };
    }, []);

    const goTo = (id) => {
        const next = new URLSearchParams(params);
        next.set('tab', id);
        setParams(next, { replace: true });
        setNavOpen(false);
        setQuery('');
        scrollRef.current?.scrollTo({ top: 0 });
    };

    const goBack = () => {
        if (backTo.current) navigate(backTo.current);
        else if (window.history.length > 1) navigate(-1);
        else navigate('/workspaces');
    };

    const groups = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return GROUPS;
        return GROUPS
            .map((g) => ({ ...g, items: g.items.filter((i) => `${i.label} ${i.description} ${i.keywords}`.toLowerCase().includes(q)) }))
            .filter((g) => g.items.length);
    }, [query]);

    const onSearchKey = (e) => {
        if (e.key === 'Enter') {
            const first = groups[0]?.items[0];
            if (first) goTo(first.id);
        } else if (e.key === 'Escape') {
            setQuery('');
        }
    };

    const workspacePicker = active?.workspace && workspaces.length > 1 ? (
        <div style={{ maxWidth: 280 }}>
            <Field label="Workspace" id="settings-workspace">
                <Select id="settings-workspace" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
                    {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Select>
            </Field>
        </div>
    ) : null;
    const workspaceName = workspaces.find((w) => String(w.id) === String(workspaceId))?.name || '';

    const renderTab = () => {
        switch (activeId) {
            case 'profile': return <ProfileTab user={user} />;
            case 'security': return <SecurityTab user={user} />;
            case 'sessions': return <SessionsTab />;
            case 'notifications': return <NotificationsTab />;
            case 'appearance': return <AppearanceTab />;
            case 'region': return <RegionTab />;
            case 'privacy': return <PrivacyTab />;
            case 'ai': return <AITab workspaceId={workspaceId} workspaceName={workspaceName} workspacePicker={workspacePicker} />;
            case 'integrations': return <IntegrationsTab workspaceId={workspaceId} workspaceName={workspaceName} workspacePicker={workspacePicker} />;
            case 'data': return <DataTab user={user} />;
            default: return null;
        }
    };

    return (
        <div className="stg stg-shell" style={{ paddingBottom: isMobile ? 'calc(56px + env(safe-area-inset-bottom))' : 0 }}>
            <aside className="stg-sidebar" data-open={navOpen ? 'true' : 'false'} aria-label="Settings sections">
                <div className="stg-brand">
                    <IconButton label="Back" onClick={goBack}><ArrowLeft size={16} /></IconButton>
                    <img src="/icons/oruinwan-128.png" alt="" />
                    <span className="stg-brand-name">Oruinwan</span>
                    <span className="stg-brand-tag">Settings</span>
                </div>

                <nav className="stg-nav">
                    {groups.map((g) => (
                        <div key={g.label} className="stg-nav-group">
                            <div className="stg-nav-heading">{g.label}</div>
                            {g.items.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className="stg-nav-item"
                                        aria-current={item.id === activeId ? 'page' : undefined}
                                        onClick={() => goTo(item.id)}
                                        data-testid={`settings-nav-${item.id}`}
                                    >
                                        <Icon size={16} />
                                        <span className="stg-nav-text">
                                            {item.label}
                                            <span className="stg-nav-desc">{item.description}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                    {groups.length === 0 && <div className="stg-nav-empty">No settings match “{query}”.</div>}
                </nav>

                <div className="stg-account">
                    <UserAvatarImage userId={user?._id} name={user?.username} src={user?.profilePicture} size={30} initialStyle={{ background: 'var(--accent)', color: '#0c0c0c' }} />
                    <div className="stg-account-text">
                        <div className="stg-account-name">{user?.username}</div>
                        <div className="stg-account-mail">{user?.email}</div>
                    </div>
                </div>
            </aside>

            {navOpen && <div className="stg-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />}

            <main className="stg-main">
                <div className="stg-topbar">
                    <span className="stg-only-mobile">
                        <IconButton label="Open settings menu" onClick={() => setNavOpen(true)}><Menu size={18} /></IconButton>
                    </span>
                    <div className="stg-crumb">
                        <span className="stg-crumb-root">Settings</span>
                        <span className="stg-crumb-sep">/</span>
                        <span className="stg-crumb-page">{active?.label}</span>
                    </div>
                    <div className="stg-search" role="search">
                        <Search size={14} className="stg-search-icon" />
                        <input
                            className="stg-input"
                            type="search"
                            placeholder="Search settings"
                            aria-label="Search settings"
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); if (isMobile && e.target.value) setNavOpen(true); }}
                            onKeyDown={onSearchKey}
                        />
                        {query && (
                            <span className="stg-search-clear">
                                <IconButton label="Clear search" onClick={() => setQuery('')}><X size={13} /></IconButton>
                            </span>
                        )}
                    </div>
                    <span className="stg-hide-mobile">
                        <button type="button" className="stg-btn" onClick={goBack}><ArrowLeft size={14} /> Back</button>
                    </span>
                </div>

                <div className="stg-scroll settings-scroll" ref={scrollRef}>
                    <div className="stg-content" key={activeId}>
                        {renderTab()}
                    </div>
                </div>
            </main>

            {isMobile && createPortal(
                <MobileBottomNav
                    workspaceId={workspaceId || ''}
                    showAI={false}
                    onAIToggle={() => {
                        if (workspaceId) navigate(`/workspace/${workspaceId}/home`, { state: { openAI: true } });
                        else navigate(-1);
                    }}
                />,
                document.body,
            )}
        </div>
    );
};

export default Settings;
