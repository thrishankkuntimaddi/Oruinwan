import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Sun, Moon, Monitor as MonitorIcon, Bell, ArrowUpRight, Palette } from 'lucide-react';
import { Btn } from '../../ui/page';
import '../profileMenu.css';

const THEMES = [
    { key: 'light', label: 'Light', Icon: Sun },
    { key: 'dark', label: 'Dark', Icon: Moon },
    { key: 'auto', label: 'System', Icon: MonitorIcon },
];

const PreferencesView = ({ theme, setTheme, onBack }) => {
    const navigate = useNavigate();
    const openSettings = (tab) => navigate(`/settings?tab=${tab}`, { state: { from: window.location.pathname } });

    return (
        <div className="pm" role="dialog" aria-label="Preferences">
            <div className="pm-head">
                <button type="button" className="pm-back" onClick={onBack}><ChevronLeft size={14} /> Back</button>
                <h2>Preferences</h2>
                <span />
            </div>
            <div className="pm-body">
                <section className="pm-group">
                    <div className="pm-group-title"><Palette size={14} /><span className="pm-cap">Appearance</span></div>
                    <div className="pm-themes" role="group" aria-label="Theme">
                        {THEMES.map(({ key, label, Icon }) => (
                            <button key={key} type="button" className="pm-theme" aria-pressed={theme === key} onClick={() => setTheme(key)}>
                                <Icon size={18} />
                                {label}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="pm-group">
                    <div className="pm-group-title"><Bell size={14} /><span className="pm-cap">Notifications</span></div>
                    <div className="pm-setting">
                        <div>
                            <div className="pm-setting-label">Alerts, sounds and email</div>
                            <div className="pm-setting-sub">Choose what reaches you and when.</div>
                        </div>
                        <Btn size="sm" onClick={() => openSettings('notifications')}>Open <ArrowUpRight size={12} /></Btn>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default PreferencesView;
