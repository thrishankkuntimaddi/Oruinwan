import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, LogOut, Palette, Shield, Settings } from 'lucide-react';
import { getAvatarUrl } from '../../../utils/avatarUtils';
import '../profileMenu.css';

const STATUSES = [
    { key: 'active', label: 'Active', tone: 'success' },
    { key: 'away', label: 'Away', tone: 'warning' },
    { key: 'dnd', label: 'Do not disturb', tone: 'danger', title: 'Do not disturb: notifications are paused' },
];

const MainMenuView = ({ user, status, onStatusChange, onNavigate, onLogout }) => {
    const navigate = useNavigate();
    const current = STATUSES.find((s) => s.key === status) || STATUSES[0];
    const isAdmin = user?.companyRole === 'admin' || user?.companyRole === 'owner';

    return (
        <div className="pm" role="menu" aria-label="Your account">
            {/* Who you are. Editing the profile lives in Settings → Profile. */}
            <div className="pm-who" style={{ cursor: 'default' }}>
                <span className="pm-avatar">
                    <img src={getAvatarUrl(user)} alt="" />
                    <span className="pm-avatar-dot pm-dot" data-tone={current.tone} aria-hidden="true" />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="pm-who-name" style={{ display: 'block' }}>{user?.username}</span>
                    <span className="pm-who-mail" style={{ display: 'block' }}>{user?.email}</span>
                </span>
            </div>

            <div className="pm-section">
                <span className="pm-cap">Status</span>
                <div className="pm-status" role="group" aria-label="Status">
                    {STATUSES.map((s) => (
                        <button
                            key={s.key}
                            type="button"
                            aria-pressed={status === s.key}
                            title={s.title || s.label}
                            onClick={(e) => { e.stopPropagation(); onStatusChange(s.key); }}
                        >
                            <span className="pm-dot" data-tone={s.tone} aria-hidden="true" />
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="pm-items">
                <button type="button" role="menuitem" className="pm-item" onClick={() => navigate('/settings', { state: { from: window.location.pathname } })}>
                    <Settings size={15} /> Settings
                </button>
                <button type="button" role="menuitem" className="pm-item" onClick={() => onNavigate('preferences')}>
                    <Palette size={15} /> Appearance
                </button>
                <button type="button" role="menuitem" className="pm-item" onClick={() => onNavigate('help')}>
                    <HelpCircle size={15} /> Help and support
                </button>

                {isAdmin && (
                    <button type="button" role="menuitem" className="pm-item" data-tone="accent" onClick={() => { window.location.href = '/admin/company'; }}>
                        <Shield size={15} /> Admin console
                    </button>
                )}

                <div className="pm-rule" aria-hidden="true" />

                <button type="button" role="menuitem" className="pm-item" data-tone="danger" onClick={onLogout}>
                    <LogOut size={15} /> Sign out
                </button>
            </div>
        </div>
    );
};

export default MainMenuView;
